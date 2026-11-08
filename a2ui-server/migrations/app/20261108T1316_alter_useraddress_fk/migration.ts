#!/usr/bin/env -S bun
import type { Contract as Start } from '../../snapshots/4baa19b768a4c71b889649657bdac7b99b6bdfe161f26836299868a04c3b98db/contract';
import startContract from '../../snapshots/4baa19b768a4c71b889649657bdac7b99b6bdfe161f26836299868a04c3b98db/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/786c4275b7bdc2306ff0b9c83136fc0334d900002e959084659eb19956f3c26f/contract';
import endContract from '../../snapshots/786c4275b7bdc2306ff0b9c83136fc0334d900002e959084659eb19956f3c26f/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropConstraint({
        schema: 'public',
        table: 'user_addresses',
        constraint: 'user_addresses_user_id_key',
      }),
      this.createIndex({
        schema: 'public',
        table: 'user_addresses',
        index: 'user_addresses_user_id_idx_6c952402',
        columns: ['user_id'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
