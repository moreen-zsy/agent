/**
 * 认证路由
 */

import { Elysia, t } from 'elysia';
import { SignJWT } from 'jose';
import { coreDb } from '../db/core/index.js';
import { users } from '../db/core/schema.js';
import { eq } from 'drizzle-orm';
import { config } from '../config.js';
import { verifyToken } from '../middleware/auth.js';

export const authRoutes = new Elysia({ prefix: '/api/auth', detail: { tags: ['Auth'] } })
  .post('/register', async ({ body }) => {
    const { email, name } = body;

    const existing = await coreDb.select().from(users).where(eq(users.email, email));
    if (existing.length > 0) {
      return { success: false, error: { code: 'USER_EXISTS', message: 'User already exists' } };
    }

    const [user] = await coreDb.insert(users).values({ email, name }).returning();
    if (!user) return { success: false, error: { code: 'REGISTER_FAILED', message: 'Registration failed' } };

    const token = await new SignJWT({ sub: user.id, email: user.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(new TextEncoder().encode(config.JWT_SECRET));

    return { success: true, data: { token, user: { id: user.id, email: user.email, name: user.name } } };
  }, {
    body: t.Object({
      email: t.String({ format: 'email' }),
      name: t.String({ minLength: 1, maxLength: 255 }),
    }),
    detail: { summary: 'Register a new user' },
  })

  .post('/login', async ({ body }) => {
    const { email } = body;

    const rows = await coreDb.select().from(users).where(eq(users.email, email));
    const user = rows[0];
    if (!user) {
      return { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' } };
    }

    const token = await new SignJWT({ sub: user.id, email: user.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(new TextEncoder().encode(config.JWT_SECRET));

    return { success: true, data: { token, user: { id: user.id, email: user.email, name: user.name } } };
  }, {
    body: t.Object({
      email: t.String({ format: 'email' }),
    }),
    detail: { summary: 'Login with email' },
  })

  .get('/me', async ({ headers }) => {
    const user = await verifyToken(headers);
    if (!user) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } };
    }
    return { success: true, data: { user } };
  }, {
    detail: { summary: 'Get current user info' },
  });
