import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { api, createTestUser, startServer, uniqueEmail, type TestServer } from "./helpers.ts";

let server: TestServer;

beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.close();
});

describe("认证接口 /auth", () => {
  test("GET /health 健康检查", async () => {
    const res = await api(server.url, "/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  describe("POST /auth/register", () => {
    test("注册成功返回 id/email/name，且不含 password", async () => {
      const email = uniqueEmail("reg");
      const res = await api(server.url, "/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password: "secret123", name: "Alice" }),
      });

      expect(res.status).toBe(200);
      expect(res.body.id).toBeTruthy();
      expect(res.body.email).toBe(email);
      expect(res.body.name).toBe("Alice");
      expect(res.body.password).toBeUndefined();
    });

    test("重复邮箱返回 409", async () => {
      const email = uniqueEmail("dup");
      const payload = { email, password: "secret123" };

      const first = await api(server.url, "/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      expect(first.status).toBe(200);

      const second = await api(server.url, "/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      expect(second.status).toBe(409);
    });

    test("非法邮箱格式被拒绝", async () => {
      const res = await api(server.url, "/auth/register", {
        method: "POST",
        body: JSON.stringify({ email: "not-an-email", password: "secret123" }),
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    test("密码存储为哈希而非明文", async () => {
      const { db } = await import("../src/prisma/db");
      const { email, password } = await createTestUser(server.url);

      const row = await db.orm.public.User.select("password").where({ email }).first();
      expect(row).toBeTruthy();
      expect(row!.password).not.toBe(password);
      expect(String(row!.password)).toMatch(/^\$argon2/);
    });
  });

  describe("POST /auth/login", () => {
    test("正确凭据返回双令牌", async () => {
      const email = uniqueEmail("login");
      await api(server.url, "/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password: "secret123" }),
      });

      const res = await api(server.url, "/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password: "secret123" }),
      });

      expect(res.status).toBe(200);
      expect(typeof res.body.accessToken).toBe("string");
      expect(typeof res.body.refreshToken).toBe("string");
      expect(res.body.tokenType).toBe("Bearer");
    });

    test("密码错误与账号不存在返回相同提示（防枚举）", async () => {
      const user = await createTestUser(server.url);

      const wrongPassword = await api(server.url, "/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: user.email, password: "wrong-password" }),
      });

      const noSuchUser = await api(server.url, "/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: uniqueEmail("ghost"), password: "secret123" }),
      });

      expect(wrongPassword.status).toBe(401);
      expect(noSuchUser.status).toBe(401);
      expect(wrongPassword.body).toEqual(noSuchUser.body);
    });
  });

  describe("GET /auth/me", () => {
    test("无 token 返回 401", async () => {
      const res = await api(server.url, "/auth/me");
      expect(res.status).toBe(401);
    });

    test("无效 token 返回 401", async () => {
      const res = await api(server.url, "/auth/me", { token: "invalid.token.value" });
      expect(res.status).toBe(401);
    });

    test("有效 token 返回当前用户，且不含 password", async () => {
      const user = await createTestUser(server.url);
      const res = await api(server.url, "/auth/me", { token: user.accessToken });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(user.userId);
      expect(res.body.email).toBe(user.email);
      expect(res.body.password).toBeUndefined();
    });
  });

  describe("POST /auth/refresh", () => {
    test("用 refreshToken 换取新令牌", async () => {
      const email = uniqueEmail("refresh");
      await api(server.url, "/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password: "secret123" }),
      });

      const login = await api(server.url, "/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password: "secret123" }),
      });

      const refreshed = await api(server.url, "/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken: login.body.refreshToken }),
      });

      expect(refreshed.status).toBe(200);
      expect(typeof refreshed.body.accessToken).toBe("string");

      // 新 access token 可用
      const me = await api(server.url, "/auth/me", { token: refreshed.body.accessToken });
      expect(me.status).toBe(200);
    });

    test("拒绝用 accessToken 冒充 refreshToken", async () => {
      const user = await createTestUser(server.url);

      const res = await api(server.url, "/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken: user.accessToken }),
      });

      expect(res.status).toBe(401);
    });

    test("无效 refreshToken 返回 401", async () => {
      const res = await api(server.url, "/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken: "garbage" }),
      });
      expect(res.status).toBe(401);
    });
  });
});
