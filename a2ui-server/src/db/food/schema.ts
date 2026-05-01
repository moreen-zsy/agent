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
  items: jsonb('items').notNull().$type<{ dishId: string; name: string; quantity: number; price: number }[]>(),
  total: numeric('total', { precision: 10, scale: 2 }).notNull(),
  status: varchar('status', { length: 50 }).default('pending'),
  address: text('address'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
