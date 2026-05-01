import { jwtVerify } from 'jose';
import { Elysia } from 'elysia';
import { config } from '../config.js';

export interface AuthUser {
  id: string;
  email: string;
}

export async function verifyToken(headers: Record<string, string | undefined>): Promise<AuthUser | null> {
  const authHeader = headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  try {
    const secret = new TextEncoder().encode(config.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, { clockTolerance: 60 });
    return { id: payload.sub as string, email: payload.email as string };
  } catch {
    return null;
  }
}
