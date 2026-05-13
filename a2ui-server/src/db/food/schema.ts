import { pgTable, uuid, varchar, text, timestamp, jsonb, boolean, numeric } from 'drizzle-orm/pg-core';

export const dishes = pgTable('dishes', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  fullDescription: text('full_description'),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  image: text('image'),
  category: varchar('category', { length: 50 }).notNull(),
  tags: jsonb('tags').$type<string[]>(),
  ingredients: jsonb('ingredients').$type<string[]>(),
  available: boolean('available').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  orderNo: varchar('order_no', { length: 32 }).notNull().unique(),
  items: jsonb('items').notNull().$type<{
    dishId: string;
    name: string;
    quantity: number;
    price: number;
    image?: string;
  }[]>(),
  total: numeric('total', { precision: 10, scale: 2 }).notNull(),
  status: varchar('status', { length: 50 }).default('pending').notNull(),
  address: text('address'),
  phone: varchar('phone', { length: 20 }),
  contactName: varchar('contact_name', { length: 100 }),
  note: text('note'),
  deliveryType: varchar('delivery_type', { length: 20 }).default('delivery'),
  estimatedTime: timestamp('estimated_time', { withTimezone: true }),
  paymentStatus: varchar('payment_status', { length: 20 }).default('unpaid'),
  paymentMethod: varchar('payment_method', { length: 20 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const orderStatusHistory = pgTable('order_status_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  prevStatus: varchar('prev_status', { length: 50 }),
  message: text('message'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const userAddresses = pgTable('user_addresses', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  label: varchar('label', { length: 50 }),
  address: text('address').notNull(),
  phone: varchar('phone', { length: 20 }),
  contactName: varchar('contact_name', { length: 100 }),
  isDefault: boolean('is_default').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
