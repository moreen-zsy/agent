# @a2ui/monorepo

## 项目背景

A2UI（Agent-to-User Interface）是专为 AI Agent 设计的生成式 UI 协议。
本项目构建一个 **与业务无关的 A2UI Agent 引擎**，可为任意前端应用提供服务。

核心理念：

```
传统 UI：需求 → 设计 → 编码 → 测试 → 上线（天/周级）
A2UI：    任务 → AI 生成 UI 描述 → 协议传输 → 渲染（秒级）
```

## 架构分层

```
服务端（Server）                              客户端（Client）
┌─────────────────────┐                      ┌─────────────────────────────┐
│  用户输入（文字/图片） │                      │                             │
│         ↓           │                      │                             │
│  ┌──────────────┐   │    SSE / WS / A2A    │  ┌──────────┐  ┌─────────┐ │
│  │ a2ui-agent   │   │ ◄────────────────►  │  │a2ui-core │→  │a2ui-render│ │
│  │ 意图理解      │   │      传输协议         │  │ 协议解析  │  │   │ │
│  │ 协议生成      │   │                      │  │ 状态管理  │  │组件渲染  │ │
│  │ 多轮对话      │   │                      │  │ 树构建   │   │DOM 输出  │ │
│  │ 图片理解      │   │                      │  │ 增量更新  │  │         │ │
│  └──────────────┘   │                      │  └──────────┘  └─────────┘ │
│         ↓           │                      │         ↓                   │
│  ┌──────────────┐   │                      │   apps/gusto                │
│  │a2ui-server   │   │                      │   （Web / 小程序）            │
│  │ SSE 传输层    │   │                      │                             │
│  └──────────────┘   │                      └─────────────────────────────┘
└─────────────────────┘
```

**分层说明：**

| 包            | 运行环境   | 职责                                         |
| ------------- | ---------- | -------------------------------------------- |
| `a2ui-agent`  | 服务端     | Agent 引擎：理解意图、生成 A2UI 协议         |
| `a2ui-server` | 服务端     | 传输层：SSE / WebSocket / A2A 协议传输       |
| `a2ui-core`   | **客户端** | 数据层：协议解析、状态管理、树构建、增量更新 |
| `a2ui-render` | **客户端** | 视图层：将协议树渲染为 React / Vue 组件      |

- `core` 与 `render` 均为前端包，但解耦：`core` 纯 TypeScript 不依赖框架，`render` 依赖具体前端框架
- 同一份 `a2ui-core` 可配合不同 `a2ui-render`（React / Vue / 小程序）使用

## 目录结构

```
d:/agent/
├── a2ui-agent/              # @a2ui/agent — 核心 Agent 引擎（与业务无关）
│   ├── src/
│   │   ├── engine/          # Agent 核心：LLM 调用 + Prompt 工程
│   │   ├── vision/          # 图片理解（Vision LLM）
│   │   ├── conversation/    # 多轮对话管理
│   │   ├── diff/            # 增量更新引擎
│   │   └── style/           # 样式优化
│   ├── package.json
│   └── tsconfig.json
│
├── a2ui-core/               # @a2ui/core — 协议层
│   ├── src/
│   │   ├── types.ts         # 核心类型定义
│   │   ├── parser.ts        # JSONL 流式解析器
│   │   ├── store.ts         # Zustand 模式状态管理
│   │   ├── tree-builder.ts  # 扁平组件 → 树形 VNode
│   │   └── buffer.ts        # Surface 级消息缓冲
│   ├── package.json
│   └── tsconfig.json
│
├── a2ui-render/             # 渲染层
│   ├── react-render/        # @a2ui/react-render — React 渲染器
│   └── vue-render/          # @a2ui/vue-render — Vue 渲染器
│
├── a2ui-server/             # @a2ui/server — 服务端传输层
│   ├── src/
│   │   ├── index.ts         # 服务入口
│   │   └── routes/          # SSE 流端点 / 对话接口
│   ├── package.json
│   └── tsconfig.json
│
├── apps/                    # 业务应用
│   └── gusto/               # Gusto 应用
│       ├── web/             # Web 端
│       └── wx/              # 微信小程序端
│
├── docs/                    # 项目文档
│   ├── 项目概述.md
│   └── 开发计划.md
│
├── package.json             # Bun Workspace + Catalogs
├── bunfig.toml
└── tsconfig.json
```

## 技术栈

| 层级        | 技术                     | 说明                  |
| ----------- | ------------------------ | --------------------- |
| 运行时      | Bun                      | 高性能 JS/TS 运行时   |
| 语言        | TypeScript               | 类型安全              |
| Monorepo    | Bun Workspace + Catalogs | 统一依赖版本管理      |
| 前端框架    | React 19 / Vue 3         | UI 渲染               |
| 构建工具    | Vite                     | 前端开发服务器和构建  |
| 服务端      | Elysia                   | 高性能 Bun 服务端框架 |
| Agent SDK   | ai / vercel-sdk          | LLM 调用和流式处理    |
| Schema 验证 | Zod                      | 运行时类型安全        |
| 测试        | Vitest                   | 单元测试              |

## 核心设计原则

1. **业务无关**：`@a2ui/agent` 是纯逻辑引擎，不耦合任何业务代码
2. **框架无关**：`@a2ui/core` 纯 TypeScript，不依赖任何前端框架
3. **流式友好**：支持增量解析和增量渲染，无需等待完整数据
4. **类型安全**：完整的 TypeScript 类型定义 + Zod 运行时校验
5. **跨端一致**：同一份 A2UI 协议可渲染到 Web、Vue、小程序

## 快速开始

```bash
# 安装依赖
bun install

# 启动服务端
bun run dev:server

# 启动前端（Web）
bun run dev:playground
```

## 工作区脚本

```bash
bun run dev:core        # 开发 a2ui-core
bun run dev:react       # 开发 react-render
bun run dev:server      # 开发服务端
bun run dev:playground  # 开发 playground
bun run build           # 构建核心包
bun run test            # 运行测试
```
