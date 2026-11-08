#!/usr/bin/env -S bun
import type { Contract as Start } from '../../snapshots/420124342f46a7b624abe5d71553d73a9b43438e04ef60d9421ce9c19060d884/contract';
import startContract from '../../snapshots/420124342f46a7b624abe5d71553d73a9b43438e04ef60d9421ce9c19060d884/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e0704bf582d316bddb20df1980f2ec1afc55269d1a3b43e25d7dfed32a88cad1/contract';
import endContract from '../../snapshots/e0704bf582d316bddb20df1980f2ec1afc55269d1a3b43e25d7dfed32a88cad1/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createIndex({
        schema: 'public',
        table: 'orders',
        index: 'orders_user_id_idx_6c952402',
        columns: ['user_id'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'orders',
        foreignKey: {
          name: 'orders_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
