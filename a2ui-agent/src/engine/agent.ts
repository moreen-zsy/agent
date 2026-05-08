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
 * 从次级 LLM 的渲染结果构造 ACTIVITY_SNAPSHOT 事件
 * 直接发给客户端，绕过 A2UIMiddleware 的 render_a2ui 解析
 */
function createA2UIActivitySnapshot(renderArgs: any): BaseEvent {
  const surfaceId = renderArgs.surfaceId || "a2ui-surface";
  const catalogId =
    renderArgs.catalogId ||
    "https://a2ui.org/specification/v0_9/basic_catalog.json";

  const operations: any[] = [
    {
      version: "v0.9",
      createSurface: {
        surfaceId,
        catalogId,
      },
    },
    {
      version: "v0.9",
      updateComponents: {
        surfaceId,
        components: renderArgs.components || [],
      },
    },
  ];

  if (renderArgs.data) {
    operations.push({
      version: "v0.9",
      updateDataModel: {
        surfaceId,
        data: renderArgs.data,
      },
    });
  }

  return {
    type: EventType.ACTIVITY_SNAPSHOT,
    messageId: randomUUID(),
    activityType: "a2ui-surface",
    content: {
      a2ui_operations: operations,
    },
    replace: false,
  } as BaseEvent;
}

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
  try {
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

  // 检测 @ag-ui/client HttpAgent 格式：assistant 缺少 content/toolCalls，tool 缺少 toolCallId
  const isHttpAgentFormat = messages.some(
    (m) => m.role === "assistant" && m.content === undefined && m.toolCalls === undefined && m.id,
  );

  const result = messages
    .filter((msg) => msg.role !== "activity")
    .map((msg: any, idx: number) => {
      switch (msg.role) {
        case "user": {
          // content 可能是数组（Vercel v6 格式已转换过），需要处理
          const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
          return { role: "user" as const, content };
        }
        case "system":
        case "developer":
          return { role: "system" as const, content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content) };
        case "assistant": {
          // HttpAgent 格式：assistant tool-call 只有 id/role，跳过
          if (isHttpAgentFormat && msg.content === undefined && !msg.toolCalls) {
            return null;
          }
          const parts: any[] = [];
          // text part：content 可能是字符串，也可能是已经转换过的 parts 数组
          if (typeof msg.content === "string" && msg.content) {
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
          // HttpAgent 格式：tool 缺少 toolCallId，跳过
          if (isHttpAgentFormat && !msg.toolCallId) {
            return null;
          }
          // toolCallId 可能缺失，用 index 兜底避免 undefined
          const tcId = msg.toolCallId || `fallback-${idx}`;
          const tcName = toolNameMap.get(tcId) || msg.toolName || msg.name || "unknown";
          return {
            role: "tool" as const,
            content: [
              {
                type: "tool-result" as const,
                toolCallId: tcId,
                toolName: tcName,
                output: { type: "text" as const, value: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content) },
              },
            ],
          };
        }
        default:
          return { role: "user" as const, content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content) };
      }
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  return result as ModelMessage[];
  } catch (err: any) {
    throw new Error(`[convertToCoreMessages] 消息转换失败: ${err.message}`);
  }
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

  // 优先使用客户端传来的干净对话历史（绕过 HttpAgent 格式损坏问题）
  const forwardedProps = input.forwardedProps;
  const useCleanHistory = !!forwardedProps?.conversationHistory;
  const sourceMessages = useCleanHistory
    ? forwardedProps!.conversationHistory
    : input.messages;
  const coreMessages = convertToCoreMessages(sourceMessages);

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

回答规范：
- generate_a2ui 调用后，用 Markdown 格式直接介绍数据本身（如菜品特色、口感描述、推荐理由），严禁输出"界面功能说明""组件设计""功能模块"等元内容
- 不要以表格形式罗列 UI 功能，直接输出自然语言描述
- 回答内容必须是对用户问题的直接回应，而不是对界面设计的说明`;

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
    let generateA2UICompleted = false;
    let generateA2UIHandled = false;
    let generateA2UIResult: any = null;
    // 收集业务工具结果，传给次级 LLM 使用
    const toolResultsForSubLLM: Array<{ toolCallId: string; toolName: string; output: unknown }> = [];

    for await (const chunk of result.fullStream) {
      // 检查次级 LLM 是否已完成但未发送 ACTIVITY_SNAPSHOT
      if (generateA2UICompleted && !generateA2UIHandled && generateA2UIResult) {
        yield createA2UIActivitySnapshot(generateA2UIResult);
        generateA2UIHandled = true;
      }

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
            // 启动次级 LLM，不阻塞主 LLM
            // toolResultsForSubLLM 通过独立参数传递，避免混入 messages 导致结构错误
            generateA2UIPromise = generateA2UIComponents({
              model: kimi_model("kimi-for-coding"),
              messages: coreMessages,
              appType: input.appType,
              toolResults: toolResultsForSubLLM,
            }).then((result) => {
              generateA2UIResult = result;
              generateA2UICompleted = true;
              return result;
            });

            toolCallInputs.delete(tcId);
            break;
          }

          // 其他工具
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

          // generate_a2ui：不等待次级 LLM，让它在后台运行
          if (
            toolName === "generate_a2ui" &&
            generateA2UIPromise &&
            tcId === generateA2UIToolCallId
          ) {
            yield {
              type: EventType.TOOL_CALL_END,
              toolCallId: tcId,
            };

            // 立即返回结果，让主 LLM 继续生成 Markdown
            yield {
              type: EventType.TOOL_CALL_RESULT,
              messageId: randomUUID(),
              toolCallId: tcId,
              content: JSON.stringify({ __generate_a2ui: true }),
            };

            // 不重置 generateA2UIPromise，让它在后台运行
            // 次级 LLM 完成后会通过循环顶部的检查发送 ACTIVITY_SNAPSHOT
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

    // 流结束后，如果次级 LLM 还未完成，等待它并发送 ACTIVITY_SNAPSHOT
    if (!generateA2UIHandled && generateA2UIPromise) {
      try {
        const result = await generateA2UIPromise;
        if (result) {
          yield createA2UIActivitySnapshot(result);
        }
      } catch (err) {
        yield createA2UIActivitySnapshot({
          surfaceId: "error-surface",
          components: [
            { id: "root", component: "Column", children: ["error-text"] },
            { id: "error-text", component: "Text", text: "UI 生成失败，请重试" },
          ],
        });
      }
    }

  } catch (err) {
    yield {
      type: EventType.RUN_ERROR,
      message: String(err),
    };
  } finally {
    try {
      await mcp.close();
    } catch {
      // mcp close error ignored
    }
  }

  // RUN_FINISHED
  yield {
    type: EventType.RUN_FINISHED,
    threadId,
    runId,
  };
}
