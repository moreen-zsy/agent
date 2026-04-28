/**
 * @a2ui/agent
 * A2UI Agent 引擎 — 与业务无关的核心 Agent 能力
 *
 * 职责：
 * - 意图理解（用户输入 → 结构化意图）
 * - A2UI 协议生成（意图 → A2UI JSONL）
 * - 多轮对话管理（上下文记忆、增量修改）
 * - 图片理解（Vision LLM → A2UI 布局）
 * - 元素级修改（点击元素 → 针对性更新）
 * - 样式优化（useHint 语义化 + styles 精细控制）
 */

export * from '@a2ui/core';

// TODO: 实现 Agent 引擎核心
// export { A2UIAgent } from './engine/agent';
// export { ConversationManager } from './conversation/manager';
// export { VisionAnalyzer } from './vision/analyzer';
// export { DiffEngine } from './diff/engine';
// export { StyleOptimizer } from './style/optimizer';
