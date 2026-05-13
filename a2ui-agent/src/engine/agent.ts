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

// Session 级别数据缓存：threadId -> toolName -> data
// 避免同一 session 内重复调用 MCP 获取相同数据
const sessionDataCache = new Map<string, Map<string, any>>();

function getSessionCache(threadId: string): Map<string, any> {
  if (!sessionDataCache.has(threadId)) {
    sessionDataCache.set(threadId, new Map());
  }
  return sessionDataCache.get(threadId)!;
}

/** 从 MCP/本地工具输出中提取实际数据 */
function extractToolOutput(output: unknown): any {
  let data: any = output;

  // AI SDK v6 可能直接返回字符串 JSON
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return data;
    }
  }

  // MCP 格式: { content: [{ type: "text", text: "JSON" }] }
  if (data && typeof data === "object" && Array.isArray(data.content)) {
    const textItem = data.content.find((c: any) => c.type === "text");
    if (textItem?.text) {
      try {
        data = JSON.parse(textItem.text);
      } catch {
        data = textItem.text;
      }
    }
  }
  // 统一提取
  if (data && typeof data === "object") {
    if (data.data !== undefined) return data.data;
    if (data.items !== undefined) return data.items;
  }
  return data;
}

// ───────────────────────────────────────────────────────────────
// 意图分类与动态工具选择
// ───────────────────────────────────────────────────────────────

type UserIntent = 'menu' | 'order' | 'checkout' | 'general';

/**
 * 根据用户最新消息内容分类意图。
 * 只分析当前消息，不受历史上下文影响。
 */
function classifyUserIntent(userText: string): UserIntent {
  const text = userText.toLowerCase();

  // 下单意图（最高优先级）
  const checkoutKeywords = ['点一份', '帮我点', '下单', '来一份', '加入购物车', '结算', '付款'];
  if (checkoutKeywords.some((k) => text.includes(k))) return 'checkout';

  // 订单意图
  const orderKeywords = ['我的订单', '历史订单', '订单列表', '订单详情', '查看订单', '订单状态', '取消订单'];
  if (orderKeywords.some((k) => text.includes(k))) return 'order';

  // 菜单/菜品意图（包含介绍单个菜品）
  const menuKeywords = ['菜单', '菜品', '菜', '推荐', '热销', '热门', '招牌', '搭配', '精选', '吃什么', '有什么吃的', '好吃的', '介绍', '详情', '是什么'];
  if (menuKeywords.some((k) => text.includes(k))) return 'menu';

  return 'general';
}

/**
 * 根据意图返回可用的工具列表（用于 activeTools）。
 * 通过限制工具暴露范围，从根本上阻止 LLM 调用错误工具。
 */
function getActiveToolsForIntent(
  intent: UserIntent,
  allToolNames: string[]
): string[] {
  const baseTools = ['generate_a2ui'];

  switch (intent) {
    case 'menu':
      // 菜单意图：只暴露菜单相关工具
      return [...baseTools, 'query_menu', 'search_dish'];
    case 'order':
      // 订单意图：只暴露订单相关工具
      return [...baseTools, 'get_orders', 'get_order_detail', 'update_order_status', 'cancel_order'];
    case 'checkout':
      // 下单意图：只暴露下单相关工具
      return [...baseTools, 'get_user_addresses', 'place_order'];
    case 'general':
    default:
      // 一般意图：暴露所有工具
      return allToolNames;
  }
}

/**
 * 构建供 LLM 使用的 messages 数组。
 * 在历史消息和当前消息之间插入明确的 system 分隔标记，
 * 让 LLM 能够区分历史上下文和当前请求。
 */
function buildMessagesWithBoundary(
  coreMessages: any[],
  currentUserText: string
): any[] {
  // 找到最后一条用户消息的索引
  let lastUserIndex = -1;
  for (let i = coreMessages.length - 1; i >= 0; i--) {
    if (coreMessages[i]?.role === 'user') {
      lastUserIndex = i;
      break;
    }
  }

  if (lastUserIndex <= 0) {
    // 只有一条消息或没有用户消息，无需分隔
    return coreMessages;
  }

  const result: any[] = [];
  for (let i = 0; i < coreMessages.length; i++) {
    const msg = coreMessages[i];
    if (i === lastUserIndex) {
      // 在最后一次用户消息前插入分隔标记
      result.push({
        role: 'system',
        content: '【历史对话结束。以下是最新的用户请求，请严格根据这条消息的字面意图处理，不受上面历史对话影响。】',
      });
    }
    result.push(msg);
  }
  return result;
}

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
      (m) =>
        m.role === "assistant" &&
        m.content === undefined &&
        m.toolCalls === undefined &&
        m.id,
    );

    const result = messages
      .filter((msg) => msg.role !== "activity")
      .map((msg: any, idx: number) => {
        switch (msg.role) {
          case "user": {
            // content 可能是数组（Vercel v6 格式已转换过），需要处理
            const content =
              typeof msg.content === "string"
                ? msg.content
                : JSON.stringify(msg.content);
            return { role: "user" as const, content };
          }
          case "system":
          case "developer":
            return {
              role: "system" as const,
              content:
                typeof msg.content === "string"
                  ? msg.content
                  : JSON.stringify(msg.content),
            };
          case "assistant": {
            // HttpAgent 格式：assistant tool-call 只有 id/role，跳过
            if (
              isHttpAgentFormat &&
              msg.content === undefined &&
              !msg.toolCalls
            ) {
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
                const name =
                  tc.function?.name || tc.toolName || tc.toolCallName;
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
              content:
                parts.length > 0
                  ? parts
                  : [{ type: "text" as const, text: "" }],
            };
          }
          case "tool": {
            // HttpAgent 格式：tool 缺少 toolCallId，跳过
            if (isHttpAgentFormat && !msg.toolCallId) {
              return null;
            }
            // toolCallId 可能缺失，用 index 兜底避免 undefined
            const tcId = msg.toolCallId || `fallback-${idx}`;
            // 防御性处理：如果没有对应的 assistant tool call，跳过孤立的 tool result
            // 避免多轮对话中 generate_a2ui 等虚拟工具导致格式不匹配
            if (!toolNameMap.has(tcId)) {
              console.warn(`[convertToCoreMessages] 跳过孤立 tool result (无对应 tool call): tcId=${tcId}, idx=${idx}`);
              return null;
            }
            const tcName =
              toolNameMap.get(tcId) || msg.toolName || msg.name || "unknown";
            return {
              role: "tool" as const,
              content: [
                {
                  type: "tool-result" as const,
                  toolCallId: tcId,
                  toolName: tcName,
                  output: {
                    type: "text" as const,
                    value:
                      typeof msg.content === "string"
                        ? msg.content
                        : JSON.stringify(msg.content),
                  },
                },
              ],
            };
          }
          default:
            return {
              role: "user" as const,
              content:
                typeof msg.content === "string"
                  ? msg.content
                  : JSON.stringify(msg.content),
            };
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
function normalizeMiddlewareTools(
  tools: Record<string, any>,
): Record<string, any> {
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

  // 获取 session 级数据缓存
  const sessionCache = getSessionCache(threadId);

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
    // 将 action name 映射为更明确的用户意图描述，避免 LLM 误解
    const actionIntentMap: Record<string, string> = {
      view_menu: "用户想要查看菜单",
      view_orders: "用户想要查看我的订单",
      view_order_detail: "用户想要查看某个订单的详情",
      add_to_cart: "用户想要添加商品到购物车",
      view_dish_detail: "用户想要查看菜品详情",
      checkout: "用户想要结算购物车",
    };
    const intentDesc =
      actionIntentMap[ua.name] || `用户执行了操作 "${ua.name}"`;
    const contextStr = ua.context
      ? `，上下文: ${JSON.stringify(ua.context)}`
      : "";

    // 检查缓存中是否有相关数据，避免重复调用 MCP
    let cacheHint = "";
    const cacheDataKeys: string[] = [];
    if (ua.name === "view_dish_detail" && sessionCache.has("query_menu")) {
      cacheDataKeys.push("菜单数据");
    }
    if (ua.name === "view_order_detail" && sessionCache.has("get_orders")) {
      cacheDataKeys.push("订单列表数据");
    }
    if (ua.name === "view_orders" && sessionCache.has("get_orders")) {
      cacheDataKeys.push("订单列表数据");
    }
    if (cacheDataKeys.length > 0) {
      cacheHint = `\n【注意】缓存中已有 ${cacheDataKeys.join("、")}，如数据仍有效请直接使用，无需重新调用工具获取。`;
    }

    coreMessages.push({
      role: "user",
      content: intentDesc + contextStr + cacheHint,
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

  const a2uiDirective = `你是 Gusto 高端餐厅的智能点餐助手，负责通过业务工具获取数据并调用 generate_a2ui 生成动态 UI。

== 核心工作流程 ==
1. 分析用户最新一条消息的字面意图
2. 调用对应的业务工具获取数据
3. 【绝对强制】获取数据后，必须立即调用 generate_a2ui 工具生成 A2UI v0.9 组件。generate_a2ui 不是可选的，每次获取数据后都必须调用，否则用户看不到界面。
4. 不要直接调用 render_a2ui，generate_a2ui 内部会处理 UI 生成
5. 用 Markdown 直接介绍数据本身（菜品特色、推荐理由等），严禁输出"界面设计""组件功能"等元内容

== 搜索规则（绝对强制）==
- query_menu 工具有两种用法，必须根据用户意图选择正确的一种：
  A) 用户想浏览菜单（"有什么好吃的""看看菜单"）→ 调用 query_menu() 不传参数
  B) 用户提到具体菜品（"介绍一下古典鸡尾酒""古典鸡尾酒是什么""告诉我宫保鸡丁"）→ 必须调用 query_menu({search: "具体菜品名称"})，search 参数必须传入用户提到的菜品名称
- 情况 B 中，search 参数不是可选的，必须传入。不传 search 会返回全部菜单，无法回答用户关于特定菜品的问题。
- 搜到菜品后，调用 generate_a2ui(scenario="dish_detail") 生成 DishDetail 卡片展示该菜品

== 工具使用示例 ==
- 用户问"有什么好吃的""看看菜单" → query_menu() → generate_a2ui(scenario="menu")
- 用户问"介绍一下古典鸡尾酒""古典鸡尾酒是什么" → search_dish({dishName: "古典鸡尾酒"}) → generate_a2ui(scenario="dish_detail")
- 用户问"查看我的订单" → get_orders() → generate_a2ui(scenario="orders")
- 【极其重要】区分 query_menu 和 search_dish：浏览菜单用 query_menu()，搜索特定菜品用 search_dish({dishName: "..."})

== 五大场景工作流（必须严格遵守） ==

【场景一】查看菜单（用户说"查看菜单""有什么菜"等）
→ 调用 query_menu 获取菜单数据
→ 调用 generate_a2ui(scenario="menu") 生成 Carousel 轮播图展示全部菜品

【场景二】查看菜品详情（用户说"介绍一下XXX""告诉我XXX是什么""XXX是什么菜"等）
→ 调用 search_dish({dishName: "菜品名称"}) 搜索该菜品
→ 从搜索结果中找到该菜品数据
→ 调用 generate_a2ui(scenario="dish_detail") 生成 DishDetail 组件（含购物车按钮的正方形卡片）

【场景三】查看我的订单（用户说"查看我的订单""我的订单"等）
→ 调用 get_orders 获取订单列表
→ 调用 generate_a2ui(scenario="orders") 生成 OrderCard 列表

【场景四】查看订单详情（用户说"查看订单XXX详情"或点击订单卡片）
→ 调用 get_order_detail 获取订单详情
→ 调用 generate_a2ui(scenario="order_detail") 生成 OrderDetail 组件

【场景五】直接下单（用户说"帮我点一份XXX""下单"等）
→ 先调用 get_user_addresses 获取用户地址列表
→ 优先使用默认地址，如果没有地址提示用户先添加
→ 调用 place_order 下单
→ 调用 generate_a2ui(scenario="place_order") 生成订单卡片展示新订单

== 意图识别规则（极其重要） ==
- 每次用户新消息都是独立请求，严禁基于历史上下文推测意图
- 【词汇强制映射】以下关键词出现时必须调用对应工具，绝对不受上下文影响：
  * "菜单""有什么吃的""吃什么""推荐""热销""热门""招牌""搭配""精选" → 调用 query_menu（浏览全部菜单，生成 Carousel）
  * "介绍一下XXX""告诉我XXX是什么""XXX是什么菜""XXX怎么样" → 调用 search_dish({dishName: "XXX"})（搜索特定菜品，生成 DishDetail 卡片）
  * "我的订单""历史订单""订单列表" → 调用 get_orders
  * "订单详情""查看订单""订单状态" → 调用 get_order_detail
  * "点一份""帮我点""下单""来一份" → 先 get_user_addresses，再 place_order
- 【关键区分】"热门菜品""招牌菜""推荐菜品"属于浏览菜单场景（query_menu + Carousel）；"介绍一下XXX""XXX是什么"属于搜索菜品场景（search_dish + DishDetail）；"热门订单""最近订单"才属于订单场景（get_orders）
- 【强制】即使用户只发"查看菜单"，也必须调用 query_menu。严禁因上一轮讨论过订单就继续返回订单内容
- 【严禁主动查询】用户没有明确要求查询的数据，你绝对不能主动调用工具获取。比如用户说"帮我点一个汉堡"，你只调用 place_order 下单，严禁额外调用 get_orders 或 get_order_detail 查询历史订单
- 【一轮只做一件事】每个用户请求只处理一个明确意图，完成即停止，不要"顺便"做其他事情

== 购物车规则 ==
- 你没有直接操作购物车的能力，不能声称"已将商品加入购物车"
- 当用户说"加入购物车""来一份"时，调用 get_dish_detail + generate_a2ui 生成带购物车按钮的 DishDetail 卡片，让用户自己点击

== 回答规范 ==
- generate_a2ui 之后用 Markdown 介绍数据本身（菜品口感、推荐理由），严禁输出"UI设计""组件结构""功能模块"等元内容
- 不要以表格罗列 UI 功能，用自然语言描述
- 严禁幻觉操作结果（如"已加入购物车"），除非确实调用了对应工具`;

  const systemPrompt = contextEntries
    ? `${a2uiDirective}\n\n${contextEntries}`
    : a2uiDirective;

  // 合并工具：中间件注入的工具 + 业务工具（通过 MCP 获取）
  const userToken = input.forwardedProps?.token as string | undefined;
  const mcp = await buildBusinessTools(input.appType, userToken);
  const middlewareTools = normalizeMiddlewareTools(input.tools || {});

  // 从中间件工具中移除 render_a2ui，主 LLM 不再直接调用它
  // render_a2ui 由 generate_a2ui 内部通过次级 LLM 调用
  const { render_a2ui: _renderA2UI, ...middlewareToolsWithoutRender } =
    middlewareTools;

  // generate_a2ui：包装工具，内部调用次级 LLM 强制生成 render_a2ui
  // 主 LLM 必须传入 scenario，明确告诉次级 LLM 当前场景，避免长思考
  const generateA2UITool = {
    description:
      "生成 A2UI v0.9 UI 组件。当你获取了业务数据需要展示时，必须调用此工具。调用时必须传入 scenario 参数，明确告知当前场景。不要直接调用 render_a2ui。",
    parameters: jsonSchema({
      type: "object",
      properties: {
        scenario: {
          type: "string",
          enum: ["menu", "dish_detail", "orders", "order_detail", "place_order"],
          description:
            "【必填】当前场景标识，必须严格匹配。根据用户意图选择：menu=查看菜单/菜品/推荐(生成Carousel), dish_detail=查看菜品详情(生成DishDetail), orders=查看我的订单(生成OrderCard列表), order_detail=查看订单详情(生成OrderDetail), place_order=下单成功(生成OrderCard)。如果用户消息包含'推荐'/'热销'/'招牌'/'搭配'等词，必须选 menu。",
        },
      },
      required: ["scenario"],
      additionalProperties: false,
    }),
    execute: async (args: { scenario: string }) => ({ __generate_a2ui: true, scenario: args.scenario }),
  };

  const allTools = {
    ...middlewareToolsWithoutRender,
    ...mcp.tools,
    generate_a2ui: generateA2UITool,
  };

  // 提取当前用户消息（最后一条 user 消息）
  const lastUserMsg = [...coreMessages].reverse().find((m: any) => m.role === 'user');
  const currentUserText = typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : '';

  // 意图分类 + 动态工具选择
  const userIntent = classifyUserIntent(currentUserText);
  const allToolNames = Object.keys(allTools);
  const activeTools = getActiveToolsForIntent(userIntent, allToolNames);

  // 构建带历史/当前分隔的消息数组
  const messagesWithBoundary = buildMessagesWithBoundary(coreMessages, currentUserText);

  try {
    console.log(
      `[agent] streamText 启动，intent: ${userIntent}, activeTools: ${activeTools.join(',')}, system prompt 长度: ${systemPrompt.length}, messages 数量: ${messagesWithBoundary.length}`,
    );
    // 调试：如果有 tool message，打印 toolCallId 列表以便排查格式问题
    const toolMsgs = coreMessages.filter((m: any) => m.role === 'tool');
    if (toolMsgs.length > 0) {
      console.log(
        `[agent] coreMessages 中 tool 消息:`,
        toolMsgs.map((m: any) => ({
          toolCallId: m.content?.[0]?.toolCallId,
          toolName: m.content?.[0]?.toolName,
        })),
      );
    }
    const result = await streamText({
      model: kimi_model("kimi-for-coding"),
      system: systemPrompt,
      messages: messagesWithBoundary,
      tools: allTools as any,
      activeTools: activeTools as any,
      stopWhen: stepCountIs(5),
    });

    let textMessageStarted = false;
    const toolCallInputs = new Map<string, string>();
    const toolCallNameMap = new Map<string, string>(); // toolCallId -> toolName
    let generateA2UIPromise: Promise<{
      surfaceId: string;
      catalogId: string;
      components: any[];
      data?: any;
    }> | null = null;
    let generateA2UIToolCallId: string | null = null;
    let generateA2UICompleted = false;
    let generateA2UIHandled = false;
    let generateA2UIResult: any = null;
    // 收集业务工具结果，传给次级 LLM 使用
    const toolResultsForSubLLM: Array<{
      toolCallId: string;
      toolName: string;
      output: unknown;
    }> = [];

    for await (const chunk of result.fullStream) {
      // 检查次级 LLM 是否已完成但未发送 ACTIVITY_SNAPSHOT
      if (generateA2UICompleted && !generateA2UIHandled && generateA2UIResult) {
        console.log(
          `[agent] 主 LLM 流中检测到次级 LLM 完成，发送 ACTIVITY_SNAPSHOT (surfaceId: ${generateA2UIResult.surfaceId})`,
        );
        yield createA2UIActivitySnapshot(generateA2UIResult);
        generateA2UIHandled = true;
      }

      switch (chunk.type) {
        case "tool-input-start": {
          const tcId = (chunk as any).toolCallId || randomUUID();
          toolCallInputs.set(tcId, "");
          break;
        }
        case "tool-input-delta": {
          const tcId = (chunk as any).toolCallId || randomUUID();
          const delta =
            (chunk as any).inputTextDelta || (chunk as any).delta || "";
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
          const tcName = (chunk as any).toolName || "";
          if (tcName) toolCallNameMap.set(tcId, tcName);

          // generate_a2ui：启动次级 LLM 生成组件
          if (chunk.toolName === "generate_a2ui") {
            generateA2UIToolCallId = tcId;

            yield {
              type: EventType.TOOL_CALL_START,
              toolCallId: tcId,
              toolCallName: "generate_a2ui",
            };
            // AI SDK v6 的 tool-call chunk 可能不包含完整 args，优先使用累积的 toolCallInputs
            const accumulatedArgs = toolCallInputs.get(tcId);
            const rawArgs = accumulatedArgs ? JSON.parse(accumulatedArgs) : ((chunk as any).args ?? {});
            const argsJson = JSON.stringify(rawArgs);
            yield {
              type: EventType.TOOL_CALL_ARGS,
              toolCallId: tcId,
              delta: argsJson,
            };

            // 从 tool call args 中提取 scenario，明确告知次级 LLM 当前场景
            let scenario = rawArgs?.scenario;

            // 获取用户最新消息内容，用于场景纠正
            const lastUserMessage = coreMessages
              .filter((m: any) => m.role === 'user')
              .pop()?.content as string | undefined;
            const userText = (lastUserMessage || '').toLowerCase();

            // 基于用户消息内容的场景纠正：当主 LLM 调用错误工具时强制修正
            const menuKeywords = ['菜单', '菜品', '菜', '推荐', '热销', '热门', '招牌', '搭配', '精选', '吃什么', '有什么吃的'];
            const isMenuIntent = menuKeywords.some(k => userText.includes(k));
            const orderKeywords = ['我的订单', '历史订单', '订单列表', '订单详情', '查看订单', '订单状态'];
            const isOrderIntent = orderKeywords.some(k => userText.includes(k));

            if (!scenario) {
              // 主 LLM 未传入 scenario，根据已调用的工具自动推断
              const toolNames = toolResultsForSubLLM.map((tr) => tr.toolName);
              if (toolNames.includes("search_dish")) scenario = "dish_detail";
              else if (toolNames.includes("query_menu")) scenario = "menu";
              else if (toolNames.includes("get_dish_detail")) scenario = "dish_detail";
              else if (toolNames.includes("get_orders")) scenario = "orders";
              else if (toolNames.includes("get_order_detail")) scenario = "order_detail";
              else if (toolNames.includes("place_order")) scenario = "place_order";
              else scenario = "menu";
              console.log(`[agent] 主 LLM 未传 scenario，根据工具推断: ${scenario}, tools: ${toolNames.join(", ")}`);
            }

            // 场景纠正：用户消息明确是菜单意图，但主 LLM 调用了订单工具
            if (isMenuIntent && !isOrderIntent && scenario && ['orders', 'order_detail'].includes(scenario)) {
              // 检查缓存中是否有菜单数据，有则纠正场景并清空错误工具结果
              if (sessionCache.has('query_menu')) {
                console.log(`[agent] 场景纠正: 用户消息"${lastUserMessage}"是菜单意图，但主 LLM 推断为 ${scenario}，强制修正为 menu（使用缓存数据）`);
                scenario = 'menu';
                toolResultsForSubLLM.length = 0;
              } else {
                console.log(`[agent] 场景纠正: 用户消息"${lastUserMessage}"是菜单意图，但缓存中无 query_menu 数据，保留原始场景 ${scenario}`);
              }
            }

            // 智能场景转换：当 search_dish 只返回一个菜品时，自动转为 dish_detail
            if (scenario === 'menu' || !scenario) {
              const searchData = sessionCache.get('search_dish');
              const dishes = Array.isArray(searchData) ? searchData : (searchData?.data || []);
              if (Array.isArray(dishes) && dishes.length === 1) {
                console.log(`[agent] 智能场景转换: search_dish 只返回 1 个菜品(${dishes[0]?.name})，自动从 menu 转为 dish_detail`);
                scenario = 'dish_detail';
                sessionCache.set('get_dish_detail', dishes[0]);
              }
            }

            console.log(`[agent] generate_a2ui 场景: ${scenario}`);

            // 启动次级 LLM，不阻塞主 LLM
            // toolResultsForSubLLM 通过独立参数传递，避免混入 messages 导致结构错误
            const toolDataSize = toolResultsForSubLLM.reduce(
              (sum, tr) => sum + JSON.stringify(tr.output).length,
              0,
            );
            console.log(
              `[agent] generate_a2ui 启动，scene: ${scenario}, toolResultsForSubLLM 条目数: ${toolResultsForSubLLM.length}, 数据总大小: ${toolDataSize} 字符`,
            );
            generateA2UIPromise = generateA2UIComponents({
              model: kimi_model("kimi-for-coding"),
              messages: coreMessages,
              appType: input.appType,
              scenario: scenario as any,
              toolResults: toolResultsForSubLLM,
              sessionCache,
            })
              .then((result) => {
                console.log(
                  `[agent] 次级 LLM 完成，components 数量: ${result.components?.length || 0}, surfaceId: ${result.surfaceId}`,
                );
                generateA2UIResult = result;
                generateA2UICompleted = true;
                return result;
              })
              .catch((err) => {
                console.error(`[agent] 次级 LLM 生成失败:`, err);
                const fallback = {
                  surfaceId: "error-surface",
                  catalogId:
                    "https://a2ui.org/specification/v0_9/basic_catalog.json",
                  components: [
                    {
                      id: "root",
                      component: "Column",
                      children: ["error-text"],
                    },
                    {
                      id: "error-text",
                      component: "Text",
                      text: "UI 生成失败，请重试",
                    },
                  ],
                };
                generateA2UIResult = fallback;
                generateA2UICompleted = true;
                return fallback;
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
          const argsJson =
            accumulatedArgs ?? JSON.stringify((chunk as any).args ?? {});
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
          const toolName = toolCallNameMap.get(tcId) || (chunk as any).toolName || "";

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

          // 其他工具：收集结果供次级 LLM 使用，同时存入 session 缓存
          const extractedData = extractToolOutput(chunk.output);
          if (toolName) {
            sessionCache.set(toolName, extractedData);
            console.log(`[agent] 缓存工具数据: ${toolName}, 类型: ${typeof extractedData}, 是数组: ${Array.isArray(extractedData)}`);
          }

          toolResultsForSubLLM.push({
            toolCallId: tcId,
            toolName,
            output: chunk.output,
          });
          yield {
            type: EventType.TOOL_CALL_END,
            toolCallId: tcId,
          };
          const resultContent =
            typeof chunk.output === "string"
              ? chunk.output
              : JSON.stringify(chunk.output);
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
    console.log(
      `[agent] 主 LLM 流结束，generateA2UIHandled: ${generateA2UIHandled}, generateA2UICompleted: ${generateA2UICompleted}`,
    );
    if (!generateA2UIHandled && generateA2UIPromise) {
      console.log(`[agent] 流结束后等待次级 LLM 完成...`);
      try {
        const result = await generateA2UIPromise;
        console.log(
          `[agent] 流结束后次级 LLM 完成，发送 ACTIVITY_SNAPSHOT (components: ${result.components?.length || 0})`,
        );
        if (result) {
          yield createA2UIActivitySnapshot(result);
        }
      } catch (err) {
        console.error(`[agent] 流结束后等待次级 LLM 失败:`, err);
        yield createA2UIActivitySnapshot({
          surfaceId: "error-surface",
          components: [
            { id: "root", component: "Column", children: ["error-text"] },
            {
              id: "error-text",
              component: "Text",
              text: "UI 生成失败，请重试",
            },
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
