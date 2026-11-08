import jwt from "@elysia/jwt";
import type { HTTPHeaders } from "elysia";
export interface AuthUser {
  id: string;
  email: string;
}
/**
 *
 * @param headers
 * @returns
 */
export async function verify(headers: HTTPHeaders) {
  // 前端将email, password 传入。 数据库中取出email, hash-password。
  // 这里使用verify 确认密码是否正确。 返回使用jwt生成的token, 之后就验证就行了。
  const { hash, verify } = Bun.password;
  const authHeader = headers.authorization;

  if (!authHeader?.startsWith("Bearer")) return null;

  try {
  } catch (c) {
    return null;
  }
}
