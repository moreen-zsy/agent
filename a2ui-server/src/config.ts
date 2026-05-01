import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000').transform(Number),
  DATABASE_URL_CORE: z.string().default('postgresql://a2ui:a2ui_password@localhost:5432/a2ui_core'),
  DATABASE_URL_FOOD: z.string().default('postgresql://a2ui:a2ui_password@localhost:5432/a2ui_food'),
  DATABASE_URL_CAMPUS: z.string().default('postgresql://a2ui:a2ui_password@localhost:5432/a2ui_campus'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  OPENAI_API_KEY: z.string().default('test-key'),
  JWT_SECRET: z.string().default('test-secret-for-development-only'),
  FOOD_MCP_URL: z.string().optional(),
  CAMPUS_MCP_URL: z.string().optional(),
});

export type Config = z.infer<typeof configSchema>;

export const config: Config = configSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  DATABASE_URL_CORE: process.env.DATABASE_URL_CORE,
  DATABASE_URL_FOOD: process.env.DATABASE_URL_FOOD,
  DATABASE_URL_CAMPUS: process.env.DATABASE_URL_CAMPUS,
  REDIS_URL: process.env.REDIS_URL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  JWT_SECRET: process.env.JWT_SECRET,
  FOOD_MCP_URL: process.env.FOOD_MCP_URL,
  CAMPUS_MCP_URL: process.env.CAMPUS_MCP_URL,
});
