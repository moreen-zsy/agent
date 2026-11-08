import { db } from "../prisma/db.ts";
import { or } from "@prisma/orm-postgres/orm-client";
import type { Models } from "../prisma/contract";
import type {
  CreateAddressInput,
  CreateDishInput,
  CreateOrderInput,
  UpdateAddressInput,
  UpdateDishInput,
} from "../schemas/food.ts";

/**
 * 点餐业务 service
 *
 * ## 类型约定
 * - **输入**：zod schema 推导类型（来自 `schemas/food.ts`）
 * - **输出**：Prisma 模型类型（`Models.public_*`）
 *
 * 模型类型含反向关联字段（如 `Orders.user`），此处统一用
 * `Omit<..., 关联字段>` 表达"仅标量列"的行类型。
 */

// ─────────────────────── 行类型 ───────────────────────

export type DishRow = Omit<Models.public_Dishes, never>;
export type OrderRow = Omit<Models.public_Orders, "user">;
export type AddressRow = Omit<Models.public_UserAddresses, "user">;
export type OrderHistoryRow = Omit<Models.public_OrderStatusHistory, "orders">;

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface OrderWithHistory {
  order: OrderRow;
  history: OrderHistoryRow[];
}

// ─────────────────────── 内部工具 ───────────────────────

const ORDER_STATUS_MESSAGES: Record<string, string> = {
  pending: "订单已提交，等待商家确认",
  confirmed: "商家已接单",
  preparing: "厨师正在制作中",
  ready: "订单已制作完成",
  delivering: "骑手正在配送中",
  delivered: "订单已送达",
  cancelled: "订单已取消",
};

function defaultStatusMessage(status: string): string {
  return ORDER_STATUS_MESSAGES[status] ?? "订单状态已更新";
}

/**
 * 生成订单号
 *
 * 格式：GD + YYYYMMDD + 12 位随机/时间后缀（共 22 个字符，满足 VarChar(32)）
 *
 * 早先实现只用 3 位随机数（仅 900 种可能），并发下单时极易碰撞并撞上
 * `order_no` 的唯一约束。这里改为毫秒时间戳 + 6 位随机，并保留重试能力。
 */
function generateOrderNo(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const msPart = String(now.getTime() % 100_000).padStart(5, "0");
  const randomPart = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
  return `GD${dateStr}${msPart}${randomPart}`;
}

/** 订单号唯一约束冲突时的重试次数 */
const ORDER_NO_RETRY = 5;

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  // Numeric / Decimal 类型可能带 toString
  const n = Number(String(value));
  return Number.isFinite(n) ? n : 0;
}

// ─────────────────────── 菜品 ───────────────────────

export async function getMenu(
  params: {
    category?: string;
    search?: string;
    page?: string | number;
    pageSize?: string | number;
  } = {},
): Promise<PaginatedResult<DishRow>> {
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.max(1, Number(params.pageSize) || 20);
  const offset = (page - 1) * pageSize;

  let collection = db.orm.public.Dishes;

  if (params.category) {
    collection = collection.where((d) => d.category.eq(params.category!));
  }

  if (params.search) {
    const pattern = `%${params.search}%`;
    collection = collection.where((d) =>
      // 名称或描述命中其一即可
      or(d.name.ilike(pattern), d.description.ilike(pattern)),
    );
  }

  const { total } = await collection.aggregate((agg) => ({
    total: agg.count(),
  }));

  const data = await collection
    .orderBy((d) => d.createdAt.desc())
    .limit(pageSize)
    .offset(offset)
    .all();

  return {
    data: data as unknown as DishRow[],
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function getDish(dishId: string): Promise<DishRow | null> {
  const dish = await db.orm.public.Dishes.where({ id: dishId }).first();
  return (dish as unknown as DishRow) ?? null;
}

export async function createDish(input: CreateDishInput): Promise<DishRow> {
  const dish = await db.orm.public.Dishes.create({
    name: input.name,
    description: input.description ?? null,
    full_description: input.full_description ?? null,
    price: input.price as never,
    image: input.image ?? null,
    category: input.category,
    tags: input.tags ?? null,
    ingredients: input.ingredients ?? null,
    available: input.available ?? true,
  });
  return dish as unknown as DishRow;
}

export async function updateDish(
  dishId: string,
  input: UpdateDishInput,
): Promise<DishRow | null> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) payload[key] = value;
  }
  if (Object.keys(payload).length === 0) return getDish(dishId);

  const updated = await db.orm.public.Dishes
    .where({ id: dishId })
    .update(payload as never);
  return (updated as unknown as DishRow) ?? null;
}

export async function deleteDish(dishId: string): Promise<DishRow | null> {
  const deleted = await db.orm.public.Dishes.where({ id: dishId }).delete();
  return (deleted as unknown as DishRow) ?? null;
}

// ─────────────────────── 订单 ───────────────────────

export async function createOrder(
  userId: string,
  input: CreateOrderInput,
): Promise<OrderWithHistory> {
  const total = input.items.reduce(
    (sum, item) => sum + toNumber(item.price) * toNumber(item.quantity),
    0,
  );

  // order_no 有唯一约束，并发下可能碰撞，冲突时重新生成并重试
  for (let attempt = 1; ; attempt++) {
    const orderNo = generateOrderNo();

    try {
      return await db.transaction(async (tx) => {
        const order = await tx.orm.public.Orders.create({
          userId,
          orderNo,
          items: input.items as never,
          total: total.toFixed(2) as never,
          address: input.address ?? null,
          phone: input.phone ?? null,
          contactName: input.contactName ?? null,
          note: input.note ?? null,
          deliveryType: input.deliveryType ?? "delivery",
          status: "pending",
        });

        const history = await tx.orm.public.OrderStatusHistory.create({
          orderId: order.id,
          status: "pending",
          message: defaultStatusMessage("pending"),
        });

        return {
          order: order as unknown as OrderRow,
          history: [history as unknown as OrderHistoryRow],
        };
      });
    } catch (error) {
      const affected = collectConstraintCodes(error);
      const isUniqueOnOrderNo = affected.some((c) => c === "23505");

      if (!isUniqueOnOrderNo || attempt >= ORDER_NO_RETRY) throw error;
    }
  }
}

/** 从错误链中提取 Postgres SQLSTATE 代码 */
function collectConstraintCodes(error: unknown): string[] {
  const codes: string[] = [];
  let cur: unknown = error;

  for (let depth = 0; depth < 5 && cur; depth++) {
    const obj = cur as { code?: unknown; cause?: unknown };
    if (typeof obj.code === "string") codes.push(obj.code);
    cur = obj.cause;
  }

  return codes;
}

export async function getOrders(
  userId: string,
  params: PaginationParams,
  status?: string,
): Promise<PaginatedResult<OrderRow>> {
  const { page, pageSize } = params;
  const offset = (page - 1) * pageSize;

  let collection = db.orm.public.Orders.where((o) => o.userId.eq(userId));
  if (status) {
    collection = collection.where((o) => o.status.eq(status));
  }

  const { total } = await collection.aggregate((agg) => ({ total: agg.count() }));

  const data = await collection
    .orderBy((o) => o.createdAt.desc())
    .limit(pageSize)
    .offset(offset)
    .all();

  return {
    data: data as unknown as OrderRow[],
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function getOrder(orderId: string): Promise<OrderRow | null> {
  const order = await db.orm.public.Orders.where({ id: orderId }).first();
  return (order as unknown as OrderRow) ?? null;
}

export async function getOrderWithHistory(
  orderId: string,
): Promise<OrderWithHistory | null> {
  const order = await getOrder(orderId);
  if (!order) return null;

  const history = await db.orm.public.OrderStatusHistory
    .where((h) => h.orderId.eq(orderId))
    .orderBy((h) => h.createdAt.asc())
    .all();

  return { order, history: history as unknown as OrderHistoryRow[] };
}

export async function updateOrderStatus(
  orderId: string,
  status: string,
  message?: string,
): Promise<OrderWithHistory | null> {
  const current = await getOrder(orderId);
  if (!current) return null;

  return db.transaction(async (tx) => {
    // updatedAt 是 temporal.UpdatedAt，由 ORM 在 update 时自动写入，无需手动传
    const updated = await tx.orm.public.Orders
      .where({ id: orderId })
      .update({ status });

    const history = await tx.orm.public.OrderStatusHistory.create({
      orderId,
      status,
      prevStatus: current.status,
      message: message ?? defaultStatusMessage(status),
    });

    return {
      order: updated as unknown as OrderRow,
      history: [history as unknown as OrderHistoryRow],
    };
  });
}

export async function cancelOrder(
  orderId: string,
  reason?: string,
): Promise<OrderWithHistory | null> {
  return updateOrderStatus(orderId, "cancelled", reason ?? "用户取消订单");
}

export async function deleteOrder(orderId: string): Promise<OrderRow | null> {
  const current = await getOrder(orderId);
  if (!current) return null;

  return db.transaction(async (tx) => {
    await tx.orm.public.OrderStatusHistory
      .where((h) => h.orderId.eq(orderId))
      .deleteAll();

    const deleted = await tx.orm.public.Orders.where({ id: orderId }).delete();
    return (deleted as unknown as OrderRow) ?? null;
  });
}

// ─────────────────────── 地址 ───────────────────────

/**
 * 查询当前用户的地址列表
 *
 * `User` 与 `UserAddresses` 为一对多关系，默认地址排在首位。
 */
export async function getUserAddresses(userId: string): Promise<AddressRow[]> {
  const rows = await db.orm.public.UserAddresses
    .where((a) => a.userId.eq(userId))
    .orderBy((a) => a.createdAt.desc())
    .all();

  // isDefault 是可空布尔列，无法直接参与 orderBy，在内存中将默认地址置顶
  const list = rows as unknown as AddressRow[];
  return [...list].sort(
    (a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)),
  );
}

/**
 * 新增地址
 *
 * 一对多：允许同一用户拥有多条地址。
 * 若 `isDefault` 为 true，先将该用户其他地址的默认标记取消。
 */
export async function createUserAddress(
  userId: string,
  input: CreateAddressInput,
): Promise<AddressRow> {
  return db.transaction(async (tx) => {
    if (input.isDefault) {
      await tx.orm.public.UserAddresses
        .where((a) => a.userId.eq(userId))
        .update({ isDefault: false });
    }

    const row = await tx.orm.public.UserAddresses.create({
      userId,
      label: input.label ?? null,
      address: input.address,
      phone: input.phone ?? null,
      contactName: input.contactName ?? null,
      isDefault: input.isDefault ?? false,
    });

    return row as unknown as AddressRow;
  });
}

export async function updateUserAddress(
  addressId: string,
  userId: string,
  input: UpdateAddressInput,
): Promise<AddressRow | null> {
  const existing = await db.orm.public.UserAddresses.where({ id: addressId }).first();
  if (!existing || existing.userId !== userId) return null;

  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) payload[key] = value;
  }
  if (Object.keys(payload).length === 0) return existing as unknown as AddressRow;

  return db.transaction(async (tx) => {
    // 设为默认时，取消该用户其他地址的默认标记，保证全局只有一个默认
    if (input.isDefault) {
      await tx.orm.public.UserAddresses
        .where((a) => a.userId.eq(userId))
        .update({ isDefault: false });
    }

    const updated = await tx.orm.public.UserAddresses
      .where({ id: addressId })
      .update(payload as never);

    return (updated as unknown as AddressRow) ?? null;
  });
}

export async function deleteUserAddress(
  addressId: string,
  userId: string,
): Promise<AddressRow | null> {
  const existing = await db.orm.public.UserAddresses.where({ id: addressId }).first();
  if (!existing || existing.userId !== userId) return null;

  const deleted = await db.orm.public.UserAddresses.where({ id: addressId }).delete();
  return (deleted as unknown as AddressRow) ?? null;
}
