#!/usr/bin/env -S bun
import type { Contract as End } from '../../snapshots/c598f0af2c382cadfa4e170e5cf0ffbe02d3481f28b72c40756f4b1aa7b1cc9f/contract';
import endContract from '../../snapshots/c598f0af2c382cadfa4e170e5cf0ffbe02d3481f28b72c40756f4b1aa7b1cc9f/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/f93412a5b099910bc0875a9d17b2d3b5c16eea7a1b50f55e2fd3d82537425cf0/contract';
import startContract from '../../snapshots/f93412a5b099910bc0875a9d17b2d3b5c16eea7a1b50f55e2fd3d82537425cf0/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropIndex({
        schema: 'public',
        table: 'user_addresses',
        index: 'user_addresses_user_id_idx_6c952402',
      }),
      this.addUnique({
        schema: 'public',
        table: 'user_addresses',
        constraint: 'user_addresses_user_id_key',
        columns: ['user_id'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
