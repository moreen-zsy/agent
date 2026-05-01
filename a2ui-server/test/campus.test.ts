import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Elysia } from 'elysia';
import { authRoutes } from '../src/routes/auth.js';
import { campusRoutes } from '../src/routes/campus.js';
import { cleanDatabase } from './setup.js';
import { campusDb } from '../src/db/campus/index.js';
import { facilities } from '../src/db/campus/schema.js';

const app = new Elysia().use(authRoutes).use(campusRoutes);

describe('Campus API', () => {
  let token: string;
  let facilityId: string;

  beforeAll(async () => {
    await cleanDatabase();

    // Seed a test facility
    const [facility] = await campusDb.insert(facilities).values({
      name: 'Test Gym',
      type: 'gym',
      location: 'Test Building',
      capacity: 10,
    }).returning();
    facilityId = facility.id;

    // Register and login a test user
    await app.handle(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'campus-test@example.com', name: 'Campus Test' }),
      })
    );

    const loginRes = await app.handle(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'campus-test@example.com' }),
      })
    );
    const loginJson = await loginRes.json();
    token = loginJson.data.token;
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  it('should get facilities with pagination', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/campus/facilities')
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toBeDefined();
    expect(json.pagination).toBeDefined();
  });

  it('should get facilities filtered by type', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/campus/facilities?type=gym')
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.length).toBeGreaterThan(0);
  });

  it('should create a reservation', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/campus/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          facilityId: facilityId,
          date: '2025-01-01',
          timeSlot: '09:00-11:00',
        }),
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.status).toBe('confirmed');
  });

  it('should get user reservations', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/campus/reservations', {
        headers: { Authorization: `Bearer ${token}` },
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toBeDefined();
    expect(json.pagination).toBeDefined();
  });
});
