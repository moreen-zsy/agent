#!/usr/bin/env -S bun
import type { Contract as End } from '../../snapshots/4baa19b768a4c71b889649657bdac7b99b6bdfe161f26836299868a04c3b98db/contract';
import endContract from '../../snapshots/4baa19b768a4c71b889649657bdac7b99b6bdfe161f26836299868a04c3b98db/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/c598f0af2c382cadfa4e170e5cf0ffbe02d3481f28b72c40756f4b1aa7b1cc9f/contract';
import startContract from '../../snapshots/c598f0af2c382cadfa4e170e5cf0ffbe02d3481f28b72c40756f4b1aa7b1cc9f/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumnWithTemporaryDefault({
        schema: 'public',
        table: 'users',
        column: 'password',
        type: 'character varying(255)',
        temporaryDefault: sql`''`,
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
