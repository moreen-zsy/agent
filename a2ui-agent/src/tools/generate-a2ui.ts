import { streamText, jsonSchema, type ModelMessage } from "ai";
import type { LanguageModel } from "ai";

const SCENARIO_MAP: Record<string, string> = {
  menu: '生成 Carousel 轮播图。items 使用 { path: "/dishes" } 数据绑定，不要展开数组。必须加 action:{event:{name:"view_dish_detail"}}，data:{dishes:[...]}',
  dish_detail: '生成 DishDetail 组件。dish 字段传入完整菜品对象（含 id, name, price, description, fullDescription, image, ingredients, tags），data:{dish:{...}}',
  orders: '生成 OrderCard 列表。data:{orders:[...]}，每个 order 用 {path:"/orders/索引"}，将所有 OrderCard 放入一个 Column 中',
  order_detail: '生成 OrderDetail 组件。order 字段传入完整订单对象，data:{order:{...}}',
  place_order: '生成 Text("下单成功！") + OrderCard 组件。data:{order:{...}}',
};

const uiDesignerSystemPrompt = `你是 A2UI UI 设计专家。根据用户请求和业务数据，调用 render_a2ui 工具生成 A2UI v0.9 组件。

【可用组件】（扁平格式，属性直接放组件对象上）：
- Column: { component: "Column", children: ["id1", ...], justify?: "start"|"center"|"end"|"spaceBetween"|"spaceAround"|"spaceEvenly", align?: "start"|"center"|"end"|"stretch" }
- Row: { component: "Row", children: ["id1", ...], justify?, align? }
- List: { component: "List", children: ["id1", ...], direction?: "vertical"|"horizontal", align?: "start"|"center"|"end"|"stretch" }
- Card: { component: "Card", child: "id" }
- Text: { component: "Text", text: string, variant?: "h1"|"h2"|"h3"|"h4"|"h5"|"caption"|"body" }
- Image: { component: "Image", url: string, fit?: "contain"|"cover"|"fill" }
- Button: { component: "Button", child: "id", variant?: "primary"|"secondary"|"text", action?: { event: { name, context? } } }
- Icon, Chip, Divider, Spacer
- Carousel: { component: "Carousel", items: { path: "/dishes" }, autoPlay?, interval?, action? } — items 推荐用 {path} 数据绑定，不要展开数组
- OrderCard: { component: "OrderCard", order: { path: string } | OrderObject }
- DishDetail: { component: "DishDetail", dish: { path: string } | DishObject }（含购物车按钮）
- OrderDetail: { component: "OrderDetail", order: { path: string } | OrderObject }

【设计原则】
1. 根组件 id 必须为 "root"
2. catalogId 固定为 "https://a2ui.org/specification/v0_9/basic_catalog.json"
3. children 用 ID 字符串数组引用，禁止嵌套对象；Card 用单数 child
4. Image 用 url 属性，必须使用真实业务数据 URL
5. 标题通过父级 Column 的 align: "center" 实现居中

【场景规则】
1. 菜单(query_menu)：Carousel 展示全部菜品，items 每项 { id, imageUrl, title, description: "¥"+price+" | "+desc }，必须加 action:{event:{name:"view_dish_detail"}}，data:{dishes:[...]}
2. 菜品详情(get_dish_detail)：DishDetail 组件，dish 传完整对象，data:{dish:{...}}
3. 我的订单(get_orders)：OrderCard 列表，data:{orders:[...]}，每个 order:{path:"/orders/索引"}
4. 订单详情(get_order_detail)：OrderDetail 组件，data:{order:{...}}
5. 下单成功(place_order)：Text("下单成功！") + OrderCard，data:{order:{...}}`;

export interface GenerateA2UIInput {
  /** 已初始化的语言模型实例（由调用方传入） */
  model: LanguageModel;
  /** 当前对话历史（供次级 LLM 理解上下文） */
  messages: ModelMessage[];
  /** 应用类型，影响组件风格 */
  appType: string;
  /** 当前场景标识（由主 LLM 传入，直接决定生成什么组件） */
  scenario?: "menu" | "dish_detail" | "orders" | "order_detail" | "place_order";
  /** 当前轮次已完成的业务工具结果（不混入 messages，避免结构错误） */
  toolResults?: Array<{ toolCallId: string; toolName: string; output: unknown }>;
  /** Session 级数据缓存，优先从缓存读取避免重复调用 MCP */
  sessionCache?: Map<string, any>;
}

/**
 * 从当前轮次的 tool result 中提取业务数据，注入 system prompt。
 * 注意：只使用 extraToolResults（当前轮次），不使用历史 messages 中的 tool result，
 * 避免历史数据（如旧订单）干扰当前请求（如查菜单）。
 */
/**
 * 根据 scenario 和 toolResults 直接构造 data 模型
 * 避免让 LLM 输出大量业务数据
 */
function buildDataFromToolResults(
  scenario: GenerateA2UIInput["scenario"],
  toolResults?: GenerateA2UIInput["toolResults"],
  sessionCache?: Map<string, any>,
): Record<string, any> | undefined {
  if (!scenario) return undefined;
  // 允许 toolResults 为空，只要 sessionCache 有数据即可
  const hasToolResults = toolResults && toolResults.length > 0;
  const hasCache = sessionCache && sessionCache.size > 0;
  if (!hasToolResults && !hasCache) return undefined;

  const findOutput = (name: string): any => {
    // 优先从 sessionCache 读取
    if (sessionCache?.has(name)) {
      return sessionCache.get(name);
    }

    const tr = toolResults?.find((t) => t.toolName === name);
    if (!tr) return null;

    let output: any = tr.output;

    // MCP 工具返回 { content: [{ type: "text", text: "JSON" }] }
    if (output && typeof output === "object" && Array.isArray(output.content)) {
      const textItem = output.content.find((c: any) => c.type === "text");
      if (textItem?.text) {
        try {
          output = JSON.parse(textItem.text);
        } catch {
          output = textItem.text;
        }
      }
    }

    // 统一提取实际数据
    // 1. API 标准响应: { data: [...] }
    // 2. 本地工具: { success: true, items: [...] }
    if (output && typeof output === "object") {
      if (output.data !== undefined) return output.data;
      if (output.items !== undefined) return output.items;
    }

    return output;
  };

  switch (scenario) {
    case "menu": {
      const data = findOutput("query_menu");
      return data ? { dishes: data } : undefined;
    }
    case "dish_detail": {
      // 优先从 get_dish_detail 获取，其次是 search_dish 的结果
      const data = findOutput("get_dish_detail") || findOutput("search_dish");
      return data ? { dish: data } : undefined;
    }
    case "orders": {
      const data = findOutput("get_orders");
      return data ? { orders: data } : undefined;
    }
    case "order_detail": {
      const data = findOutput("get_order_detail");
      if (!data) return undefined;
      // get_order_detail 返回 {order: {...}, history: [...]}，提取内层 order
      const orderData = data.order !== undefined ? data.order : data;
      return { order: orderData };
    }
    case "place_order": {
      const data = findOutput("place_order");
      return data ? { order: data } : undefined;
    }
    default:
      return undefined;
  }
}

function extractToolData(
  _messages: ModelMessage[],
  extraToolResults?: Array<{ toolCallId: string; toolName: string; output: unknown }>,
): string {
  const results: string[] = [];

  // 只使用当前轮次的业务工具结果
  if (extraToolResults) {
    for (const tr of extraToolResults) {
      let output: any = tr.output;
      // MCP 工具返回 { content: [{ type: "text", text: "..." }] }，提取实际文本
      if (output && typeof output === "object" && Array.isArray(output.content)) {
        const textItem = output.content.find((c: any) => c.type === "text");
        if (textItem?.text) {
          output = textItem.text;
        }
      }
      const text = typeof output === "string" ? output : JSON.stringify(output);
      if (text) results.push(text);
    }
  }

  if (results.length === 0) return "";
  const output = `\n\n【可用业务数据】（必须严格使用以下数据，严禁编造）：\n${results.join("\n---\n")}`;
  console.log(`[generate-a2ui] extractToolData 提取数据，条目数: ${results.length}, 总长度: ${output.length} 字符`);
  return output;
}

/**
 * 调用次级 LLM 生成 A2UI v0.9 组件。
 * 次级 LLM 被强制调用 render_a2ui（toolChoice），确保一定会生成 UI。
 */
export async function generateA2UIComponents(
  input: GenerateA2UIInput,
): Promise<{
  surfaceId: string;
  catalogId: string;
  components: any[];
  data?: any;
}> {
  const { model, messages, appType, scenario, toolResults, sessionCache } = input;

  // 根据 scenario 直接确定组件，无需推理
  const scenarioDirective = scenario
    ? `\n\n【当前场景】${scenario} — 你必须直接生成以下组件，不要思考或分析：\n${SCENARIO_MAP[scenario]}\n注意：你只需要生成 components 数组，data 由服务端自动填充，不要在 render_a2ui 中传入 data 参数。`
    : "";

  try {
    const toolData = extractToolData([], toolResults);
    const systemPrompt = `${uiDesignerSystemPrompt}${scenarioDirective}\n\n当前应用类型：${appType}${toolData}`;
    console.log(`[generate-a2ui] streamText 启动，scene: ${scenario || "none"}, system prompt 长度: ${systemPrompt.length} 字符, messages 数量: ${messages.length}`);

    const result = await streamText({
      model,
      system: systemPrompt,
      messages: messages.filter((m) => m.role !== "system"),
      tools: {
        render_a2ui: {
          description:
            "渲染 A2UI v0.9 组件。你只需要生成 components 数组，数据模型(data)由服务端自动填充，不要传入 data。",
          inputSchema: jsonSchema({
            type: "object",
            properties: {
              surfaceId: {
                type: "string",
                description: "Surface 唯一标识符",
              },
              catalogId: {
                type: "string",
                description: "Catalog URI",
              },
              components: {
                type: "array",
                description:
                  "A2UI v0.9 组件数组（扁平格式）。root 组件 id 必须为 'root'，children 通过 ID 引用。",
              },
            },
            required: ["surfaceId", "catalogId", "components"],
            additionalProperties: false,
          }),
          execute: async (args: any) => args,
        },
      },
      toolChoice: { type: "tool", toolName: "render_a2ui" },
    });

    // 提取 render_a2ui 的参数
    let renderArgs: any = null;
    let toolCallArgs: any = null;
    let hasTextOutput = false;
    let chunkCount = 0;

    for await (const chunk of result.fullStream) {
      chunkCount++;
      if (chunk.type === "tool-result") {
        console.log(`[generate-a2ui] 收到 tool-result chunk，output 类型: ${typeof (chunk as any).output}`);
        renderArgs = (chunk as any).output;
      } else if (chunk.type === "tool-call") {
        console.log(`[generate-a2ui] 收到 tool-call chunk`);
        // 备份：如果 tool-result 没有到达，尝试从 tool-call 的 args 提取
        // AI SDK v6 中 args 可能是 JSON 字符串，需要解析
        const raw = (chunk as any).args ?? (chunk as any).input ?? null;
        if (typeof raw === "string") {
          try {
            toolCallArgs = JSON.parse(raw);
          } catch {
            toolCallArgs = raw;
          }
        } else {
          toolCallArgs = raw;
        }
      } else if (chunk.type === "text-delta") {
        hasTextOutput = true;
      }
    }
    console.log(`[generate-a2ui] fullStream 结束，总 chunk 数: ${chunkCount}, hasTextOutput: ${hasTextOutput}, renderArgs: ${!!renderArgs}, toolCallArgs: ${!!toolCallArgs}`);

    // 优先使用 tool-result 的 output，其次回退到 tool-call 的 args
    const finalArgs = renderArgs ?? toolCallArgs;

    if (!finalArgs || !finalArgs.components) {
      console.error("[generate-a2ui] 未收到有效组件数据。有文本输出:", hasTextOutput, "tool-call args:", toolCallArgs);
      throw new Error("次级 LLM 未返回有效的组件数据");
    }

    console.log(`[generate-a2ui] 成功生成组件，surfaceId: ${finalArgs.surfaceId}, components 数量: ${finalArgs.components?.length || 0}`);

    // 服务端根据 scenario 和 toolResults 直接构造 data，避免 LLM 输出大量数据
    const data = buildDataFromToolResults(scenario, toolResults, sessionCache);
    if (data) {
      console.log(`[generate-a2ui] 服务端构造 data，keys: ${Object.keys(data).join(", ")}`);
    }

    return {
      surfaceId:
        finalArgs.surfaceId || "a2ui-surface",
      catalogId:
        finalArgs.catalogId ||
        "https://a2ui.org/specification/v0_9/basic_catalog.json",
      components: finalArgs.components,
      data,
    };
  } catch (err) {
    console.error("[generate-a2ui] 次级 LLM 调用失败:", err);
    // 返回错误提示组件作为降级
    return {
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
  }
}
