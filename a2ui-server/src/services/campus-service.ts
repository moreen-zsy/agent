import { campusDb } from '../db/campus/index.js';
import { facilities, reservations, payments } from '../db/campus/schema.js';
import { eq, like, count, and } from 'drizzle-orm';
import type { PaginationParams, PaginatedResult } from './food-service.js';

export async function getFacilities(type?: string, search?: string, pagination?: PaginationParams): Promise<PaginatedResult<typeof facilities.$inferSelect>> {
  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (type) {
    conditions.push(eq(facilities.type, type));
  }
  if (search) {
    conditions.push(like(facilities.name, `%${search}%`));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult] = await campusDb
    .select({ count: count() })
    .from(facilities)
    .where(whereClause);

  const total = totalResult?.count ?? 0;

  const data = await campusDb
    .select()
    .from(facilities)
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

export async function getFacility(facilityId: string) {
  const [facility] = await campusDb.select().from(facilities).where(eq(facilities.id, facilityId));
  return facility;
}

export async function createReservation(userId: string, facilityId: string, date: string, timeSlot: string) {
  const [res] = await campusDb.insert(reservations).values({
    userId,
    facilityId,
    date,
    timeSlot,
    status: 'confirmed',
  }).returning();
  return res;
}

export async function getReservations(userId: string, pagination?: PaginationParams): Promise<PaginatedResult<typeof reservations.$inferSelect>> {
  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const whereClause = eq(reservations.userId, userId);

  const [totalResult] = await campusDb
    .select({ count: count() })
    .from(reservations)
    .where(whereClause);

  const total = totalResult?.count ?? 0;

  const data = await campusDb
    .select()
    .from(reservations)
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

export async function updateReservationStatus(reservationId: string, status: string) {
  const [updated] = await campusDb
    .update(reservations)
    .set({ status })
    .where(eq(reservations.id, reservationId))
    .returning();
  return updated;
}

export async function deleteReservation(reservationId: string) {
  const [deleted] = await campusDb
    .delete(reservations)
    .where(eq(reservations.id, reservationId))
    .returning();
  return deleted;
}

export async function createPayment(userId: string, type: string, amount: number, description?: string) {
  const [payment] = await campusDb.insert(payments).values({
    userId,
    type,
    amount: amount.toFixed(2),
    description,
    status: 'paid',
  }).returning();
  return payment;
}

export async function getPayments(userId: string, pagination?: PaginationParams, type?: string): Promise<PaginatedResult<typeof payments.$inferSelect>> {
  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const conditions = [eq(payments.userId, userId)];
  if (type) {
    conditions.push(eq(payments.type, type));
  }

  const whereClause = and(...conditions);

  const [totalResult] = await campusDb
    .select({ count: count() })
    .from(payments)
    .where(whereClause);

  const total = totalResult?.count ?? 0;

  const data = await campusDb
    .select()
    .from(payments)
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

export async function updatePaymentStatus(paymentId: string, status: string) {
  const [updated] = await campusDb
    .update(payments)
    .set({ status })
    .where(eq(payments.id, paymentId))
    .returning();
  return updated;
}
