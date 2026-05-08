import { streamText, jsonSchema, type ModelMessage } from "ai";
import type { LanguageModel } from "ai";

const uiDesignerSystemPrompt = `你是 A2UI UI 设计专家。你的唯一任务是根据用户请求和业务数据，调用 render_a2ui 工具生成合适的 A2UI v0.9 组件。

可用组件及属性（扁平格式，属性直接放在组件对象上）：
- Column: { component: "Column", children: ["id1", ...], justify?: "start"|"center"|"end"|"spaceBetween"|"spaceAround"|"spaceEvenly", align?: "start"|"center"|"end"|"stretch" }
- Row: { component: "Row", children: ["id1", ...], justify?, align? }
- List: { component: "List", children: ["id1", ...], direction?: "vertical"|"horizontal", align?: "start"|"center"|"end"|"stretch" }
- Card: { component: "Card", child: "id" } — 单个子组件引用
- Text: { component: "Text", text: string, variant?: "h1"|"h2"|"h3"|"h4"|"h5"|"caption"|"body" }
- Image: { component: "Image", url: string, fit?: "contain"|"cover"|"fill", usageHint?: "icon"|"avatar"|"smallFeature"|"mediumFeature"|"largeFeature"|"header" }
- Button: { component: "Button", child: "id", variant?: "primary"|"secondary"|"text", action?: { event: { name, context? } } }
- Icon: { component: "Icon", name: string }
- Chip: { component: "Chip", label: string }
- Divider: { component: "Divider" }
- Spacer: { component: "Spacer" }
- TextField: { component: "TextField", label: string, text?: string }
- CheckBox: { component: "CheckBox", label: string, checked?: boolean }
- ChoicePicker: { component: "ChoicePicker", options: [{label, value}], selections?: string[] }
- Slider: { component: "Slider", value: number, minValue?: number, maxValue?: number }
- Switch: { component: "Switch", value: boolean }
- Tabs: { component: "Tabs", tabItems: [{ title: string, child: "id" }] }
- Modal: { component: "Modal", entryPointChild: "id", contentChild: "id" }
- Carousel: { component: "Carousel", items: [{ imageUrl: string, title?: string, description?: string }], autoPlay?: boolean, interval?: number }
  示例：{ component: "Carousel", id: "menu-carousel", items: [{ imageUrl: "/dish-burger.jpg", title: "经典牛肉汉堡", description: "¥38 | 精选澳洲牛肉" }, ...] }

设计原则：
1. 每个组件必须包含 component 字段（如 "component": "Column"），不能用 type 或其他字段名
2. 数据密集（菜单列表、设施列表等）→ 用 List + Card 组合展示
3. 单一对象详情（菜品详情、设施详情等）→ 用 Column + Text/Image 组合
4. 表单输入 → 用 TextField、ChoicePicker、Button 组合
5. 所有组件使用扁平格式：属性直接放在组件对象上，不要用 props 嵌套
6. children 必须通过 ID 字符串数组引用，不要嵌套对象
7. Card 使用单数 child 引用，不是 children
8. Image 使用 url 属性，不是 src；图片 URL 必须使用业务数据中的真实路径（如 "/dish-burger.jpg"），不要用占位图
9. Text 使用 variant 属性设置样式，不是 style
10. 根组件 id 必须为 "root"
11. 【强制】菜单展示必须使用 Carousel 轮播图组件。items 数组必须包含 API 返回的【全部】菜品，严禁只选部分。每个 item 必须使用 API 返回的准确数据：imageUrl 用菜品对象的 image 字段（如 "/dish-burger.jpg"），title 用 name 字段，description 用 "¥{price} | {description}" 格式。严禁编造、修改或省略任何菜品数据
12. Carousel items 映射规则：严格按 API 返回的 data 数组顺序，每项映射为 { imageUrl: item.image, title: item.name, description: "¥" + item.price + " | " + item.description }，禁止自行改写名称、价格或图片路径
13. catalogId 使用 "https://a2ui.org/specification/v0_9/basic_catalog.json"`;

export interface GenerateA2UIInput {
  /** 已初始化的语言模型实例（由调用方传入） */
  model: LanguageModel;
  /** 当前对话历史（供次级 LLM 理解上下文） */
  messages: ModelMessage[];
  /** 应用类型，影响组件风格 */
  appType: string;
}

/**
 * 从对话历史的 tool result 中提取业务数据，注入 system prompt。
 */
function extractToolData(messages: ModelMessage[]): string {
  const results: string[] = [];

  for (const msg of messages) {
    if (msg.role !== "tool") continue;

    const content = (msg as any).content;

    // SDK v6: content 是数组，每项是 ToolResultPart
    if (Array.isArray(content)) {
      for (const part of content) {
        if (part.type !== "tool-result") continue;
        const output = part.output ?? part.result;
        let text = "";
        if (typeof output === "string") {
          text = output;
        } else if (output && typeof output === "object") {
          text = output.value || JSON.stringify(output);
        }
        if (text) results.push(text);
      }
      continue;
    }

    // 备用：content 直接是字符串
    if (typeof content === "string" && content) {
      results.push(content);
      continue;
    }

    // 备用：检查 msg 上的 result/output 字段
    for (const key of ["result", "output", "content"]) {
      const val = (msg as any)[key];
      if (typeof val === "string" && val) {
        results.push(val);
        break;
      }
    }
  }

  if (results.length === 0) return "";
  return `\n\n【可用业务数据】（必须严格使用以下数据，严禁编造）：\n${results.join("\n---\n")}`;
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
  const { model, messages, appType } = input;

  try {
    const toolData = extractToolData(messages);
    const result = await streamText({
      model,
      system: `${uiDesignerSystemPrompt}\n\n当前应用类型：${appType}${toolData}`,
      messages: messages.filter((m) => m.role !== "system" && m.role !== "tool"),
      tools: {
        render_a2ui: {
          description:
            "渲染 A2UI v0.9 组件。根据对话上下文生成合适的 UI 组件来展示数据。",
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
              data: {
                type: "object",
                description: "可选的初始数据模型",
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

    for await (const chunk of result.fullStream) {
      if (chunk.type === "tool-result") {
        renderArgs = (chunk as any).output;
      } else if (chunk.type === "tool-call") {
        // 备份：如果 tool-result 没有到达，尝试从 tool-call 的 args 提取
        toolCallArgs = (chunk as any).args ?? (chunk as any).input ?? null;
      } else if (chunk.type === "text-delta") {
        hasTextOutput = true;
      }
    }

    // 优先使用 tool-result 的 output，其次回退到 tool-call 的 args
    const finalArgs = renderArgs ?? toolCallArgs;

    if (!finalArgs || !finalArgs.components) {
      console.error("[generate-a2ui] 未收到有效组件数据。有文本输出:", hasTextOutput, "tool-call args:", toolCallArgs);
      throw new Error("次级 LLM 未返回有效的组件数据");
    }

    return {
      surfaceId:
        renderArgs.surfaceId || "a2ui-surface",
      catalogId:
        renderArgs.catalogId ||
        "https://a2ui.org/specification/v0_9/basic_catalog.json",
      components: renderArgs.components,
      data: renderArgs.data,
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
