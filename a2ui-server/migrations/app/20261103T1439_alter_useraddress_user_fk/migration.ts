#!/usr/bin/env -S bun
import type { Contract as Start } from '../../snapshots/e0704bf582d316bddb20df1980f2ec1afc55269d1a3b43e25d7dfed32a88cad1/contract';
import startContract from '../../snapshots/e0704bf582d316bddb20df1980f2ec1afc55269d1a3b43e25d7dfed32a88cad1/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/f93412a5b099910bc0875a9d17b2d3b5c16eea7a1b50f55e2fd3d82537425cf0/contract';
import endContract from '../../snapshots/f93412a5b099910bc0875a9d17b2d3b5c16eea7a1b50f55e2fd3d82537425cf0/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createIndex({
        schema: 'public',
        table: 'order_status_history',
        index: 'order_status_history_order_id_idx_39ad19ad',
        columns: ['order_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'user_addresses',
        index: 'user_addresses_user_id_idx_6c952402',
        columns: ['user_id'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'order_status_history',
        foreignKey: {
          name: 'order_status_history_order_id_fkey',
          columns: ['order_id'],
          references: { schema: 'public', table: 'orders', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'user_addresses',
        foreignKey: {
          name: 'user_addresses_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
