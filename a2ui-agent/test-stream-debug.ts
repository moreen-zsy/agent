import { resolve } from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: resolve(import.meta.dirname, '../.env') });

import { streamText, stepCountIs, jsonSchema } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";

const kimi_model = createAnthropic({
  apiKey: process.env.KIMI_API_KEY,
  baseURL: "https://api.kimi.com/coding/v1",
});

const renderA2UITool = {
  name: "render_a2ui",
  description: "Render a dynamic A2UI v0.9 surface with structured parameters.",
  parameters: jsonSchema({
    type: "object",
    properties: {
      surfaceId: { type: "string", description: "Unique surface identifier." },
      catalogId: { type: "string", description: "The catalog ID for the component catalog." },
      components: { type: "array", description: 'A2UI v0.9 component array (flat format).', items: { type: "object" } },
      data: { type: "object", description: "Initial data model for the surface." }
    },
    required: ["surfaceId", "components"],
    additionalProperties: false,
  }),
  execute: async (args: any) => {
    console.log("[EXECUTE] render_a2ui args:", JSON.stringify(args).slice(0, 200));
    return { status: "rendered", toolName: "render_a2ui", args };
  },
};

const queryMenuTool = {
  name: "query_menu",
  description: "Query the food menu",
  parameters: jsonSchema({
    type: "object",
    properties: {
      category: { type: "string" },
      page: { type: "number" },
      pageSize: { type: "number" },
    },
    additionalProperties: false,
  }),
  execute: async (args: any) => {
    console.log("[EXECUTE] query_menu args:", JSON.stringify(args));
    return {
      data: [
        { id: "1", name: "汉堡", description: "好吃的汉堡", price: "28.00" },
        { id: "2", name: "披萨", description: "美味的披萨", price: "38.00" },
      ],
      pagination: { page: 1, pageSize: 10, total: 2, totalPages: 1 }
    };
  },
};

const A2UI_SCHEMA = {
  catalogId: 'https://a2ui.org/specification/v0_9/basic_catalog.json',
  components: {
    Text: { description: '文本组件' },
    Column: { description: '垂直布局' },
    Row: { description: '水平布局' },
    List: { description: '列表' },
    Card: { description: '卡片' },
    Button: { description: '按钮组件' },
    Image: { description: '图片组件' },
    Chip: { description: '标签芯片' },
  }
};

const A2UI_GUIDE = `## How to call render_a2ui

You MUST provide ALL required arguments:
- surfaceId (string, required): Unique ID for the surface.
- components (array, required): A2UI v0.9 component array (flat format). The root component must have id root.
- catalogId (string): The catalog ID.
- data (object): Initial data model for the surface.

Components are a flat array — children are referenced by ID, not nested:
- Every component has id (unique) and component (type name from the available catalog).
- The root component MUST have id: "root".
- Properties go directly on the component object.
- Use children: ["id1", "id2"] for multiple children.

Example:
{
  "surfaceId": "my-dashboard",
  "catalogId": "https://a2ui.org/specification/v0_9/basic_catalog.json",
  "components": [
    { "id": "root", "component": "Column", "children": ["title", "row1"] },
    { "id": "title", "component": "Text", "text": "Overview" },
    { "id": "row1", "component": "Row", "children": ["m1", "m2"], "gap": 16 }
  ]
}`;

async function main() {
  const result = await streamText({
    model: kimi_model("kimi-for-coding"),
    system: `你是 A2UI 智能助手，专门负责生成动态 UI 界面。

核心职责：
1. 理解用户需求，调用合适的工具获取数据
2. **获取数据后，必须调用 render_a2ui 工具生成 A2UI v0.9 组件来展示数据**，而不是仅仅用文字描述
3. 使用 A2UI 组件（如 Column、Row、Card、List、Text、Image、Button 等）构建直观的用户界面
4. 所有组件使用扁平格式，children 通过 ID 引用

何时使用 render_a2ui：
- 查询到列表数据（菜单、订单、预约等）→ 用 List/Card 组件展示
- 查询到详情数据 → 用 Column/Row 组件展示
- 需要用户交互 → 用 Button/TextField/ChoicePicker 等组件
- 任何适合可视化展示的场景

render_a2ui 调用后，你会继续以文本形式向用户说明界面内容。

A2UI Component Schema: ${JSON.stringify(A2UI_SCHEMA)}

${A2UI_GUIDE}`,
    messages: [{ role: "user", content: "有什么好吃的" }],
    tools: {
      render_a2ui: renderA2UITool,
      query_menu: queryMenuTool,
    },
    stopWhen: stepCountIs(5),
  });

  const toolCallInputs = new Map<string, string>();

  for await (const chunk of result.fullStream) {
    console.log("[CHUNK] type:", chunk.type);

    if (chunk.type === "tool-input-start") {
      const tcId = (chunk as any).toolCallId || (chunk as any).id;
      console.log("[CHUNK] tool-input-start tcId:", tcId);
      toolCallInputs.set(tcId, "");
    }
    if (chunk.type === "tool-input-delta") {
      const tcId = (chunk as any).toolCallId || (chunk as any).id;
      const delta = (chunk as any).inputTextDelta || (chunk as any).delta || "";
      console.log("[CHUNK] tool-input-delta tcId:", tcId, "delta:", delta.slice(0, 80));
      const current = toolCallInputs.get(tcId) || "";
      toolCallInputs.set(tcId, current + delta);
    }
    if (chunk.type === "tool-call") {
      const tcId = (chunk as any).toolCallId;
      const toolName = (chunk as any).toolName;
      const args = (chunk as any).args;
      const accumulated = toolCallInputs.get(tcId);
      console.log("[CHUNK] tool-call tcId:", tcId, "toolName:", toolName);
      console.log("[CHUNK] tool-call chunk.args:", JSON.stringify(args)?.slice(0, 100));
      console.log("[CHUNK] tool-call accumulated:", accumulated?.slice(0, 100));
    }
    if (chunk.type === "tool-result") {
      const tcId = (chunk as any).toolCallId;
      const output = (chunk as any).output;
      console.log("[CHUNK] tool-result tcId:", tcId, "output:", JSON.stringify(output)?.slice(0, 100));
    }
    if (chunk.type === "text-delta") {
      process.stdout.write((chunk as any).text);
    }
  }

  console.log("\n[DEBUG] Stream finished");
}

main().catch(console.error);
