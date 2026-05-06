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
- **中间件驱动**：A2UIMiddleware 在客户端注入 schema、解析 tool call、渐进式渲染

## 架构分层

```
客户端（Client）                                                服务端（Server）
┌─────────────────────────────────────────────────┐            ┌─────────────────────────┐
│  HttpAgent + A2UIMiddleware                     │            │                         │
│         ↓ 注入 schema + render_a2ui tool         │   AGUI    │  ┌──────────────────┐   │
│         ↓ HTTP/SSE 流式传输                      │ ◄──────► │  │   a2ui-server    │   │
│  ┌──────────┐    ┌──────────┐   ┌──────────┐   │  事件流   │  │  Elysia 路由      │   │
│  │a2ui-core │───▶│a2ui-render│──▶│   DOM    │   │            │  └────────┬─────────┘   │
│  │协议解析   │    │ 组件渲染  │   │          │   │            │           ↓             │
│  │状态管理   │    │          │   │          │   │            │  ┌──────────────────┐   │
│  │树构建    │    └──────────┘   └──────────┘   │            │  │   a2ui-agent     │   │
│  │增量更新   │                                 │            │  │  纯 LLM 代理      │   │
│  └──────────┘                                 │            │  │  streamText +    │   │
│       ↑                                       │            │  │  buildBusinessTools│  │
│  ┌──────────┐                                 │            │  └────────┬─────────┘   │
│  │ 业务应用  │  apps/campus-web                │            │           ↓             │
│  └──────────┘                                 │            │  ┌──────────────────┐   │
└─────────────────────────────────────────────────┘            │  │   MCP Clients    │   │
                                                               │  │  createMCPClient │   │
                                                               │  │  + StdioTransport│   │
                                                               │  └────────┬─────────┘   │
                                                               │           ↓             │
                                                               │  ┌──────────────────┐   │
                                                               │  │   MCP Servers    │   │
                                                               │  │ ┌─────┐ ┌─────┐  │   │
                                                               │  │ │food │ │campus│  │   │
                                                               │  │ │-mcp │ │ -mcp │  │   │
                                                               │  │ └──┬──┘ └──┬──┘  │   │
                                                               │  └────┼─────┼──────┘   │
                                                               │       ↓     ↓          │
                                                               │  ┌──────────────────┐   │
                                                               │  │ a2ui-server REST │   │
                                                               │  │     API          │   │
                                                               │  └──────────────────┘   │
                                                               └─────────────────────────┘
```

**分层说明：**

| 包            | 运行环境   | 职责                                                        |
| ------------- | ---------- | ----------------------------------------------------------- |
| `a2ui-agent`  | 服务端     | LLM 代理：透传 messages/tools/context，原样返回 AGUI 事件流 |
| `a2ui-server` | 服务端     | 传输层：Elysia HTTP 路由，接收 AGUI 请求，流式响应          |
| `a2ui-core`   | **客户端** | 协议层：v0.9 协议解析、状态管理、树构建、增量更新           |
| `a2ui-render` | **客户端** | 视图层：将 v0.9 协议树渲染为 React / Vue 组件               |
| `@ag-ui/*`    | 客户端     | AGUI 生态：HttpAgent 传输、A2UIMiddleware 协议转换          |
| **MCP Client**| 服务端     | `@ai-sdk/mcp` `createMCPClient` + `StdioClientTransport`   |
| **MCP Server**| 服务端     | `food-mcp` / `campus-mcp`：业务工具封装，调用 REST API      |

- **服务端极简**：a2ui-agent 不再手动定义 `render_a2ui` tool 或构建 prompt，所有 A2UI 逻辑由客户端 A2UIMiddleware 处理
- **客户端自治**：中间件自动注入 v0.9 schema、拦截 tool call、渐进式解析 JSON、emit ACTIVITY_SNAPSHOT
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
│   │   │   └── src/index.ts # 7 个工具（菜单/订单管理）
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
│   │   └── buffer.ts        # Surface 级消息缓冲（createSurface/updateComponents/...）
│   ├── package.json
│   └── tsconfig.json
│
├── a2ui-render/             # 渲染层
│   ├── react-render/        # @a2ui/react-render — React 19 渲染器
│   │   ├── src/
│   │   │   ├── VNodeRenderer.tsx    # DynamicValue 解析 + Template children
│   │   │   ├── renderer.tsx         # Surface 渲染入口
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
4. **中间件自治**：A2UI schema 注入、tool call 解析、渐进式渲染全部在客户端完成
5. **流式友好**：支持增量解析和增量渲染，无需等待完整数据
6. **类型安全**：完整的 TypeScript 类型定义 + Zod 运行时校验
7. **跨端一致**：同一份 v0.9 协议可渲染到 Web、Vue、小程序

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
const tools = await client.tools();  // ToolSet，直接传给 streamText
```

- **生命周期管理**：`runAgentStream` 使用 `try...finally` 确保每次请求后 `await mcp.close()`，避免子进程泄漏
- **环境自适应**：测试环境（`VITEST`）自动回退到 `local-tools.ts`
- **降级保护**：MCP 连接失败时回退到本地工具，不阻塞服务

**2. MCP Server（`a2ui-agent/mcp/*-mcp/src/index.ts`）**

| 领域 | 工具数 | 公开工具 | 需认证工具 |
|------|--------|----------|------------|
| `food-mcp` | 7 | `query_menu`, `get_dish_detail` | `place_order`, `get_orders`, `get_order_detail`, `update_order_status`, `cancel_order` |
| `campus-mcp` | 8 | `query_facilities`, `get_facility_detail` | `book_facility`, `get_reservations`, `update_reservation`, `cancel_reservation`, `pay_fee`, `query_payments`, `update_payment` |

MCP Server 通过 `A2UI_API_BASE` 环境变量调用 a2ui-server 的 REST API，认证工具需传入 `token` 参数（JWT）。

**3. 独立 CLI 客户端（`a2ui-agent/src/mcp-client.ts`）**

用于本地调试 MCP 工具链，支持多 MCP 同时连接：

```bash
bun run a2ui-agent/src/mcp-client.ts
```

功能：
- 同时连接 `food-mcp` 和 `campus-mcp`
- 同名工具自动加前缀（`food__auth_login`, `campus__auth_login`）
- 使用 `generateText` + `stopWhen: stepCountIs(8)` 限制推理轮数

### 与本地工具的区别

| 特性 | `local-tools.ts`（旧） | MCP Server（新） |
|------|------------------------|------------------|
| 工具定义位置 | a2ui-agent 内部 | 独立 MCP Server 进程 |
| 与后端 API 关系 | 直接 `fetch()` localhost:3000 | 通过 MCP stdio 协议调用 |
| 工具数量 | food 4 个 / campus 4 个 | food 7 个 / campus 8 个 |
| JWT 认证 | 无 | 完整支持（token 参数） |
| LLM 可见 schema | 简单 description | Zod schema 自动生成 JSON Schema |
| 热更新 | 需重启 server | MCP Server 独立部署即可更新 |
| 适用场景 | 测试 / 开发回退 | 生产环境 |

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
