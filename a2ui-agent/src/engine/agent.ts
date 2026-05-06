/**
 * A2UI Agent 引擎 (v0.9 代理模式)
 * 使用 Vercel AI SDK streamText + tools 驱动 LLM
 * 原样流式输出 AGUI 标准事件流，A2UI 解析由客户端中间件处理
 */

import { streamText, type ModelMessage } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { AgentInput } from "../types.js";
import { buildBusinessTools } from "../tools/mcp-tools.js";
import type { BaseEvent } from "@ag-ui/core";
import { EventType } from "@ag-ui/core";
import { randomUUID } from "@ag-ui/client";

/**
 * 生成 AGUI 标准事件流
 * 服务端作为纯 LLM 代理，透传 messages/context/tools
 */
export async function* runAgentStream(
  input: AgentInput,
): AsyncGenerator<BaseEvent> {
  const KIMI_API_KEY = process.env.KIMI_API_KEY;
  if (!KIMI_API_KEY) {
    throw new Error(
      "[a2ui-agent] KIMI_API_KEY is not set. Please add it to your .env file.",
    );
  }

  const kimi_model = createAnthropic({
    apiKey: KIMI_API_KEY,
    baseURL: "https://api.kimi.com/coding/v1",
  });

  const runId = randomUUID();
  const messageId = randomUUID();

  // RUN_STARTED
  yield {
    type: EventType.RUN_STARTED,
    messageId: runId,
  };

  const coreMessages: ModelMessage[] = input.messages.map((msg: any) => ({
    role: msg.role as "user" | "assistant" | "system",
    content: msg.content || "",
  }));

  // 处理 forwardedProps 中的 UserAction（v0.9 action 格式）
  const userAction = input.forwardedProps?.a2uiAction;
  if (userAction?.action) {
    const ua = userAction.action;
    const actionDesc =
      `用户执行了操作 "${ua.name}"` +
      (ua.sourceComponentId ? `（组件: ${ua.sourceComponentId}）` : "") +
      (ua.surfaceId ? `（Surface: ${ua.surfaceId}）` : "") +
      (ua.context ? `，上下文: ${JSON.stringify(ua.context)}` : "");
    coreMessages.push({
      role: "user",
      content: actionDesc,
    });
  }

  // 构建 system prompt：从 context 中提取信息（支持 Record 和 AGUI 数组格式）
  let contextEntries = "";
  if (input.context) {
    if (Array.isArray(input.context)) {
      // AGUI 标准格式: { value: string, description: string }[]
      contextEntries = input.context
        .map((c: any) => `${c.description}: ${c.value}`)
        .join("\n");
    } else {
      // Record<string, any> 格式
      contextEntries = Object.entries(input.context)
        .map(
          ([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`,
        )
        .join("\n");
    }
  }

  const systemPrompt = contextEntries
    ? `你是智能助手，帮助用户完成任务。\n\n${contextEntries}`
    : "你是智能助手，帮助用户完成任务。";

  // 合并工具：中间件注入的工具 + 业务工具（通过 MCP 获取）
  const mcp = await buildBusinessTools(input.appType);
  const middlewareTools = input.tools || {};

  try {
    const result = await streamText({
      model: kimi_model("kimi-for-coding"),
      system: systemPrompt,
      messages: coreMessages,
      tools: {
        ...middlewareTools,
        ...mcp.tools,
      } as any,
    });

    for await (const chunk of result.fullStream) {
      switch (chunk.type) {
        case "text-delta": {
          yield {
            type: EventType.TEXT_MESSAGE_CONTENT,
            messageId,
            delta: chunk.text,
          };
          break;
        }
        case "tool-call": {
          yield {
            type: EventType.TOOL_CALL_START,
            messageId: randomUUID(),
            toolCallId: (chunk as any).toolCallId || randomUUID(),
            toolName: chunk.toolName,
          } as any;
          break;
        }
        case "tool-result": {
          yield {
            type: EventType.TOOL_CALL_RESULT,
            messageId: randomUUID(),
            toolCallId: (chunk as any).toolCallId || randomUUID(),
            toolName: chunk.toolName,
            result: chunk.output,
          } as any;
          break;
        }
        case "error": {
          yield {
            type: EventType.RUN_ERROR,
            messageId: randomUUID(),
            message: String(chunk.error),
          };
          break;
        }
      }
    }
  } catch (err) {
    yield {
      type: EventType.RUN_ERROR,
      messageId: randomUUID(),
      message: String(err),
    };
  } finally {
    await mcp.close();
  }

  // RUN_FINISHED
  yield {
    type: EventType.RUN_FINISHED,
    messageId: runId,
  };
}
