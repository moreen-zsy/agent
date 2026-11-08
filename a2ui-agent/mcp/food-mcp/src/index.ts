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

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { error: `非 JSON 响应 (${res.status})`, raw: text };
    }

    // 新后端统一返回 { success, data } / { success, error }
    // 这里解包 data，避免 LLM 看到多余嵌套
    if (parsed && typeof parsed === "object" && "success" in parsed) {
      if (parsed.success === false) {
        return {
          error: parsed.error?.message ?? `请求失败 (${res.status})`,
          code: parsed.error?.code,
        };
      }
      return parsed.data;
    }

    // 非统一格式（如旧接口直返数据）原样返回
    return parsed;
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
      "浏览全部菜单列表。当用户想看菜单、浏览所有菜品、找吃的时调用此工具。不传参数返回全部菜品。",
    inputSchema: {
      category: z
        .enum(["signature", "main", "dessert", "drink", "appetizer"])
        .optional()
        .describe("菜品分类筛选"),
      search: z.string().optional().describe("关键词搜索（可选）"),
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
    const res = await apiCall("/food/menu", {
      query: { category, search, page, pageSize },
    });
    return ok(res);
  },
);

server.registerTool(
  "search_dish",
  {
    description: "搜索特定菜品。当用户提到具体菜品名称、想了解某个菜品是什么、或询问某个菜品的详情时调用此工具。必须传入 dishName 参数。",
    inputSchema: {
      dishName: z.string().min(1).describe("要搜索的菜品名称（必填）。例如：'古典鸡尾酒'、'和牛汉堡'"),
    },
  },
  async ({ dishName }) => {
    const res = await apiCall("/food/menu", {
      query: { search: dishName },
    });
    return ok(res);
  },
);

server.registerTool(
  "get_dish_detail",
  {
    description: "根据菜品 ID 获取菜品详情。无需登录。当用户想了解某个具体菜品的详细信息时调用此工具。调用时必须传入 id 参数。",
    inputSchema: {
      id: z.string().min(1).describe("菜品 UUID（必填）。当用户询问特定菜品时，从 context 中的【菜品ID速查表】找到对应 id 传入。例如：id='c4772e25-0e71-471e-b6af-8d384b853f6d'"),
    },
  },
  async ({ id }) => {
    const res = await apiCall(`/food/menu/${encodeURIComponent(id)}`);
    return ok(res);
  },
);

// ── 订单（需登录） ──────────────────────────────────────────────

server.registerTool(
  "place_order",
  {
    description: "下单。需传入 JWT Token。下单前必须先调用 get_user_addresses 获取用户地址。如果用户有默认地址，优先使用默认地址；如果没有地址，提示用户先添加地址。",
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
      address: z.string().min(1).describe("配送地址（从 get_user_addresses 结果中获取）"),
      phone: z.string().optional().describe("联系电话（从 get_user_addresses 结果中获取）"),
      contactName: z.string().optional().describe("联系人姓名（从 get_user_addresses 结果中获取）"),
      note: z.string().optional().describe("订单备注"),
      token: z.string().optional().describe("JWT 认证 Token（可选，服务端自动注入）"),
    },
  },
  async ({ items, address, phone, contactName, note, token }) => {
    const res = await apiCall("/food/orders", {
      method: "POST",
      body: { items, address, phone, contactName, note },
      token: resolveToken(token),
    });
    return ok(res);
  },
);

server.registerTool(
  "get_orders",
  {
    description: "获取当前登录用户的订单列表。需传入 JWT Token。当用户想查看自己的订单、历史订单时调用此工具。",
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
          "delivering",
          "delivered",
          "cancelled",
        ])
        .optional()
        .describe("按订单状态过滤"),
      token: z.string().optional().describe("JWT 认证 Token（可选，服务端自动注入）"),
    },
  },
  async ({ page, pageSize, status, token }) => {
    const res = await apiCall("/food/orders", {
      query: { page, pageSize, status },
      token: resolveToken(token),
    });
    return ok(res);
  },
);

server.registerTool(
  "get_order_detail",
  {
    description: "获取单个订单详情。需传入 JWT Token。当用户想查看某个具体订单的详细信息时调用此工具。",
    inputSchema: {
      id: z.string().min(1).describe("订单 UUID"),
      token: z.string().optional().describe("JWT 认证 Token（可选，服务端自动注入）"),
    },
  },
  async ({ id, token }) => {
    const res = await apiCall(`/food/orders/${encodeURIComponent(id)}`, {
      token: resolveToken(token),
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
          "delivering",
          "delivered",
          "cancelled",
        ])
        .describe("新状态"),
      token: z.string().optional().describe("JWT 认证 Token（可选，服务端自动注入）"),
    },
  },
  async ({ id, status, token }) => {
    const res = await apiCall(`/food/orders/${encodeURIComponent(id)}/status`, {
      method: "PUT",
      body: { status },
      token: resolveToken(token),
    });
    return ok(res);
  },
);

server.registerTool(
  "get_user_addresses",
  {
    description: "获取当前登录用户的配送地址列表。需传入 JWT Token。当用户要下单或询问地址时调用此工具。",
    inputSchema: {
      token: z.string().optional().describe("JWT 认证 Token（可选，服务端自动注入）"),
    },
  },
  async ({ token }) => {
    const res = await apiCall("/food/addresses", {
      token: resolveToken(token),
    });
    return ok(res);
  },
);

server.registerTool(
  "cancel_order",
  {
    description:
      "取消订单（仅订单创建者可操作）。需传入 JWT Token。与删除不同，取消会保留订单并写入 cancelled 状态。",
    inputSchema: {
      id: z.string().min(1).describe("订单 UUID"),
      reason: z.string().optional().describe("取消原因（可选）"),
      token: z.string().optional().describe("JWT 认证 Token（可选，服务端自动注入）"),
    },
  },
  async ({ id, reason, token }) => {
    const res = await apiCall(`/food/orders/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
      body: reason ? { reason } : {},
      token: resolveToken(token),
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
