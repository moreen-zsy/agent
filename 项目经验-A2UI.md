下面是可直接复制到简历里的标准项目模块，信息完整、排版工整，适配前端/全栈岗位：

项目：A2UI 生成式 UI 协议与 Agent 引擎

技术栈：React 19 + TypeScript + Bun + Elysia + Vercel AI SDK v6 + MCP + AGUI + SSE + Zod + Tailwind CSS + PostgreSQL

项目描述：
设计并实现 A2UI（Agent-to-User Interface）v0.9 协议及配套 Agent 引擎，支持 AI Agent 根据用户意图动态生成 UI 组件，实现"任务 → AI 生成 UI 描述 → 协议传输 → 渲染"的秒级 UI 交付流程。同时基于该引擎构建 Gusto 智能点餐 H5 应用，覆盖浏览菜单、菜品详情、订单管理、地址管理等完整业务场景。

项目亮点：

1. 双 LLM 架构分离业务推理与 UI 生成：主 LLM 通过 MCP 协议调用业务工具获取数据，次级 LLM 强制 toolChoice 生成 render_a2ui 组件，服务端自治构造 ACTIVITY_SNAPSHOT 事件流，客户端零拦截直接消费，实现非阻塞 UI 渲染。
2. 消息级 A2UI 渲染：每条 assistant 消息拥有独立 Surface，通过 SurfaceMessageBinder 生成消息级唯一 ID，多轮对话 UI 互不覆盖；AgentConversation 维护并行 clean 历史，绕过 AGUI HttpAgent 格式损坏问题。
3. 会话级数据缓存 + 智能场景转换：同一 session 内已获取数据（菜单/订单）按 toolName 缓存复用，重复请求无需重新调用 MCP；search_dish 返回单菜品时自动从 menu 场景切换为 dish_detail，减少 80% 以上的重复工具调用。
4. MCP 工具链实现业务彻底解耦：food-mcp / campus-mcp 独立进程封装领域工具（Zod Schema 自动生成），Agent 引擎通过 StdioTransport 动态获取工具集，支持热更新和多领域隔离；工具职责分离（query_menu vs search_dish）解决 LLM 工具选择歧义。
5. 前端协议层与渲染层完全解耦：@a2ui/core 纯 TypeScript 实现 v0.9 协议解析、数据绑定、增量更新，不依赖任何框架；@a2ui/react-render 将协议树渲染为 React DOM，支持 DynamicValue 三种形式（字面量/{path}数据绑定/{call}函数调用）。

项目成果：
成功落地 5 个核心交互场景（浏览菜单、菜品详情、订单列表、订单详情、下单成功），端到端测试全部通过。A2UI 引擎具备完整的业务无关性，同一份协议可渲染到 Web / Vue / 小程序，具备良好的跨端一致性和可扩展性。
