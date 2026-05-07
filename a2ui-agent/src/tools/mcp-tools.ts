/**
 * MCP 工具构建器
 * 通过 createMCPClient + StdioClientTransport 连接 food-mcp / campus-mcp
 * 获取完整的业务工具集，替代本地硬编码 mock 工具
 */

import { resolve } from "path";
import { createMCPClient } from "@ai-sdk/mcp";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { ToolSet } from "ai";
import type { AppType } from "../types.js";
import { buildBusinessTools as buildLocalTools } from "./local-tools.js";

const PROJECT_ROOT = resolve(import.meta.dirname, "..", "..");
const FOOD_MCP_ENTRY = resolve(PROJECT_ROOT, "mcp/food-mcp/src/index.ts");
const CAMPUS_MCP_ENTRY = resolve(PROJECT_ROOT, "mcp/campus-mcp/src/index.ts");
const API_BASE = process.env.A2UI_API_BASE || "http://localhost:3000";

export interface McpToolSet {
  tools: ToolSet;
  close: () => Promise<void>;
}

/** 启动 MCP 服务器并获取工具 */
async function spawnMcpClient(name: string, entry: string, token?: string): Promise<McpToolSet> {
  const env: Record<string, string> = {
    ...process.env,
    A2UI_API_BASE: API_BASE,
  };
  if (token) {
    env.JWT_TOKEN = token;
  }

  const client = await createMCPClient({
    transport: new StdioClientTransport({
      command: "bun",
      args: ["run", entry],
      env,
    }),
  });

  const tools = await client.tools();
  const toolNames = Object.keys(tools);
  console.log(
    `[a2ui-agent] ${name} 连接成功，工具 ${toolNames.length} 个: ${toolNames.join(", ")}`,
  );

  return {
    tools,
    close: async () => {
      try {
        await client.close();
      } catch (err) {
        console.error(`[a2ui-agent] ${name} client.close() error:`, err);
      }
    },
  };
}

/**
 * 根据 appType 构建业务工具集
 * - 生产环境：通过 MCP 连接获取真实工具
 * - 测试环境：回退到本地 mock 工具（避免启动真实 MCP 进程）
 */
/**
 * 根据 appType 构建业务工具集
 * - 生产环境：通过 MCP 连接获取真实工具
 * - 测试环境：回退到本地 mock 工具（避免启动真实 MCP 进程）
 * @param token 用户 JWT Token，通过环境变量注入 MCP Server
 */
export async function buildBusinessTools(appType: AppType, token?: string): Promise<McpToolSet> {
  // 测试环境回退到本地工具
  if (process.env.VITEST || process.env.NODE_ENV === "test") {
    return {
      tools: buildLocalTools(appType),
      close: async () => {},
    };
  }

  try {
    const entry = appType === "food" ? FOOD_MCP_ENTRY : CAMPUS_MCP_ENTRY;
    const name = appType === "food" ? "food-mcp" : "campus-mcp";
    return await spawnMcpClient(name, entry, token);
  } catch (err) {
    console.warn(
      `[a2ui-agent] MCP 连接失败，回退到本地工具: ${(err as Error).message}`,
    );
    return {
      tools: buildLocalTools(appType),
      close: async () => {},
    };
  }
}
