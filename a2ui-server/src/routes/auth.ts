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

function stripUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    avatar: user.avatar,
  };
}

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

    return { success: true, data: { token, user: stripUser(user) } };
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

    return { success: true, data: { token, user: stripUser(user) } };
  }, {
    body: t.Object({
      email: t.String({ format: 'email' }),
    }),
    detail: { summary: 'Login with email' },
  })

  .get('/me', async ({ headers }) => {
    const authUser = await verifyToken(headers);
    if (!authUser) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } };
    }

    const rows = await coreDb.select().from(users).where(eq(users.id, authUser.id));
    const user = rows[0];
    if (!user) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'User not found' } };
    }

    return { success: true, data: { user: stripUser(user) } };
  }, {
    detail: { summary: 'Get current user info' },
  })

  .put('/profile', async ({ body, headers }) => {
    const authUser = await verifyToken(headers);
    if (!authUser) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } };
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.avatar !== undefined) updateData.avatar = body.avatar;
    updateData.updatedAt = new Date();

    const [updated] = await coreDb
      .update(users)
      .set(updateData)
      .where(eq(users.id, authUser.id))
      .returning();

    if (!updated) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'User not found' } };
    }

    return {
      success: true,
      data: { user: stripUser(updated) },
    };
  }, {
    body: t.Object({
      name: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
      phone: t.Optional(t.String({ minLength: 1, maxLength: 20 })),
      avatar: t.Optional(t.String()),
    }),
    detail: { summary: 'Update current user profile' },
  });
