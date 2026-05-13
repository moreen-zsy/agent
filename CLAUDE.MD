# @a2ui/monorepo

## 项目背景(中文Cot)

A2UI（Agent-to-User Interface）是专为 AI Agent 设计的生成式 UI 协议。本项目基于 **A2UI v0.9** 协议，使用 **AGUI** 作为标准化传输层，构建一个与业务无关的 Agent 引擎，可为任意前端应用提供服务。

核心理念：

```
传统 UI：需求 → 设计 → 编码 → 测试 → 上线（天/周级）
A2UI：    任务 → AI 生成 UI 描述 → 协议传输 → 渲染（秒级）
```

v0.9 相比 v0.8 的关键改进：

- **扁平组件格式**：`{component: "Text", text: "Hello"}` 替代嵌套结构
- **DynamicValue**：统一字面量、`{path}` 数据绑定、`{call}` 函数调用
- **AGUI 传输层**：标准化事件流（RUN_STARTED → TEXT_MESSAGE → ACTIVITY_SNAPSHOT → RUN_FINISHED）
- **双 LLM 架构**：主 LLM 处理业务工具 + `generate_a2ui`，次级 LLM 强制 `render_a2ui` 生成组件
- **服务端自治**：服务端直接构造 `ACTIVITY_SNAPSHOT` 事件，客户端无需拦截 tool call
- **消息级 A2UI 渲染**：每条 assistant 消息拥有独立 Surface，多轮对话 UI 互不干扰

## 架构分层

```
客户端（Client）                                                服务端（Server）
┌──────────────────────────────────────────────────────────┐   ┌─────────────────────────────┐
│  HttpAgent + A2UIMiddleware (injectA2UITool: false)      │   │                             │
│         ↓ 注入 schema（不再拦截 render_a2ui）              │   │  ┌──────────────────────┐   │
│         ↓ HTTP/SSE 流式传输                               │   │  │    a2ui-server       │   │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐  │AGU│  │  Elysia 路由          │   │
│  │  @a2ui/core │─▶│@a2ui/react  │─▶│      DOM         │  │I  │  └──────────┬───────────┘   │
│  │ 协议解析     │  │ -render     │  │                  │  │事 │             ↓               │
│  │ A2UIStore    │  │ A2UIRenderer│  │                  │  │件 │  ┌──────────────────────┐   │
│  │ AgentConv.   │  │ A2UIChatMsg │  │                  │  │流 │  │    a2ui-agent        │   │
│  │ SurfaceBind. │  └─────────────┘  └──────────────────┘  │◄─►│  │  ┌────────────────┐  │   │
│  └─────────────┘                                         │   │  │  │   主 LLM        │  │   │
│       ↑                                                   │   │  │  │  streamText     │  │   │
│  ┌─────────────┐                                         │   │  │  │  + 业务工具(MCP) │  │   │
│  │  业务应用    │  apps/playground                        │   │  │  └───────┬────────┘  │   │
│  │ AgentTest.tsx│    (消息级 A2UI + Streamdown)           │   │  │          ↓ generate_a2ui │
│  └─────────────┘                                         │   │  │  ┌────────────────┐  │   │
└──────────────────────────────────────────────────────────┘   │  │  │   次级 LLM      │  │   │
                                                               │  │  │  强制 render_a2ui│  │   │
                                                               │  │  │  (toolChoice)   │  │   │
                                                               │  │  └───────┬────────┘  │   │
                                                               │  │          ↓            │   │
                                                               │  │  ┌────────────────┐  │   │
                                                               │  │  │ ACTIVITY_SNAPSHOT│  │   │
                                                               │  │  │ (a2ui_operations)│  │   │
                                                               │  │  └────────────────┘  │   │
                                                               │  └──────────┬───────────┘   │
                                                               │             ↓               │
                                                               │  ┌──────────────────────┐   │
                                                               │  │   MCP Clients        │   │
                                                               │  │  createMCPClient     │   │
                                                               │  │  + StdioTransport    │   │
                                                               │  └──────────┬───────────┘   │
                                                               │             ↓               │
                                                               │  ┌──────────────────────┐   │
                                                               │  │   MCP Servers        │   │
                                                               │  │ ┌─────┐  ┌────────┐  │   │
                                                               │  │ │food │  │campus  │  │   │
                                                               │  │ │-mcp │  │ -mcp   │  │   │
                                                               │  │ └──┬──┘  └───┬────┘  │   │
                                                               │  └────┼────────┼───────┘   │
                                                               │       ↓        ↓           │
                                                               │  ┌──────────────────────┐   │
                                                               │  │ a2ui-server REST API │   │
                                                               │  └──────────────────────┘   │
                                                               └─────────────────────────────┘
```

**分层说明：**

| 包             | 运行环境   | 职责                                                                                                                                           |
| -------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `a2ui-agent`   | 服务端     | 双 LLM 代理：主 LLM 处理业务工具 + `generate_a2ui`；次级 LLM 强制 `render_a2ui` 生成组件；直接构造 `ACTIVITY_SNAPSHOT`                         |
| `a2ui-server`  | 服务端     | 传输层：Elysia HTTP 路由，接收 AGUI 请求，流式响应                                                                                             |
| `a2ui-core`    | **客户端** | 协议层：v0.9 协议解析、状态管理、树构建、增量更新；**新增** `AgentConversation`（对话历史管理）、`SurfaceMessageBinder`（消息级 Surface 绑定） |
| `a2ui-render`  | **客户端** | 视图层：将 v0.9 协议树渲染为 React / Vue 组件；**新增** `A2UIChatMessage`（消息级 Surface + 文本组合渲染）                                     |
| `@ag-ui/*`     | 客户端     | AGUI 生态：HttpAgent 传输、A2UIMiddleware（现仅注入 schema，`injectA2UITool: false`）                                                          |
| **MCP Client** | 服务端     | `@ai-sdk/mcp` `createMCPClient` + `StdioClientTransport`                                                                                       |
| **MCP Server** | 服务端     | `food-mcp` / `campus-mcp`：业务工具封装，调用 REST API                                                                                         |

- **双 LLM 架构**：主 LLM 负责业务推理和触发 `generate_a2ui`；次级 LLM（非阻塞后台运行）通过 `toolChoice: {type: "tool", toolName: "render_a2ui"}` 强制生成组件，确保 UI 质量
- **服务端自治**：`a2ui-agent` 直接构造 `ACTIVITY_SNAPSHOT` 事件（含 `a2ui_operations`），客户端 A2UIMiddleware 不再需要拦截 `render_a2ui`
- **非阻塞 UI 生成**：次级 LLM 在后台运行，主 LLM 的 Markdown 文本流不受阻塞，用户先看到文字说明，后看到 UI 组件
- **消息级 A2UI**：每条 assistant 消息拥有独立 Surface（通过 `SurfaceMessageBinder` 生成消息级唯一 `surfaceId`），多轮对话的 UI 互不覆盖
- `core` 与 `render` 解耦：`core` 纯 TypeScript 不依赖框架
- **MCP 工具链**：业务工具通过 MCP Server 实现，Agent Engine 通过 MCP Client 动态获取，支持工具热更新和多领域隔离

## 目录结构

```
d:/agent/
├── a2ui-agent/              # @a2ui/agent — LLM 代理（纯转发）
│   ├── src/
│   │   ├── engine/          # streamText 调用 + 业务工具注入
│   │   ├── tools/           # 业务工具定义
│   │   │   ├── mcp-tools.ts     # MCP 工具构建器（createMCPClient）
│   │   │   └── local-tools.ts   # 本地 mock 工具（测试回退）
│   │   ├── mcp-client.ts  # 独立 MCP CLI 客户端（调试/演示）
│   │   └── types.ts         # AgentInput 类型
│   ├── mcp/                 # MCP Servers（业务领域隔离）
│   │   ├── food-mcp/        # 点餐领域 MCP Server
│   │   │   └── src/index.ts # 9 个工具（菜单/订单管理）
│   │   └── campus-mcp/      # 校园领域 MCP Server
│   │       └── src/index.ts # 8 个工具（设施/预约/缴费）
│   ├── package.json
│   └── tsconfig.json
│
├── a2ui-core/               # @a2ui/core — v0.9 协议层
│   ├── src/
│   │   ├── types.ts         # v0.9 核心类型（DynamicValue、ChildList、Action）
│   │   ├── catalog.ts       # standardCatalogV09（Zod Schema）
│   │   ├── parser.ts        # JSONL 流式解析器
│   │   ├── store.ts         # 状态管理 + action 发送
│   │   ├── data-model.ts    # DynamicValue 解析、数据绑定
│   │   ├── tree-builder.ts  # 扁平组件 → 树形 VNode
│   │   ├── buffer.ts        # Surface 级消息缓冲（createSurface/updateComponents/...）
│   │   ├── agent-conversation.ts  # AgentConversation：OpenAI 格式对话历史管理
│   │   └── surface-binder.ts      # SurfaceMessageBinder：消息级 Surface 唯一 ID 绑定
│   ├── package.json
│   └── tsconfig.json
│
├── a2ui-render/             # 渲染层
│   ├── react-render/        # @a2ui/react-render — React 19 渲染器
│   │   ├── src/
│   │   │   ├── VNodeRenderer.tsx    # DynamicValue 解析 + Template children
│   │   │   ├── renderer.tsx         # Surface 渲染入口
│   │   │   ├── chat-message.tsx     # A2UIChatMessage：消息级 Surface + 文本组合渲染
│   │   │   ├── catalog/             # 组件注册表（v0.9 catalog URI）
│   │   │   └── components/          # 18+ 标准组件（ChoicePicker/Modal/Chip/Switch...）
│   └── vue-render/          # @a2ui/vue-render — Vue 3 渲染器（待实现）
│
├── a2ui-server/             # @a2ui/server — 服务端传输层
│   ├── src/
│   │   ├── index.ts         # Elysia 服务入口
│   │   ├── routes/          # /api/agent/stream 流端点
│   │   └── services/        # agent-service 透传逻辑
│   ├── package.json
│   └── tsconfig.json
│
├── apps/                    # 业务应用
│   ├── playground/          # Agent 实时测试面板（消息级 A2UI + Streamdown）
│   │   └── src/components/AgentTest.tsx   # AgentConversation + SurfaceMessageBinder + A2UIChatMessage
│   ├── gusto/               # Gusto 应用（H5 React）
│   │   └── H5_react/
│   └── campus-web/          # 校园助手应用
│       └── src/components/ChatPanel.tsx   # HttpAgent + A2UIMiddleware 集成示例
│
├── docs/                    # 项目文档
│   ├── 项目概述.md
│   └── 开发计划.md
│
├── specification/v0_9/      # A2UI v0.9 官方协议规范
│   ├── json/                # basic_catalog.json / server_to_client.json
│   └── docs/                # evolution_guide.md 迁移指南
│
├── package.json             # Bun Workspace + Catalogs
├── bunfig.toml
└── tsconfig.json
```

## 技术栈

| 层级        | 技术                                                 | 说明                         |
| ----------- | ---------------------------------------------------- | ---------------------------- |
| 运行时      | Bun                                                  | 高性能 JS/TS 运行时          |
| 语言        | TypeScript                                           | 类型安全                     |
| Monorepo    | Bun Workspace + Catalogs                             | 统一依赖版本管理             |
| 前端框架    | React 19 / Vue 3                                     | UI 渲染                      |
| 构建工具    | Vite                                                 | 前端开发服务器和构建         |
| 服务端      | Elysia                                               | 高性能 Bun 服务端框架        |
| Agent SDK   | ai / @ai-sdk/openai                                  | LLM 调用和流式处理           |
| AGUI 生态   | @ag-ui/client / @ag-ui/a2ui-middleware / @ag-ui/core | 标准化传输层 + A2UI 协议转换 |
| MCP         | @ai-sdk/mcp / @modelcontextprotocol/sdk              | MCP Client + MCP Server 实现 |
| Schema 验证 | Zod                                                  | 运行时类型安全               |
| 测试        | Vitest                                               | 单元测试                     |

## 依赖管理规范（Bun Workspace + Catalogs）

本项目使用 Bun Workspace 管理 monorepo，所有依赖版本**必须通过根 `package.json` 的 `catalog` / `catalogs` 统一管理**，禁止在工作区包中直接写死版本号（除 `workspace:*` 和 `tailwindcss` 外）。

### Catalog 分类

| Catalog           | 用途            | 包含依赖                                                                                                    |
| ----------------- | --------------- | ----------------------------------------------------------------------------------------------------------- |
| `catalog`（默认） | 通用基础依赖    | `typescript`, `react`, `react-dom`, `vue`, `zod`, `vitest`, `ai`, `jose`, `dotenv`, `zod-to-json-schema` 等 |
| `catalog:react`   | React 生态      | `lucide-react`, `react-router`, `@radix-ui/*`, `framer-motion`, `tailwind-merge` 等                         |
| `catalog:vue`     | Vue 生态        | `vue-router`, `pinia`, `lucide-vue-next` 等                                                                 |
| `catalog:build`   | 构建工具        | `vite`, `postcss`, `autoprefixer` 等                                                                        |
| `catalog:dev`     | 开发工具        | `@vitejs/*`, `eslint`, `typescript-eslint` 等                                                               |
| `catalog:agui`    | AGUI 传输层     | `@ag-ui/client`, `@ag-ui/core`, `@ag-ui/encoder`, `@ag-ui/a2ui-middleware`                                  |
| `catalog:ai-sdk`  | AI SDK Provider | `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/mcp`                                                        |
| `catalog:server`  | 服务端依赖      | `elysia`, `@elysiajs/*`, `drizzle-orm`, `postgres`, `@modelcontextprotocol/sdk`                             |
| `catalog:lib`     | 通用库          | `zustand`, `@inquirer/prompts`                                                                              |

### 关键依赖版本约束

| 包               | 版本       | 说明                                                                                                                                                   |
| ---------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ai`             | `^6.0.0`   | Vercel AI SDK v6，`streamText` 使用 `ModelMessage[]`，`text-delta` chunk 字段为 `text`（非 `textDelta`），`tool-result` 字段为 `output`（非 `result`） |
| `@ai-sdk/openai` | `^3.0.55`  | 与 ai v6 兼容，模型创建用 `openai.chat('gpt-4o-mini')`（非 `openai('gpt-4o-mini')`）                                                                   |
| `zod`            | `^4.3.5`   | Zod v4，`z.record()` 必须传两个参数：`z.record(z.string(), z.any())`                                                                                   |
| `tailwindcss`    | **不统一** | 各业务应用自行管理版本（React 项目用 v3，Vue 项目用 v4），不加入 catalog                                                                               |

### 使用示例

工作区包的 `package.json`：

```json
{
  "dependencies": {
    "ai": "catalog:",
    "zod": "catalog:",
    "@ai-sdk/openai": "catalog:ai-sdk",
    "@ag-ui/client": "catalog:agui"
  },
  "devDependencies": {
    "typescript": "catalog:",
    "vite": "catalog:build"
  }
}
```

## 核心设计原则

1. **业务无关**：`@a2ui/agent` 是纯 LLM 代理，不耦合任何业务代码或 A2UI 协议细节
2. **框架无关**：`@a2ui/core` 纯 TypeScript，不依赖任何前端框架
3. **AGUI 标准化**：传输层完全遵循 AGUI 事件流规范，兼容任意 AGUI 客户端
4. **服务端自治**：A2UI 组件生成（次级 LLM）、`ACTIVITY_SNAPSHOT` 构造在服务端完成，客户端只需消费事件流，无需拦截 tool call
5. **流式友好**：支持增量解析和增量渲染，无需等待完整数据
6. **非阻塞 UI 生成**：次级 LLM 在后台运行，Markdown 文本流与 UI 生成并行，用户先看到文字后看到组件
7. **消息级隔离**：每条 assistant 消息拥有独立 Surface，多轮对话的 UI 状态互不覆盖
8. **类型安全**：完整的 TypeScript 类型定义 + Zod 运行时校验
9. **跨端一致**：同一份 v0.9 协议可渲染到 Web、Vue、小程序

## MCP 工具链架构

A2UI Agent 引擎通过 **MCP (Model Context Protocol)** 获取业务工具，替代硬编码的本地 mock 工具，实现业务逻辑与 Agent 引擎的彻底解耦。

### 调用链路

```
用户请求
    ↓
POST /api/agent/stream (a2ui-server)
    ↓
runAgentStream() (a2ui-agent/engine)
    ↓
buildBusinessTools() (a2ui-agent/tools/mcp-tools.ts)
    ↓
createMCPClient + StdioClientTransport
    ↓ 启动子进程
bun run food-mcp/src/index.ts  (或 campus-mcp)
    ↓ stdio 协议
MCP Server (McpServer + StdioServerTransport)
    ↓ HTTP
a2ui-server REST API (/api/food/*, /api/campus/*)
    ↓
数据库 (postgres)
```

### 关键实现

**1. MCP Client（`a2ui-agent/src/tools/mcp-tools.ts`）**

```typescript
const client = await createMCPClient({
  transport: new StdioClientTransport({
    command: "bun",
    args: ["run", "mcp/food-mcp/src/index.ts"],
    env: { A2UI_API_BASE: "http://localhost:3000" },
  }),
});
const tools = await client.tools(); // ToolSet，直接传给 streamText
```

- **生命周期管理**：`runAgentStream` 使用 `try...finally` 确保每次请求后 `await mcp.close()`，避免子进程泄漏
- **环境自适应**：测试环境（`VITEST`）自动回退到 `local-tools.ts`
- **降级保护**：MCP 连接失败时回退到本地工具，不阻塞服务

**2. MCP Server（`a2ui-agent/mcp/*-mcp/src/index.ts`）**

| 领域         | 工具数 | 公开工具                                  | 需认证工具                                                                                                                     |
| ------------ | ------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `food-mcp`   | 9      | `query_menu`, `search_dish`, `get_dish_detail` | `place_order`, `get_orders`, `get_order_detail`, `update_order_status`, `cancel_order`, `get_user_addresses` |
| `campus-mcp` | 8      | `query_facilities`, `get_facility_detail` | `book_facility`, `get_reservations`, `update_reservation`, `cancel_reservation`, `pay_fee`, `query_payments`, `update_payment` |

MCP Server 通过 `A2UI_API_BASE` 环境变量调用 a2ui-server 的 REST API，认证工具需传入 `token` 参数（JWT）。

**3. 工具职责分离（`query_menu` vs `search_dish`）**

为避免 LLM 在"浏览菜单"和"搜索特定菜品"之间混淆，`food-mcp` 将菜单查询拆分为两个工具：

| 工具 | 用途 | 参数 |
| ---- | ---- | ---- |
| `query_menu` | 浏览全部菜单列表，当用户想看菜单、找吃的时调用 | `category`, `search`, `page`, `pageSize`（均可选） |
| `search_dish` | 搜索特定菜品，当用户提到具体菜品名称时调用 | `dishName`（必填） |

主 LLM 的 system prompt 中通过示例明确区分两者的使用场景，确保用户说"有什么好吃的"时调用 `query_menu`，说"介绍一下古典鸡尾酒"时调用 `search_dish`。

**4. 独立 CLI 客户端（`a2ui-agent/src/mcp-client.ts`）**

用于本地调试 MCP 工具链，支持多 MCP 同时连接：

```bash
bun run a2ui-agent/src/mcp-client.ts
```

功能：

- 同时连接 `food-mcp` 和 `campus-mcp`
- 同名工具自动加前缀（`food__auth_login`, `campus__auth_login`）
- 使用 `generateText` + `stopWhen: stepCountIs(8)` 限制推理轮数

### 与本地工具的区别

| 特性            | `local-tools.ts`（旧）        | MCP Server（新）                |
| --------------- | ----------------------------- | ------------------------------- |
| 工具定义位置    | a2ui-agent 内部               | 独立 MCP Server 进程            |
| 与后端 API 关系 | 直接 `fetch()` localhost:3000 | 通过 MCP stdio 协议调用         |
| 工具数量        | food 4 个 / campus 4 个       | food 9 个 / campus 8 个         |
| JWT 认证        | 无                            | 完整支持（token 参数）          |
| LLM 可见 schema | 简单 description              | Zod schema 自动生成 JSON Schema |
| 热更新          | 需重启 server                 | MCP Server 独立部署即可更新     |
| 适用场景        | 测试 / 开发回退               | 生产环境                        |

## 双 LLM 架构

`a2ui-agent` 采用**主-次双 LLM** 模式分离业务推理与 UI 生成：

```
用户请求
    ↓
主 LLM (kimi-for-coding) —— 业务推理
    ├── query_menu / get_dish_detail 等 MCP 业务工具
    ├── 获取数据后调用 generate_a2ui（虚拟工具，触发次级 LLM）
    └── 继续流式输出 Markdown 文本说明
            ↓ 非阻塞启动
    次级 LLM (kimi-for-coding) —— UI 设计
        ├── 接收主 LLM 的完整对话历史 + 业务工具结果
        ├── toolChoice: {type: "tool", toolName: "render_a2ui"} 强制生成
        └── 返回 {surfaceId, catalogId, components[], data?}
            ↓
    a2ui-agent 构造 ACTIVITY_SNAPSHOT
        { type: "ACTIVITY_SNAPSHOT", activityType: "a2ui-surface",
          content: { a2ui_operations: [createSurface, updateComponents, updateDataModel] } }
            ↓ HTTP/SSE
    前端接收事件 → 直接送入 A2UIStore 渲染
```

**关键实现（`a2ui-agent/src/engine/agent.ts`）：**

```typescript
// generate_a2ui 触发时，非阻塞启动次级 LLM
// 传入 scenario（由主 LLM 工具调用推断）和 sessionCache（避免重复数据获取）
generateA2UIPromise = generateA2UIComponents({
  model, messages, appType,
  scenario,           // "menu" | "dish_detail" | "orders" | "order_detail" | "place_order"
  toolResults,        // 当前轮次业务工具结果
  sessionCache,       // 会话级数据缓存
}).then(
  (result) => {
    generateA2UICompleted = true;
    generateA2UIResult = result;
  },
);

// 主 LLM 流循环每轮检查次级 LLM 是否完成
for await (const chunk of result.fullStream) {
  if (generateA2UICompleted && !generateA2UIHandled) {
    yield createA2UIActivitySnapshot(generateA2UIResult);
    generateA2UIHandled = true;
  }
  // ... 继续处理 text-delta / tool-call / tool-result
}

// 流结束后兜底：若次级 LLM 仍未完成，等待它
if (!generateA2UIHandled && generateA2UIPromise) {
  const result = await generateA2UIPromise;
  yield createA2UIActivitySnapshot(result);
}
```

**次级 LLM（`a2ui-agent/src/tools/generate-a2ui.ts`）：**

- 通过 `extractToolData()` 从对话历史的 tool-result 中提取业务数据，注入 system prompt
- `toolChoice: {type: "tool", toolName: "render_a2ui"}` 确保 LLM 必须调用工具，不输出闲聊文本
- 返回降级组件（错误提示 Column+Text）当组件生成失败时
- **智能场景转换**：当 `search_dish` 返回单个菜品时，自动将场景从 `menu` 转换为 `dish_detail`，直接渲染 `DishDetail` 组件而非 `Carousel`
- **服务端数据构造**：`buildDataFromToolResults()` 根据 scenario 和 toolResults 直接构造 data 模型（如 `{dishes: [...]}`、`{dish: {...}}`），避免让 LLM 输出大量业务数据，减少 Token 消耗和响应延迟

**3. 会话级数据缓存（`sessionCache`）**

`runAgentStream` 中维护 `sessionCache: Map<string, any>`，同一 session 内已获取的数据（如菜单列表、订单列表）会被缓存：

```typescript
const sessionCache = new Map<string, any>();
// tool result 处理时按 toolName 缓存
sessionCache.set("query_menu", parsedData);
// 生成 UI 时优先从缓存读取
const data = sessionCache.get("query_menu") || findToolData(toolResults, "query_menu");
```

这使得多轮对话中重复请求（如"返回菜单"、"查看我的订单"）无需重新调用 MCP，直接从缓存构造 UI，响应时间从 5-8 秒降至毫秒级。

## 消息级 A2UI 渲染

传统方案使用全局单一 Surface（如 `chat-surface`），所有 assistant 消息的 A2UI 堆叠在同一区域。当前架构改为**每条 assistant 消息拥有独立 Surface**。

### 核心类

**`AgentConversation`（`a2ui-core/src/agent-conversation.ts`）**

维护 OpenAI 兼容格式的 clean 对话历史，绕过 `@ag-ui/client` HttpAgent 的格式损坏问题（assistant tool-call 缺少 content/toolCalls，tool result 缺少 toolCallId）：

```typescript
const conversation = new AgentConversation();
conversation.addUserMessage("查询菜单");
conversation.addAssistantText("为您找到以下菜品"); // 自动累积
conversation.addToolCall("tc-1", "query_menu", "{}");
conversation.addToolResult("tc-1", '{"data": [...]}');
const history = conversation.getHistory(); // 供 forwardedProps.conversationHistory 传入服务端
```

**`SurfaceMessageBinder`（`a2ui-core/src/surface-binder.ts`）**

将 LLM 生成的原始 `surfaceId`（如 `"main"`）映射为消息级唯一 ID（如 `"msg-xxx__main"`），避免多轮对话 Surface 冲突：

```typescript
const binder = new SurfaceMessageBinder();
const uniqueId = binder.bind(messageId, originalSurfaceId); // "msg-xxx__main"
const mappedOps = binder.mapOperations(operations, messageId); // 替换所有 op 中的 surfaceId
```

**`A2UIChatMessage`（`a2ui-render/react-render/src/chat-message.tsx`）**

组合渲染组件：头部渲染 A2UI Surface，下方渲染文本内容（支持自定义 textRenderer / loadingRenderer）：

```tsx
<A2UIChatMessage
  messageId={msg.id}
  surfaceId={msg.surfaceId} // 消息级唯一 Surface ID
  content={msg.content} // Markdown 文本
  store={store}
  isLoading={isLoading && !msg.content && !msg.surfaceId}
  textRenderer={(content) => <Streamdown>{content}</Streamdown>}
/>
```

### 前端事件流处理（`AgentTest.tsx`）

```
TEXT_MESSAGE_START      → 创建 assistant 消息占位（id: msg-xxx）
TEXT_MESSAGE_CONTENT    → conversation.addAssistantText(delta) + setMessages 更新文本
ACTIVITY_SNAPSHOT       → binder.bind(msgId, surfaceId) + binder.mapOperations() + store.processMessage()
                         → setMessages 绑定 surfaceId 到对应消息
TOOL_CALL_START/ARGS    → 记录当前 tool call（除 generate_a2ui 外写入 conversation）
TOOL_CALL_RESULT        → conversation.addToolResult()（generate_a2ui 跳过，由服务端直接发 ACTIVITY_SNAPSHOT）
```

### Surface 生命周期

组件卸载时遍历所有消息的 `surfaceId`，调用 `store.clearSurface()` 清理：

```typescript
useEffect(() => {
  return () => {
    for (const msg of messages) {
      if (msg.surfaceId) store.clearSurface(msg.surfaceId);
    }
  };
}, []);
```

## 客户端 Clean History 机制

`@ag-ui/client` 的 `HttpAgent` 在多轮对话中存在格式损坏问题：

| 问题                | AGUI 格式                                                  | 期望的 OpenAI 格式                                    |
| ------------------- | ---------------------------------------------------------- | ----------------------------------------------------- |
| assistant tool-call | `{role: "assistant", id: "..."}`（缺少 content/toolCalls） | `{role: "assistant", content: "", tool_calls: [...]}` |
| tool result         | `{role: "tool", content: "..."}`（缺少 toolCallId）        | `{role: "tool", tool_call_id: "...", content: "..."}` |

**解决方案**：前端通过 `AgentConversation` 维护并行的 clean 历史，每次请求通过 `forwardedProps.conversationHistory` 传入服务端。服务端 `convertToCoreMessages()` 优先使用 clean history，检测到 HttpAgent 损坏格式时自动跳过/兜底：

```typescript
const useCleanHistory = !!forwardedProps?.conversationHistory;
const sourceMessages = useCleanHistory
  ? forwardedProps!.conversationHistory
  : input.messages;
const coreMessages = convertToCoreMessages(sourceMessages);
```

## A2UI v0.9 协议速览

**组件格式（扁平）：**

```json
{
  "id": "root",
  "component": "Column",
  "children": ["card-1", "btn-1"]
}
```

**消息类型（均带 `version: "v0.9"`）：**

- `createSurface` — 创建 Surface，指定 theme/sendDataModel
- `updateComponents` — 更新/替换组件列表
- `updateDataModel` — 更新数据模型（标准 JSON）
- `deleteSurface` — 删除 Surface
- `action` — 用户交互（Button 点击等）

**DynamicValue 三种形式：**

- 字面量：`"Hello"` / `42` / `true`
- 数据绑定：`{"path": "/user/name"}`
- 函数调用：`{"call": "formatDate", "args": {"date": {"path": "/order/createdAt"}}}`
