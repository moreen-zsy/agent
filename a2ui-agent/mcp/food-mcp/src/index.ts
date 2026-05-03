#!/usr/bin/env bun
/**
 * Food MCP Server
 * 通过 stdio 与 MCP Client 通信，调用 a2ui-server 的 Elysia REST API
 *
 * 工具列表:
 * - query_menu / get_dish_detail: 浏览菜单（公开）
 * - place_order / get_orders / get_order_detail / update_order_status / cancel_order: 订单管理（需传入 JWT Token）
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ───────────────────────────────────────────────────────────────
// 1. API 客户端：会话级 JWT 缓存
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
    description: "下单。需传入 JWT Token。",
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
      token: z.string().min(1).describe("JWT 认证 Token"),
    },
  },
  async ({ items, address, token }) => {
    const res = await apiCall("/api/food/order", {
      method: "POST",
      body: { items, address },
      token,
    });
    return ok(res);
  },
);

server.registerTool(
  "get_orders",
  {
    description: "获取当前登录用户的订单列表。需传入 JWT Token。",
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
      token: z.string().min(1).describe("JWT 认证 Token"),
    },
  },
  async ({ page, pageSize, status, token }) => {
    const res = await apiCall("/api/food/orders", {
      query: { page, pageSize, status },
      token,
    });
    return ok(res);
  },
);

server.registerTool(
  "get_order_detail",
  {
    description: "获取单个订单详情。需传入 JWT Token。",
    inputSchema: {
      id: z.string().min(1).describe("订单 UUID"),
      token: z.string().min(1).describe("JWT 认证 Token"),
    },
  },
  async ({ id, token }) => {
    const res = await apiCall(`/api/food/orders/${encodeURIComponent(id)}`, {
      token,
    });
    return ok(res);
  },
);

server.registerTool(
  "update_order_status",
  {
    description:
      "更新订单状态（仅订单创建者可操作）。需传入 JWT Token。",
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
      token: z.string().min(1).describe("JWT 认证 Token"),
    },
  },
  async ({ id, status, token }) => {
    const res = await apiCall(`/api/food/orders/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: { status },
      token,
    });
    return ok(res);
  },
);

server.registerTool(
  "cancel_order",
  {
    description:
      "删除订单（仅订单创建者可操作）。需传入 JWT Token。",
    inputSchema: {
      id: z.string().min(1).describe("订单 UUID"),
      token: z.string().min(1).describe("JWT 认证 Token"),
    },
  },
  async ({ id, token }) => {
    const res = await apiCall(`/api/food/orders/${encodeURIComponent(id)}`, {
      method: "DELETE",
      token,
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
