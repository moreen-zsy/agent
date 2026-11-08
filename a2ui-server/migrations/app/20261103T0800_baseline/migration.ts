#!/usr/bin/env -S bun
import type { Contract as End } from '../../snapshots/6f79a70413c6632ace49016b6577bf09a34f9cd111990a94e2311f61a5fe4af0/contract';
import endContract from '../../snapshots/6f79a70413c6632ace49016b6577bf09a34f9cd111990a94e2311f61a5fe4af0/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
  sql,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'dishes',
        columns: [
          col('available', 'bool', { default: lit(true), codecRef: { codecId: 'pg/bool@1' } }),
          col('category', 'character varying(50)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 50 } },
          }),
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('full_description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('image', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('ingredients', 'text[]', { codecRef: { codecId: 'pg/text@1', many: true } }),
          col('name', 'character varying(255)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 255 } },
          }),
          col('price', 'numeric(10,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 2 } },
          }),
          col('tags', 'text[]', { codecRef: { codecId: 'pg/text@1', many: true } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'dishes_ingredients_elem_not_null_225187b9',
            sql`array_position("ingredients", NULL) IS NULL`,
          ),
          checkExpression(
            'dishes_tags_elem_not_null_aecbe9e2',
            sql`array_position("tags", NULL) IS NULL`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'order_status_history',
        columns: [
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('message', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('order_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('prev_status', 'character varying(50)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 50 } },
          }),
          col('status', 'character varying(50)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 50 } },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'orders',
        columns: [
          col('address', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('contact_name', 'character varying(100)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 100 } },
          }),
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('delivery_type', 'character varying(20)', {
            notNull: true,
            default: lit('delivery'),
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 20 } },
          }),
          col('estimated_time', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('items', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('note', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('order_no', 'character varying(32)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 32 } },
          }),
          col('payment_method', 'character varying(20)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 20 } },
          }),
          col('payment_status', 'character varying(20)', {
            notNull: true,
            default: lit('unpaid'),
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 20 } },
          }),
          col('phone', 'character varying(20)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 20 } },
          }),
          col('status', 'character varying(50)', {
            notNull: true,
            default: lit('pending'),
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 50 } },
          }),
          col('total', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('user_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'user_addresses',
        columns: [
          col('address', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('contact_name', 'character varying(100)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 100 } },
          }),
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('is_default', 'bool', { default: lit(false), codecRef: { codecId: 'pg/bool@1' } }),
          col('label', 'character varying(50)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 50 } },
          }),
          col('phone', 'character varying(20)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 20 } },
          }),
          col('user_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'orders',
        constraint: 'orders_order_no_key',
        columns: ['order_no'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
