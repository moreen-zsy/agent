import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Elysia } from 'elysia';
import { authRoutes } from '../src/routes/auth.js';
import { cleanDatabase } from './setup.js';

const app = new Elysia().use(authRoutes);

describe('Auth API', () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  it('should register a new user', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', name: 'Test User' }),
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.token).toBeDefined();
    expect(json.data.user.email).toBe('test@example.com');
  });

  it('should not register duplicate user', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', name: 'Test User' }),
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('USER_EXISTS');
  });

  it('should login existing user', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.token).toBeDefined();
  });

  it('should get current user with token', async () => {
    const loginRes = await app.handle(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      })
    );
    const loginJson = await loginRes.json();
    const token = loginJson.data.token;

    const meRes = await app.handle(
      new Request('http://localhost/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
    );

    expect(meRes.status).toBe(200);
    const meJson = await meRes.json();
    expect(meJson.success).toBe(true);
    expect(meJson.data.user.email).toBe('test@example.com');
  });
});
