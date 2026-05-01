import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Elysia } from 'elysia';
import { authRoutes } from '../src/routes/auth.js';
import { foodRoutes } from '../src/routes/food.js';
import { cleanDatabase } from './setup.js';
import { foodDb } from '../src/db/food/index.js';
import { dishes } from '../src/db/food/schema.js';

const app = new Elysia().use(authRoutes).use(foodRoutes);

describe('Food API', () => {
  let token: string;
  let userId: string;

  beforeAll(async () => {
    await cleanDatabase();

    // Seed a test dish
    await foodDb.insert(dishes).values({
      name: 'Test Dish',
      description: 'A test dish',
      price: '25.00',
      category: 'main',
    });

    // Register and login a test user
    await app.handle(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'food-test@example.com', name: 'Food Test' }),
      })
    );

    const loginRes = await app.handle(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'food-test@example.com' }),
      })
    );
    const loginJson = await loginRes.json();
    token = loginJson.data.token;
    userId = loginJson.data.user.id;
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  it('should get menu with pagination', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/food/menu')
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toBeDefined();
    expect(json.pagination).toBeDefined();
    expect(json.pagination.page).toBe(1);
  });

  it('should get menu filtered by category', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/food/menu?category=main')
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.length).toBeGreaterThan(0);
  });

  it('should create an order', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/food/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          items: [{ dishId: 'test-dish-id', name: 'Test Dish', quantity: 2, price: 25 }],
          address: 'Test Address',
        }),
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.userId).toBe(userId);
  });

  it('should get user orders', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/food/orders', {
        headers: { Authorization: `Bearer ${token}` },
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toBeDefined();
    expect(json.pagination).toBeDefined();
  });
});
