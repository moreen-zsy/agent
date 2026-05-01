#!/usr/bin/env bun
/**
 * Food MCP Server
 * 通过 stdio 与 MCP Client 通信，调用 a2ui-server 的 Elysia REST API
 *
 * 工具列表:
 * - auth_register / auth_login: 注册或登录，自动缓存 JWT
 * - query_menu / get_dish_detail: 浏览菜单（无需登录）
 * - place_order / get_orders / get_order_detail / update_order_status / cancel_order: 订单管理（需登录）
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
  name: "food-mcp",
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

// ── 菜单（公开） ────────────────────────────────────────────────

server.registerTool(
  "query_menu",
  {
    description:
      "查询菜单列表，支持按分类筛选、关键词搜索、分页。无需登录。",
    inputSchema: {
      category: z
        .enum(["signature", "main", "dessert", "drink", "appetizer"])
        .optional()
        .describe("菜品分类"),
      search: z.string().optional().describe("按菜品名称模糊搜索"),
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
  async ({ category, search, page, pageSize }) => {
    const res = await apiCall("/api/food/menu", {
      query: { category, search, page, pageSize },
    });
    return ok(res);
  },
);

server.registerTool(
  "get_dish_detail",
  {
    description: "根据菜品 ID 获取菜品详情。无需登录。",
    inputSchema: {
      id: z.string().min(1).describe("菜品 UUID"),
    },
  },
  async ({ id }) => {
    const res = await apiCall(`/api/food/menu/${encodeURIComponent(id)}`);
    return ok(res);
  },
);

// ── 订单（需登录） ──────────────────────────────────────────────

server.registerTool(
  "place_order",
  {
    description: "下单。需先登录。",
    inputSchema: {
      items: z
        .array(
          z.object({
            dishId: z.string().min(1),
            name: z.string().min(1),
            quantity: z.number().int().min(1),
            price: z.number().nonnegative(),
          }),
        )
        .min(1)
        .describe("订单菜品列表"),
      address: z.string().min(1).describe("配送地址"),
    },
  },
  async ({ items, address }) => {
    const res = await apiCall("/api/food/order", {
      method: "POST",
      body: { items, address },
      auth: true,
    });
    return ok(res);
  },
);

server.registerTool(
  "get_orders",
  {
    description: "获取当前登录用户的订单列表。需先登录。",
    inputSchema: {
      page: z.number().int().min(1).optional().describe("页码，默认 1"),
      pageSize: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("每页条数，默认 20"),
      status: z
        .enum([
          "pending",
          "confirmed",
          "preparing",
          "ready",
          "delivered",
          "cancelled",
        ])
        .optional()
        .describe("按订单状态过滤"),
    },
  },
  async ({ page, pageSize, status }) => {
    const res = await apiCall("/api/food/orders", {
      query: { page, pageSize, status },
      auth: true,
    });
    return ok(res);
  },
);

server.registerTool(
  "get_order_detail",
  {
    description: "获取单个订单详情。需先登录。",
    inputSchema: {
      id: z.string().min(1).describe("订单 UUID"),
    },
  },
  async ({ id }) => {
    const res = await apiCall(`/api/food/orders/${encodeURIComponent(id)}`, {
      auth: true,
    });
    return ok(res);
  },
);

server.registerTool(
  "update_order_status",
  {
    description:
      "更新订单状态（仅订单创建者可操作）。需先登录。",
    inputSchema: {
      id: z.string().min(1).describe("订单 UUID"),
      status: z
        .enum([
          "pending",
          "confirmed",
          "preparing",
          "ready",
          "delivered",
          "cancelled",
        ])
        .describe("新状态"),
    },
  },
  async ({ id, status }) => {
    const res = await apiCall(`/api/food/orders/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: { status },
      auth: true,
    });
    return ok(res);
  },
);

server.registerTool(
  "cancel_order",
  {
    description:
      "删除订单（仅订单创建者可操作）。需先登录。",
    inputSchema: {
      id: z.string().min(1).describe("订单 UUID"),
    },
  },
  async ({ id }) => {
    const res = await apiCall(`/api/food/orders/${encodeURIComponent(id)}`, {
      method: "DELETE",
      auth: true,
    });
    return ok(res);
  },
);

// ───────────────────────────────────────────────────────────────
// 4. 启动 stdio 传输
// ───────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[food-mcp] connected, API_BASE=${API_BASE}`);
}

main().catch((err) => {
  console.error("[food-mcp] startup failed:", err);
  process.exit(1);
});
