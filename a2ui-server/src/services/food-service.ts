import { foodDb } from '../db/food/index.js';
import { dishes, orders } from '../db/food/schema.js';
import { eq, like, count, and } from 'drizzle-orm';

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

export async function getMenu(category?: string, search?: string, pagination?: PaginationParams): Promise<PaginatedResult<typeof dishes.$inferSelect>> {
  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (category) {
    conditions.push(eq(dishes.category, category));
  }
  if (search) {
    conditions.push(like(dishes.name, `%${search}%`));
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

export async function createOrder(userId: string, items: { dishId: string; name: string; quantity: number; price: number }[], address?: string) {
  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const [order] = await foodDb.insert(orders).values({
    userId,
    items,
    total: total.toFixed(2),
    address,
    status: 'pending',
  }).returning();
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

export async function getOrder(orderId: string) {
  const [order] = await foodDb.select().from(orders).where(eq(orders.id, orderId));
  return order;
}

export async function updateOrderStatus(orderId: string, status: string) {
  const [updated] = await foodDb
    .update(orders)
    .set({ status })
    .where(eq(orders.id, orderId))
    .returning();
  return updated;
}

export async function deleteOrder(orderId: string) {
  const [deleted] = await foodDb
    .delete(orders)
    .where(eq(orders.id, orderId))
    .returning();
  return deleted;
}
