/**
 * A2UI Agent 引擎 (v0.9 代理模式)
 * 使用 Vercel AI SDK streamText + tools 驱动 LLM
 * 原样流式输出 AGUI 标准事件流，A2UI 解析由客户端中间件处理
 */

import { streamText, stepCountIs, type ModelMessage, jsonSchema } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { AgentInput } from "../types.js";
import { buildBusinessTools } from "../tools/mcp-tools.js";
import { generateA2UIComponents } from "../tools/generate-a2ui.js";
import type { BaseEvent } from "@ag-ui/core";
import { EventType } from "@ag-ui/core";
import { randomUUID } from "@ag-ui/client";

/**
 * 将 AGUI 消息格式转换为 Vercel AI SDK v6 ModelMessage 格式
 *
 * AGUI 使用 OpenAI 兼容格式：
 *   assistant: { role: 'assistant', content: string, toolCalls?: [{id, type: 'function', function: {name, arguments}}] }
 *   tool: { role: 'tool', content: string, toolCallId: string }
 *
 * Vercel AI SDK v6 格式：
 *   assistant: { role: 'assistant', content: [{type: 'text', text}, {type: 'tool-call', toolCallId, toolName, input}] }
 *   tool: { role: 'tool', content: [{type: 'tool-result', toolCallId, toolName, output: {type: 'text', value}}] }
 */
function convertToCoreMessages(messages: any[]): ModelMessage[] {
  // 构建 toolCallId -> toolName 的映射，用于 tool 消息转换
  const toolNameMap = new Map<string, string>();
  for (const msg of messages) {
    if (msg.role === "assistant" && Array.isArray(msg.toolCalls)) {
      for (const tc of msg.toolCalls) {
        const id = tc.id || tc.toolCallId;
        const name = tc.function?.name || tc.toolName || tc.toolCallName;
        if (id && name) toolNameMap.set(id, name);
      }
    }
  }

  return messages
    .filter((msg) => msg.role !== "activity")
    .map((msg: any) => {
      switch (msg.role) {
        case "user":
          return { role: "user" as const, content: msg.content || "" };
        case "system":
        case "developer":
          return { role: "system" as const, content: msg.content || "" };
        case "assistant": {
          const parts: any[] = [];
          // text part
          if (msg.content) {
            parts.push({ type: "text" as const, text: msg.content });
          }
          // tool-call parts
          if (msg.toolCalls && Array.isArray(msg.toolCalls)) {
            for (const tc of msg.toolCalls) {
              const id = tc.id || tc.toolCallId;
              const name = tc.function?.name || tc.toolName || tc.toolCallName;
              const args = tc.function?.arguments
                ? JSON.parse(tc.function.arguments)
                : tc.args || tc.input || {};
              if (id && name) {
                parts.push({
                  type: "tool-call" as const,
                  toolCallId: id,
                  toolName: name,
                  input: args,
                });
              }
            }
          }
          return {
            role: "assistant" as const,
            content: parts.length > 0 ? parts : [{ type: "text" as const, text: "" }],
          };
        }
        case "tool": {
          const tcId = msg.toolCallId;
          const tcName = toolNameMap.get(tcId) || "unknown";
          return {
            role: "tool" as const,
            content: [
              {
                type: "tool-result" as const,
                toolCallId: tcId,
                toolName: tcName,
                output: { type: "text" as const, value: msg.content || "" },
              },
            ],
          };
        }
        default:
          return { role: "user" as const, content: msg.content || "" };
      }
    });
}

/**
 * 将客户端传入的工具转换为 Vercel AI SDK v6 兼容格式
 * - 原始 JSON Schema 参数 → jsonSchema 包装
 * - 无 execute 的工具 → 添加虚拟 execute（支持 streamText 多步执行）
 */
function normalizeMiddlewareTools(tools: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [name, toolDef] of Object.entries(tools)) {
    if (!toolDef || typeof toolDef !== "object") continue;

    const normalized: Record<string, any> = { ...toolDef };

    // 将原始 JSON Schema 参数转换为 jsonSchema 包装
    const params = toolDef.parameters;
    if (params && typeof params === "object" && params.type === "object") {
      normalized.parameters = jsonSchema({
        ...params,
        additionalProperties: params.additionalProperties ?? false,
      });
    }

    // 无 execute 的工具添加虚拟执行函数
    if (typeof toolDef.execute !== "function") {
      normalized.execute = async (args: any) => {
        return { status: "rendered", toolName: name, args };
      };
    }

    result[name] = normalized;
  }
  return result;
}

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
  const threadId = input.threadId || runId;

  // RUN_STARTED
  yield {
    type: EventType.RUN_STARTED,
    threadId,
    runId,
  };

  const coreMessages = convertToCoreMessages(input.messages);

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

  const a2uiDirective = `你是 A2UI 智能助手，负责生成动态 UI 界面。

工作流程：
1. 分析用户需求，调用业务工具（如 query_menu）获取数据
2. 获取数据后，调用 generate_a2ui 工具生成 A2UI v0.9 组件展示数据
3. 不要直接调用 render_a2ui，始终通过 generate_a2ui 生成 UI
4. 所有组件使用扁平格式，children 通过 ID 引用

工具使用指引：
- 查询数据（菜单、设施等）：先调用 query_* / get_* 业务工具获取数据
- 渲染 UI：获取数据后，调用 generate_a2ui 工具（它会自动设计并生成合适的 A2UI v0.9 组件）
- generate_a2ui 调用后，仅用一句话简要说明界面功能`;

  const systemPrompt = contextEntries
    ? `${a2uiDirective}\n\n${contextEntries}`
    : a2uiDirective;

  // 合并工具：中间件注入的工具 + 业务工具（通过 MCP 获取）
  const userToken = input.forwardedProps?.token as string | undefined;
  const mcp = await buildBusinessTools(input.appType, userToken);
  const middlewareTools = normalizeMiddlewareTools(input.tools || {});

  // 从中间件工具中移除 render_a2ui，主 LLM 不再直接调用它
  // render_a2ui 由 generate_a2ui 内部通过次级 LLM 调用
  const { render_a2ui: _renderA2UI, ...middlewareToolsWithoutRender } = middlewareTools;

  // generate_a2ui：包装工具，内部调用次级 LLM 强制生成 render_a2ui
  const generateA2UITool = {
    description:
      "生成 A2UI v0.9 UI 组件。当你获取了业务数据需要展示时，必须调用此工具。它会根据对话上下文自动设计并生成合适的 UI 组件。不要直接调用 render_a2ui。",
    parameters: jsonSchema({
      type: "object",
      properties: {},
      additionalProperties: false,
    }),
    execute: async () => ({ __generate_a2ui: true }),
  };

  const allTools = {
    ...middlewareToolsWithoutRender,
    ...mcp.tools,
    generate_a2ui: generateA2UITool,
  };

  // 跟踪工具调用状态（仅用于日志观察）
  let hasBusinessToolCall = false;
  let hasRenderA2uiCall = false;

  try {
    const result = await streamText({
      model: kimi_model("kimi-for-coding"),
      system: systemPrompt,
      messages: coreMessages,
      tools: allTools as any,
      stopWhen: stepCountIs(5),
    });

    let textMessageStarted = false;
    const toolCallInputs = new Map<string, string>();
    let generateA2UIPromise: Promise<
      { surfaceId: string; catalogId: string; components: any[]; data?: any }
    > | null = null;
    let generateA2UIToolCallId: string | null = null;
    // 收集业务工具结果，传给次级 LLM 使用
    const toolResultsForSubLLM: Array<{ toolCallId: string; toolName: string; output: unknown }> = [];

    for await (const chunk of result.fullStream) {
      switch (chunk.type) {
        case "tool-input-start": {
          const tcId = (chunk as any).toolCallId || (chunk as any).id || randomUUID();
          toolCallInputs.set(tcId, "");
          break;
        }
        case "tool-input-delta": {
          const tcId = (chunk as any).toolCallId || (chunk as any).id || randomUUID();
          const delta = (chunk as any).inputTextDelta || (chunk as any).delta || "";
          const current = toolCallInputs.get(tcId) || "";
          toolCallInputs.set(tcId, current + delta);
          break;
        }
        case "text-delta": {
          if (!textMessageStarted) {
            textMessageStarted = true;
            yield {
              type: EventType.TEXT_MESSAGE_START,
              messageId,
              role: "assistant",
            };
          }
          yield {
            type: EventType.TEXT_MESSAGE_CONTENT,
            messageId,
            delta: chunk.text,
          };
          break;
        }
        case "tool-call": {
          const tcId = (chunk as any).toolCallId || randomUUID();

          // generate_a2ui：启动次级 LLM 生成组件
          if (chunk.toolName === "generate_a2ui") {
            hasRenderA2uiCall = true;
            generateA2UIToolCallId = tcId;

            yield {
              type: EventType.TOOL_CALL_START,
              toolCallId: tcId,
              toolCallName: "generate_a2ui",
            };
            const argsJson = JSON.stringify((chunk as any).args ?? {});
            yield {
              type: EventType.TOOL_CALL_ARGS,
              toolCallId: tcId,
              delta: argsJson,
            };

            // 启动次级 LLM（在 tool-result 时等待完成）
            // 把已收集的业务工具结果附加到 messages 中，让次级 LLM 能获取真实数据
            const messagesWithToolResults = coreMessages.concat(
              toolResultsForSubLLM.map((tr) => ({
                role: "tool" as const,
                content: [
                  {
                    type: "tool-result" as const,
                    toolCallId: tr.toolCallId,
                    toolName: tr.toolName,
                    output: {
                      type: "text" as const,
                      value:
                        typeof tr.output === "string"
                          ? tr.output
                          : JSON.stringify(tr.output),
                    },
                  },
                ],
              })),
            );
            generateA2UIPromise = generateA2UIComponents({
              model: kimi_model("kimi-for-coding"),
              messages: messagesWithToolResults,
              appType: input.appType,
            });

            toolCallInputs.delete(tcId);
            break;
          }

          // 其他工具
          if (chunk.toolName !== "render_a2ui") {
            hasBusinessToolCall = true;
          }
          yield {
            type: EventType.TOOL_CALL_START,
            toolCallId: tcId,
            toolCallName: chunk.toolName,
          };
          const accumulatedArgs = toolCallInputs.get(tcId);
          const argsJson = accumulatedArgs ?? JSON.stringify((chunk as any).args ?? {});
          yield {
            type: EventType.TOOL_CALL_ARGS,
            toolCallId: tcId,
            delta: argsJson,
          };
          toolCallInputs.delete(tcId);
          break;
        }
        case "tool-result": {
          const tcId = (chunk as any).toolCallId || randomUUID();
          const toolName = (chunk as any).toolName || "";

          // generate_a2ui：等待次级 LLM 完成，伪造 render_a2ui 事件序列
          if (
            toolName === "generate_a2ui" &&
            generateA2UIPromise &&
            tcId === generateA2UIToolCallId
          ) {
            yield {
              type: EventType.TOOL_CALL_END,
              toolCallId: tcId,
            };

            const renderArgs = await generateA2UIPromise;
            generateA2UIPromise = null;
            generateA2UIToolCallId = null;

            // 伪造 render_a2ui 的 TOOL_CALL 事件序列
            const renderId = randomUUID();
            yield {
              type: EventType.TOOL_CALL_START,
              toolCallId: renderId,
              toolCallName: "render_a2ui",
            };
            yield {
              type: EventType.TOOL_CALL_ARGS,
              toolCallId: renderId,
              delta: JSON.stringify(renderArgs),
            };
            yield {
              type: EventType.TOOL_CALL_END,
              toolCallId: renderId,
            };
            yield {
              type: EventType.TOOL_CALL_RESULT,
              messageId: randomUUID(),
              toolCallId: renderId,
              content: JSON.stringify({ status: "rendered" }),
            };
            break;
          }

          // 其他工具：收集结果供次级 LLM 使用
          toolResultsForSubLLM.push({ toolCallId: tcId, toolName, output: chunk.output });
          yield {
            type: EventType.TOOL_CALL_END,
            toolCallId: tcId,
          };
          const resultContent = typeof chunk.output === 'string' ? chunk.output : JSON.stringify(chunk.output);
          yield {
            type: EventType.TOOL_CALL_RESULT,
            messageId: randomUUID(),
            toolCallId: tcId,
            content: resultContent,
          };
          break;
        }
        case "error": {
          yield {
            type: EventType.RUN_ERROR,
            message: String(chunk.error),
          };
          break;
        }
      }
    }

    if (textMessageStarted) {
      yield {
        type: EventType.TEXT_MESSAGE_END,
        messageId,
      };
    }

    // 日志：观察 LLM 是否正确调用了 render_a2ui
    if (hasBusinessToolCall && !hasRenderA2uiCall) {
      console.warn("[a2ui-agent] LLM 调用了业务工具但未调用 render_a2ui，建议检查 prompt 或工具描述");
    }
  } catch (err) {
    yield {
      type: EventType.RUN_ERROR,
      message: String(err),
    };
  } finally {
    try {
      await mcp.close();
    } catch (err) {
      console.error("[a2ui-agent] mcp.close() failed:", err);
    }
  }

  // RUN_FINISHED
  yield {
    type: EventType.RUN_FINISHED,
    threadId,
    runId,
  };
}
