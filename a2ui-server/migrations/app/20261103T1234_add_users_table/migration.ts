#!/usr/bin/env -S bun
import type { Contract as End } from '../../snapshots/420124342f46a7b624abe5d71553d73a9b43438e04ef60d9421ce9c19060d884/contract';
import endContract from '../../snapshots/420124342f46a7b624abe5d71553d73a9b43438e04ef60d9421ce9c19060d884/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/6f79a70413c6632ace49016b6577bf09a34f9cd111990a94e2311f61a5fe4af0/contract';
import startContract from '../../snapshots/6f79a70413c6632ace49016b6577bf09a34f9cd111990a94e2311f61a5fe4af0/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'users',
        columns: [
          col('avatar', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('email', 'character varying(255)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 255 } },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('name', 'character varying(255)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 255 } },
          }),
          col('phone', 'character varying(20)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 20 } },
          }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'users',
        constraint: 'users_email_key',
        columns: ['email'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
