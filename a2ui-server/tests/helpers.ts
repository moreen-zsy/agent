/**
 * 测试辅助工具
 *
 * 提供：启动/关闭服务、注册登录、带 token 请求等通用能力。
 * 服务在测试进程内以随机端口启动，避免与其他进程冲突。
 */

import { Elysia } from "elysia";
import { authPlugin } from "../src/plugins/auth-plugin";
import { authRoutes } from "../src/routes/auth";
import { foodRoutes } from "../src/routes/food";

export interface TestServer {
  url: string;
  close: () => Promise<void>;
}

/** 启动用于测试的应用实例（不含 agent 路由，避免真实 LLM 调用） */
export async function startServer(port = 0): Promise<TestServer> {
  const app = new Elysia()
    .use(authPlugin)
    .use(authRoutes(authPlugin))
    .use(foodRoutes(authPlugin))
    .get("/health", () => ({ ok: true }))
    .listen({ port, hostname: "127.0.0.1" });

  const actualPort = app.server?.port;
  if (!actualPort) throw new Error("测试服务器启动失败");

  return {
    url: `http://127.0.0.1:${actualPort}`,
    close: async () => {
      app.stop();
    },
  };
}

export interface TestUser {
  email: string;
  password: string;
  accessToken: string;
  userId: string;
}

let seq = 0;

/** 生成唯一的测试邮箱 */
export function uniqueEmail(prefix = "test"): string {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}@a2ui.test`;
}

/** 注册并登录一个测试用户 */
export async function createTestUser(baseUrl: string, password = "secret123"): Promise<TestUser> {
  const email = uniqueEmail();

  const regRes = await fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name: "Test User" }),
  });

  if (!regRes.ok) {
    throw new Error(`注册失败: ${regRes.status} ${await regRes.text()}`);
  }
  const reg = (await regRes.json()) as { id: string };

  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!loginRes.ok) {
    throw new Error(`登录失败: ${loginRes.status} ${await loginRes.text()}`);
  }
  const login = (await loginRes.json()) as { accessToken: string };

  return { email, password, accessToken: login.accessToken, userId: reg.id };
}

/** 带鉴权的 JSON 请求 */
export async function api(
  baseUrl: string,
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<{ status: number; body: any }> {
  const { token, headers, ...rest } = init;

  const res = await fetch(`${baseUrl}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers as Record<string, string> | undefined),
    },
  });

  const text = await res.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    // 非 JSON 响应保留原始文本
  }

  return { status: res.status, body };
}
