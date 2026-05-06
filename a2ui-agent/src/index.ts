/**
 * @a2ui/agent
 * A2UI Agent 引擎 — Vercel AI SDK + AGUI 代理模式 (v0.9)
 */

export * from '@a2ui/core';
// Re-export AGUI core types for convenience
export type {
  Message,
  BaseEvent,
  UserMessage,
  AssistantMessage,
  ToolMessage,
  SystemMessage,
  RunAgentInput,
  ActivitySnapshotEvent,
  TextMessageContentEvent,
  TextMessageStartEvent,
  TextMessageEndEvent,
  RunStartedEvent,
  RunFinishedEvent,
  RunErrorEvent,
} from '@ag-ui/core';

export type { AgentInput, AppType } from './types.js';
export { runAgentStream } from './engine/agent.js';
export { buildBusinessTools } from './tools/mcp-tools.js';
export { buildBusinessTools as buildLocalTools } from './tools/local-tools.js';
