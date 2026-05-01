import { pgTable, uuid, varchar, text, timestamp, boolean, integer, numeric } from 'drizzle-orm/pg-core';

export const facilities = pgTable('facilities', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  location: varchar('location', { length: 255 }),
  capacity: integer('capacity'),
  available: boolean('available').default(true),
});

export const reservations = pgTable('reservations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  facilityId: uuid('facility_id').notNull().references(() => facilities.id, { onDelete: 'cascade' }),
  date: varchar('date', { length: 50 }).notNull(),
  timeSlot: varchar('time_slot', { length: 50 }).notNull(),
  status: varchar('status', { length: 50 }).default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  status: varchar('status', { length: 50 }).default('pending'),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
