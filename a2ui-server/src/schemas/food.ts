import z from "zod";

/**
 * 点餐相关输入类型（zod schema）
 *
 * ## 约定
 * - **输入**：使用 zod schema，路由层直接交给 Elysia 做校验
 * - **输出**：使用 Prisma 模型类型（见各 service 的返回类型）
 */

// ─────────────────────────── 菜品 ───────────────────────────

export const orderItemSchema = z.object({
  dishId: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().int().min(1),
  price: z.number().min(0),
  image: z.string().optional(),
});
export type OrderItem = z.infer<typeof orderItemSchema>;

const decimalString = z.union([z.string(), z.number()]);

export const menuQuerySchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
  page: decimalString.optional(),
  pageSize: decimalString.optional(),
});
export type MenuQuery = z.infer<typeof menuQuerySchema>;

export const createDishSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  full_description: z.string().optional(),
  price: decimalString,
  image: z.string().optional(),
  category: z.string().min(1).max(50),
  tags: z.array(z.string()).optional(),
  ingredients: z.array(z.string()).optional(),
  available: z.boolean().optional(),
});
export type CreateDishInput = z.infer<typeof createDishSchema>;

export const updateDishSchema = createDishSchema.partial();
export type UpdateDishInput = z.infer<typeof updateDishSchema>;

// ─────────────────────────── 订单 ───────────────────────────

export const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  contactName: z.string().optional(),
  note: z.string().optional(),
  deliveryType: z.string().optional(),
  estimatedTime: z.string().optional(),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const ordersQuerySchema = z.object({
  page: decimalString.optional(),
  pageSize: decimalString.optional(),
  status: z.string().optional(),
});
export type OrdersQuery = z.infer<typeof ordersQuerySchema>;

export const updateOrderStatusSchema = z.object({
  status: z.string().min(1),
  message: z.string().optional(),
});
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

export const cancelOrderSchema = z
  .object({
    reason: z.string().optional(),
  })
  .optional();
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;

// ─────────────────────────── 地址 ───────────────────────────

export const createAddressSchema = z.object({
  label: z.string().optional(),
  address: z.string().min(1),
  phone: z.string().optional(),
  contactName: z.string().optional(),
  isDefault: z.boolean().optional(),
});
export type CreateAddressInput = z.infer<typeof createAddressSchema>;

export const updateAddressSchema = z.object({
  label: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  contactName: z.string().optional(),
  isDefault: z.boolean().optional(),
});
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;

// ─────────────────────────── 通用 ───────────────────────────

export const idParamSchema = z.object({
  id: z.string().min(1),
});

/** 把 query 中的字符串分页参数规范化为数字 */
export function normalizePagination(
  page?: string | number,
  pageSize?: string | number,
): { page: number; pageSize: number } {
  const parse = (v: string | number | undefined, fallback: number): number => {
    const n = typeof v === "number" ? v : Number.parseInt(v ?? "", 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };

  return { page: parse(page, 1), pageSize: parse(pageSize, 20) };
}
