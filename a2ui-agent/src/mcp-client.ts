/**
 * a2ui-agent MCP Client
 * 同时连接 food-mcp 和 campus-mcp 两个 MCP Server，组合工具后驱动 LLM 完成 TUI 对话。
 *
 * 运行:
 *   bun run a2ui-agent/src/mcp-client.ts
 *
 * 依赖:
 *   - a2ui-server 已启动并监听 A2UI_API_BASE（默认 http://localhost:3000）
 *   - .env 中提供 KIMI_API_KEY
 *   - 用户已在前端登录并拥有 JWT Token
 */

import { resolve } from "path";
import { config } from "dotenv";
import { input } from "@inquirer/prompts";
import { createAnthropic } from "@ai-sdk/anthropic";
import {
  generateText,
  stepCountIs,
  type ModelMessage,
  type ToolSet,
} from "ai";
import { createMCPClient } from "@ai-sdk/mcp";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

config({ path: resolve(import.meta.dirname, "..", ".env") });

const kimi = createAnthropic({
  apiKey: process.env.KIMI_API_KEY,
  baseURL: "https://api.kimi.com/coding/v1",
});

const SYSTEM_PROMPT = `你是 A2UI 业务助手，可以同时调用「点餐」和「校园」两个领域的工具。

可用工具按领域分组：
- food-mcp: 菜单浏览、下单、订单管理（query_menu, get_dish_detail, place_order, get_orders, get_order_detail, update_order_status, cancel_order）
- campus-mcp: 设施查询、场地预约、缴费（query_facilities, get_facility_detail, book_facility, get_reservations, update_reservation, cancel_reservation, pay_fee, query_payments, update_payment）

调用约定：
1. 用户已通过前端完成登录，你拥有该用户的 JWT Token。调用任何需要认证的工具（place_order、get_orders、book_facility 等）时，必须在对应工具的 token 参数中传入该 JWT。
2. 当用户的问题跨领域时（例如"订午饭并预约自习室"），分别调用两个 MCP 的工具协同完成，每次调用都携带 token。
3. 用中文回答，简洁清晰。`;

const PROJECT_ROOT = resolve(import.meta.dirname, "..", "..");
const FOOD_MCP_ENTRY = resolve(
  PROJECT_ROOT,
  "a2ui-agent/mcp/food-mcp/src/index.ts",
);
const CAMPUS_MCP_ENTRY = resolve(
  PROJECT_ROOT,
  "a2ui-agent/mcp/campus-mcp/src/index.ts",
);
const API_BASE = process.env.A2UI_API_BASE || "http://localhost:3000";

async function typeWrite(text: string, delay = 8) {
  for (const char of text) {
    process.stdout.write(char);
    await new Promise((r) => setTimeout(r, delay));
  }
}

async function spawnMcp(name: string, entry: string) {
  const client = await createMCPClient({
    transport: new StdioClientTransport({
      command: "bun",
      args: ["run", entry],
      env: {
        ...process.env,
        A2UI_API_BASE: API_BASE,
      },
    }),
  });
  const tools = await client.tools();
  const names = Object.keys(tools);
  console.log(`✅ ${name} 连接成功，工具 ${names.length} 个: ${names.join(", ")}`);
  return { client, tools };
}

async function chat() {
  console.log("=== A2UI 多 MCP 对话客户端 ===");
  console.log(`API_BASE = ${API_BASE}`);
  console.log("正在启动 MCP 服务...\n");

  const food = await spawnMcp("food-mcp", FOOD_MCP_ENTRY);
  const campus = await spawnMcp("campus-mcp", CAMPUS_MCP_ENTRY);

  // 同名工具加前缀避免冲突（food/campus 都有 auth_register、auth_login）
  const namespaced = (prefix: string, tools: ToolSet): ToolSet =>
    Object.fromEntries(
      Object.entries(tools).map(([k, v]) => [`${prefix}__${k}`, v]),
    );

  const allTools: ToolSet = {
    ...namespaced("food", food.tools),
    ...namespaced("campus", campus.tools),
  };

  console.log(`\n🔧 合并后工具总数: ${Object.keys(allTools).length}`);
  console.log("提示: 输入 'exit' 或 'quit' 退出\n");

  let messages: ModelMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];

  try {
    while (true) {
      const userInput = await input({ message: "👤 你" });

      if (
        userInput.toLowerCase() === "exit" ||
        userInput.toLowerCase() === "quit"
      ) {
        console.log("\n👋 再见！");
        break;
      }

      messages.push({ role: "user", content: userInput });
      process.stdout.write("\n🤖 AI: ");

      try {
        const result = await generateText({
          model: kimi("kimi-for-coding"),
          messages,
          tools: allTools,
          stopWhen: stepCountIs(8),
        });

        await typeWrite(result.text);
        process.stdout.write("\n\n");

        messages = [...messages, ...result.response.messages];
      } catch (err) {
        console.error("\n❌ 请求出错:", err);
      }
    }
  } finally {
    await food.client.close();
    await campus.client.close();
    console.log("🔌 MCP Client 已全部关闭");
  }
}

chat().catch((err) => {
  console.error(err);
  process.exit(1);
});
