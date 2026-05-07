#!/usr/bin/env bun
/**
 * Campus MCP Server
 * 通过 stdio 与 MCP Client 通信，调用 a2ui-server 的 Elysia REST API
 *
 * 工具列表:
 * - query_facilities / get_facility_detail: 浏览设施（公开）
 * - book_facility / get_reservations / update_reservation / cancel_reservation: 预约管理（需传入 JWT Token）
 * - pay_fee / query_payments / update_payment: 缴费管理（需传入 JWT Token）
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ───────────────────────────────────────────────────────────────
// 1. API 客户端
// ───────────────────────────────────────────────────────────────

const API_BASE = process.env.A2UI_API_BASE || "http://localhost:3000";

type ApiOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  token?: string;
};

async function apiCall(path: string, options: ApiOptions = {}) {
  const { method = "GET", query, body, token } = options;

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
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
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
  } catch (err) {
    return { error: `请求失败: ${(err as Error).message}`, path: url.toString() };
  }
}

const ok = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

// 从环境变量获取默认 token（由 Agent Engine 注入）
const DEFAULT_TOKEN = process.env.JWT_TOKEN;

function resolveToken(token?: string): string | undefined {
  return token || DEFAULT_TOKEN;
}

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

// ── 设施（公开） ────────────────────────────────────────────────

server.registerTool(
  "query_facilities",
  {
    description: "查询校园设施列表，支持按类型筛选、搜索、分页。获取数据后，必须调用 render_a2ui 工具将结果渲染为 A2UI v0.9 UI 组件。",
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
    description: "根据设施 ID 获取详情。获取数据后，必须调用 render_a2ui 工具将结果渲染为 A2UI v0.9 UI 组件。",
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

// ── 预约（需 Token） ────────────────────────────────────────────

server.registerTool(
  "book_facility",
  {
    description: "预约校园设施。需传入 JWT Token。",
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
      token: z.string().optional().describe("JWT 认证 Token（可选，服务端自动注入）"),
    },
  },
  async ({ facilityId, date, timeSlot, token }) => {
    const res = await apiCall("/api/campus/reservations", {
      method: "POST",
      body: { facilityId, date, timeSlot },
      token: resolveToken(token),
    });
    return ok(res);
  },
);

server.registerTool(
  "get_reservations",
  {
    description: "获取当前登录用户的预约列表。需传入 JWT Token。",
    inputSchema: {
      page: z.number().int().min(1).optional().describe("页码，默认 1"),
      pageSize: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("每页条数，默认 20"),
      token: z.string().optional().describe("JWT 认证 Token（可选，服务端自动注入）"),
    },
  },
  async ({ page, pageSize, token }) => {
    const res = await apiCall("/api/campus/reservations", {
      query: { page, pageSize },
      token: resolveToken(token),
    });
    return ok(res);
  },
);

server.registerTool(
  "update_reservation",
  {
    description: "更新预约状态（仅创建者可操作）。需传入 JWT Token。",
    inputSchema: {
      id: z.string().min(1).describe("预约 UUID"),
      status: z
        .enum(["pending", "confirmed", "cancelled"])
        .describe("新状态"),
      token: z.string().optional().describe("JWT 认证 Token（可选，服务端自动注入）"),
    },
  },
  async ({ id, status, token }) => {
    const res = await apiCall(
      `/api/campus/reservations/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        body: { status },
        token: resolveToken(token),
      },
    );
    return ok(res);
  },
);

server.registerTool(
  "cancel_reservation",
  {
    description: "取消/删除预约（仅创建者可操作）。需传入 JWT Token。",
    inputSchema: {
      id: z.string().min(1).describe("预约 UUID"),
      token: z.string().optional().describe("JWT 认证 Token（可选，服务端自动注入）"),
    },
  },
  async ({ id, token }) => {
    const res = await apiCall(
      `/api/campus/reservations/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        token: resolveToken(token),
      },
    );
    return ok(res);
  },
);

// ── 缴费（需 Token） ────────────────────────────────────────────

server.registerTool(
  "pay_fee",
  {
    description:
      "创建一条缴费记录。type 可选 tuition(学费)/utility(水电)/network(网费)。需传入 JWT Token。",
    inputSchema: {
      type: z
        .enum(["tuition", "utility", "network"])
        .describe("费用类型"),
      amount: z.number().positive().describe("金额（元）"),
      description: z.string().optional().describe("缴费说明"),
      token: z.string().optional().describe("JWT 认证 Token（可选，服务端自动注入）"),
    },
  },
  async ({ type, amount, description, token }) => {
    const res = await apiCall("/api/campus/payments", {
      method: "POST",
      body: { type, amount, description },
      token: resolveToken(token),
    });
    return ok(res);
  },
);

server.registerTool(
  "query_payments",
  {
    description: "查询当前登录用户的缴费记录。需传入 JWT Token。",
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
      token: z.string().optional().describe("JWT 认证 Token（可选，服务端自动注入）"),
    },
  },
  async ({ page, pageSize, type, token }) => {
    const res = await apiCall("/api/campus/payments", {
      query: { page, pageSize, type },
      token: resolveToken(token),
    });
    return ok(res);
  },
);

server.registerTool(
  "update_payment",
  {
    description: "更新缴费状态。需传入 JWT Token。",
    inputSchema: {
      id: z.string().min(1).describe("缴费记录 UUID"),
      status: z
        .enum(["pending", "paid", "failed"])
        .describe("新状态"),
      token: z.string().optional().describe("JWT 认证 Token（可选，服务端自动注入）"),
    },
  },
  async ({ id, status, token }) => {
    const res = await apiCall(
      `/api/campus/payments/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        body: { status },
        token: resolveToken(token),
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
