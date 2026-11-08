/**
 * 冒烟测试：确认完整应用（含 agent 路由）可以组装并响应基础请求。
 * 不会真正触发 LLM 调用。
 */
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Elysia } from "elysia";
import { authPlugin } from "../src/plugins/auth-plugin";
import { authRoutes } from "../src/routes/auth";
import { foodRoutes } from "../src/routes/food";
import { agentRoutes } from "../src/routes/agent";

let app: Elysia;
let base: string;

beforeAll(() => {
  app = new Elysia()
    .use(authPlugin)
    .use(authRoutes(authPlugin))
    .use(foodRoutes(authPlugin))
    .use(agentRoutes)
    .get("/health", () => ({ ok: true }))
    .listen({ port: 0, hostname: "127.0.0.1" });

  base = `http://127.0.0.1:${app.server!.port}`;
});

afterAll(() => {
  app.stop();
});

describe("应用组装冒烟测试", () => {
  test("所有路由模块可正常挂载", async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  test("agent 路由已注册：非法请求体返回 422（不触发 LLM）", async () => {
    const res = await fetch(`${base}/agent/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: "not-an-array" }),
    });

    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("agent 路由缺少 messages 时返回 422", async () => {
    const res = await fetch(`${base}/agent/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(422);
  });

  test("auth 与 food 路由均可访问", async () => {
    const me = await fetch(`${base}/auth/me`);
    expect(me.status).toBe(401);

    const menu = await fetch(`${base}/food/menu`);
    expect(menu.status).toBe(200);
  });
});
