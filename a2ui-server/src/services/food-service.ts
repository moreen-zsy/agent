import { foodDb } from '../db/food/index.js';
import { dishes, orders, orderStatusHistory, userAddresses } from '../db/food/schema.js';
import { eq, like, count, and, or, desc } from 'drizzle-orm';

export interface PaginationParams {
  page?: number;
  pageSize?: number;
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

// ─── 订单号生成 ───
function generateOrderNo(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 900 + 100);
  return `GD${dateStr}${String(random).padStart(3, '0')}`;
}

// ─── 状态默认消息 ───
const statusMessages: Record<string, string> = {
  pending: '订单已提交，等待商家确认',
  confirmed: '商家已接单',
  preparing: '厨师正在制作中',
  ready: '订单已制作完成',
  delivering: '骑手正在配送中',
  delivered: '订单已送达',
  cancelled: '订单已取消',
};

function getDefaultMessage(status: string): string {
  return statusMessages[status] || '订单状态已更新';
}

export async function getMenu(category?: string, search?: string, pagination?: PaginationParams): Promise<PaginatedResult<typeof dishes.$inferSelect>> {
  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (category) {
    conditions.push(eq(dishes.category, category));
  }
  if (search) {
    conditions.push(or(
      like(dishes.name, `%${search}%`),
      like(dishes.description, `%${search}%`)
    ));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult] = await foodDb
    .select({ count: count() })
    .from(dishes)
    .where(whereClause);

  const total = totalResult?.count ?? 0;

  const data = await foodDb
    .select()
    .from(dishes)
    .where(whereClause)
    .limit(pageSize)
    .offset(offset);

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function getDish(dishId: string) {
  const [dish] = await foodDb.select().from(dishes).where(eq(dishes.id, dishId));
  return dish;
}

export interface CreateOrderInput {
  items: { dishId: string; name: string; quantity: number; price: number; image?: string }[];
  address?: string;
  phone?: string;
  contactName?: string;
  note?: string;
  deliveryType?: string;
}

export async function createOrder(userId: string, input: CreateOrderInput) {
  const total = input.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const orderNo = generateOrderNo();

  const [order] = await foodDb.insert(orders).values({
    userId,
    orderNo,
    items: input.items,
    total: total.toFixed(2),
    address: input.address,
    phone: input.phone,
    contactName: input.contactName,
    note: input.note,
    deliveryType: input.deliveryType || 'delivery',
    status: 'pending',
  }).returning();

  // 写入初始状态历史
  if (order) {
    await foodDb.insert(orderStatusHistory).values({
      orderId: order.id,
      status: 'pending',
      message: getDefaultMessage('pending'),
    });
  }

  return order;
}

export async function getOrders(userId: string, pagination?: PaginationParams, status?: string): Promise<PaginatedResult<typeof orders.$inferSelect>> {
  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const conditions = [eq(orders.userId, userId)];
  if (status) {
    conditions.push(eq(orders.status, status));
  }

  const whereClause = and(...conditions);

  const [totalResult] = await foodDb
    .select({ count: count() })
    .from(orders)
    .where(whereClause);

  const total = totalResult?.count ?? 0;

  const data = await foodDb
    .select()
    .from(orders)
    .where(whereClause)
    .orderBy(desc(orders.createdAt))
    .limit(pageSize)
    .offset(offset);

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export interface OrderWithHistory {
  order: typeof orders.$inferSelect;
  history: (typeof orderStatusHistory.$inferSelect)[];
}

export async function getOrderWithHistory(orderId: string): Promise<OrderWithHistory | null> {
  const [order] = await foodDb.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return null;

  const history = await foodDb
    .select()
    .from(orderStatusHistory)
    .where(eq(orderStatusHistory.orderId, orderId))
    .orderBy(orderStatusHistory.createdAt);

  return { order, history };
}

export async function getOrder(orderId: string) {
  const [order] = await foodDb.select().from(orders).where(eq(orders.id, orderId));
  return order;
}

export async function updateOrderStatus(orderId: string, status: string, message?: string) {
  const order = await getOrder(orderId);
  if (!order) return null;

  const [updated] = await foodDb
    .update(orders)
    .set({ status, updatedAt: new Date() })
    .where(eq(orders.id, orderId))
    .returning();

  // 写入状态变更历史
  await foodDb.insert(orderStatusHistory).values({
    orderId,
    status,
    prevStatus: order.status,
    message: message || getDefaultMessage(status),
  });

  return updated;
}

export async function cancelOrder(orderId: string, reason?: string) {
  return updateOrderStatus(orderId, 'cancelled', reason || '用户取消订单');
}

export async function deleteOrder(orderId: string) {
  // 先删除历史记录
  await foodDb.delete(orderStatusHistory).where(eq(orderStatusHistory.orderId, orderId));
  const [deleted] = await foodDb
    .delete(orders)
    .where(eq(orders.id, orderId))
    .returning();
  return deleted;
}

// ─── 地址管理 ───

export async function getUserAddresses(userId: string) {
  return foodDb
    .select()
    .from(userAddresses)
    .where(eq(userAddresses.userId, userId))
    .orderBy(desc(userAddresses.isDefault), userAddresses.createdAt);
}

export async function createUserAddress(userId: string, data: {
  label?: string;
  address: string;
  phone?: string;
  contactName?: string;
  isDefault?: boolean;
}) {
  // 如果设为默认，先取消其他默认地址
  if (data.isDefault) {
    await foodDb
      .update(userAddresses)
      .set({ isDefault: false })
      .where(eq(userAddresses.userId, userId));
  }

  const [address] = await foodDb.insert(userAddresses).values({
    userId,
    label: data.label,
    address: data.address,
    phone: data.phone,
    contactName: data.contactName,
    isDefault: data.isDefault ?? false,
  }).returning();

  return address;
}

export async function updateUserAddress(addressId: string, userId: string, data: {
  label?: string;
  address?: string;
  phone?: string;
  contactName?: string;
  isDefault?: boolean;
}) {
  const [existing] = await foodDb
    .select()
    .from(userAddresses)
    .where(eq(userAddresses.id, addressId));

  if (!existing || existing.userId !== userId) return null;

  // 如果设为默认，先取消其他默认地址
  if (data.isDefault) {
    await foodDb
      .update(userAddresses)
      .set({ isDefault: false })
      .where(eq(userAddresses.userId, userId));
  }

  const [updated] = await foodDb
    .update(userAddresses)
    .set(data)
    .where(eq(userAddresses.id, addressId))
    .returning();

  return updated;
}

export async function deleteUserAddress(addressId: string, userId: string) {
  const [existing] = await foodDb
    .select()
    .from(userAddresses)
    .where(eq(userAddresses.id, addressId));

  if (!existing || existing.userId !== userId) return null;

  const [deleted] = await foodDb
    .delete(userAddresses)
    .where(eq(userAddresses.id, addressId))
    .returning();

  return deleted;
}
