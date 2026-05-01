import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL_FOOD || 'postgresql://a2ui:a2ui_password@localhost:5433/a2ui_food';

const client = postgres(connectionString, { max: 10 });
export const foodDb = drizzle(client, { schema });

export * from './schema.js';
