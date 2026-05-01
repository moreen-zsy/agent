#!/usr/bin/env bun
/**
 * Campus MCP Server
 * 通过 stdio 与 MCP Client 通信，调用 a2ui-server 的 Elysia REST API
 *
 * 工具列表:
 * - auth_register / auth_login: 注册或登录，自动缓存 JWT
 * - query_facilities / get_facility_detail: 浏览设施（无需登录）
 * - book_facility / get_reservations / update_reservation / cancel_reservation: 预约管理（需登录）
 * - pay_fee / query_payments / update_payment: 缴费管理（需登录）
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ───────────────────────────────────────────────────────────────
// 1. API 客户端：会话级 JWT 缓存
// ───────────────────────────────────────────────────────────────

const API_BASE = process.env.A2UI_API_BASE || "http://localhost:3000";
let authToken = "";

type ApiOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  auth?: boolean;
};

async function apiCall(path: string, options: ApiOptions = {}) {
  const { method = "GET", query, body, auth = false } = options;

  const url = new URL(API_BASE + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    }
  }

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    if (!authToken) {
      return {
        error: "未登录，请先调用 auth_register 或 auth_login",
        code: "NEED_LOGIN",
      };
    }
    headers.Authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: `非 JSON 响应 (${res.status})`, raw: text };
  }
}

const ok = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

// ───────────────────────────────────────────────────────────────
// 2. 创建 McpServer
// ───────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "campus-mcp",
  version: "1.0.0",
});

// ───────────────────────────────────────────────────────────────
// 3. 注册工具
// ───────────────────────────────────────────────────────────────

// ── 认证 ────────────────────────────────────────────────────────

server.registerTool(
  "auth_register",
  {
    description:
      "通过邮箱注册新用户并获取 JWT。注册后 token 会缓存在 MCP 服务进程内，后续需要登录的工具会自动携带。",
    inputSchema: {
      email: z.string().email().describe("用户邮箱"),
      name: z.string().min(1).describe("用户姓名"),
    },
  },
  async ({ email, name }) => {
    const res = await apiCall("/api/auth/register", {
      method: "POST",
      body: { email, name },
    });
    if (res?.success && res?.data?.token) {
      authToken = res.data.token;
    }
    return ok(res);
  },
);

server.registerTool(
  "auth_login",
  {
    description: "通过邮箱登录，获取 JWT 并缓存到 MCP 服务进程内",
    inputSchema: {
      email: z.string().email().describe("用户邮箱"),
    },
  },
  async ({ email }) => {
    const res = await apiCall("/api/auth/login", {
      method: "POST",
      body: { email },
    });
    if (res?.success && res?.data?.token) {
      authToken = res.data.token;
    }
    return ok(res);
  },
);

// ── 设施（公开） ────────────────────────────────────────────────

server.registerTool(
  "query_facilities",
  {
    description: "查询校园设施列表，支持按类型筛选、搜索、分页。无需登录。",
    inputSchema: {
      type: z
        .enum(["gym", "study_room", "lab"])
        .optional()
        .describe("设施类型"),
      search: z.string().optional().describe("按名称模糊搜索"),
      page: z.number().int().min(1).optional().describe("页码，默认 1"),
      pageSize: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("每页条数，默认 20"),
    },
  },
  async ({ type, search, page, pageSize }) => {
    const res = await apiCall("/api/campus/facilities", {
      query: { type, search, page, pageSize },
    });
    return ok(res);
  },
);

server.registerTool(
  "get_facility_detail",
  {
    description: "根据设施 ID 获取详情。无需登录。",
    inputSchema: {
      id: z.string().min(1).describe("设施 UUID"),
    },
  },
  async ({ id }) => {
    const res = await apiCall(
      `/api/campus/facilities/${encodeURIComponent(id)}`,
    );
    return ok(res);
  },
);

// ── 预约（需登录） ──────────────────────────────────────────────

server.registerTool(
  "book_facility",
  {
    description: "预约校园设施。需先登录。",
    inputSchema: {
      facilityId: z.string().min(1).describe("设施 UUID"),
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .describe("日期，格式 YYYY-MM-DD"),
      timeSlot: z
        .string()
        .min(1)
        .describe("时间段，例如 09:00-11:00"),
    },
  },
  async ({ facilityId, date, timeSlot }) => {
    const res = await apiCall("/api/campus/reservations", {
      method: "POST",
      body: { facilityId, date, timeSlot },
      auth: true,
    });
    return ok(res);
  },
);

server.registerTool(
  "get_reservations",
  {
    description: "获取当前登录用户的预约列表。需先登录。",
    inputSchema: {
      page: z.number().int().min(1).optional().describe("页码，默认 1"),
      pageSize: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("每页条数，默认 20"),
    },
  },
  async ({ page, pageSize }) => {
    const res = await apiCall("/api/campus/reservations", {
      query: { page, pageSize },
      auth: true,
    });
    return ok(res);
  },
);

server.registerTool(
  "update_reservation",
  {
    description: "更新预约状态（仅创建者可操作）。需先登录。",
    inputSchema: {
      id: z.string().min(1).describe("预约 UUID"),
      status: z
        .enum(["pending", "confirmed", "cancelled"])
        .describe("新状态"),
    },
  },
  async ({ id, status }) => {
    const res = await apiCall(
      `/api/campus/reservations/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        body: { status },
        auth: true,
      },
    );
    return ok(res);
  },
);

server.registerTool(
  "cancel_reservation",
  {
    description: "取消/删除预约（仅创建者可操作）。需先登录。",
    inputSchema: {
      id: z.string().min(1).describe("预约 UUID"),
    },
  },
  async ({ id }) => {
    const res = await apiCall(
      `/api/campus/reservations/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        auth: true,
      },
    );
    return ok(res);
  },
);

// ── 缴费（需登录） ──────────────────────────────────────────────

server.registerTool(
  "pay_fee",
  {
    description:
      "创建一条缴费记录。type 可选 tuition(学费)/utility(水电)/network(网费)。需先登录。",
    inputSchema: {
      type: z
        .enum(["tuition", "utility", "network"])
        .describe("费用类型"),
      amount: z.number().positive().describe("金额（元）"),
      description: z.string().optional().describe("缴费说明"),
    },
  },
  async ({ type, amount, description }) => {
    const res = await apiCall("/api/campus/payments", {
      method: "POST",
      body: { type, amount, description },
      auth: true,
    });
    return ok(res);
  },
);

server.registerTool(
  "query_payments",
  {
    description: "查询当前登录用户的缴费记录。需先登录。",
    inputSchema: {
      page: z.number().int().min(1).optional().describe("页码，默认 1"),
      pageSize: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("每页条数，默认 20"),
      type: z
        .enum(["tuition", "utility", "network"])
        .optional()
        .describe("按费用类型过滤"),
    },
  },
  async ({ page, pageSize, type }) => {
    const res = await apiCall("/api/campus/payments", {
      query: { page, pageSize, type },
      auth: true,
    });
    return ok(res);
  },
);

server.registerTool(
  "update_payment",
  {
    description: "更新缴费状态。需先登录。",
    inputSchema: {
      id: z.string().min(1).describe("缴费记录 UUID"),
      status: z
        .enum(["pending", "paid", "failed"])
        .describe("新状态"),
    },
  },
  async ({ id, status }) => {
    const res = await apiCall(
      `/api/campus/payments/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        body: { status },
        auth: true,
      },
    );
    return ok(res);
  },
);

// ───────────────────────────────────────────────────────────────
// 4. 启动 stdio 传输
// ───────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[campus-mcp] connected, API_BASE=${API_BASE}`);
}

main().catch((err) => {
  console.error("[campus-mcp] startup failed:", err);
  process.exit(1);
});
