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

// ─────────────────── V1.0 编排与内存子系统 ───────────────────

export { getRuntime, peekRuntime, getRedis } from './runtime.js';
export { getCurrentRuntime, setRuntime } from './runtime-registry.js';
export type { EngineRuntime } from './runtime.js';

export { SessionManager, getSessionManager } from './session/session-manager.js';
export type {
  SessionMeta,
  EntityStore,
  WorkingMemory,
  MemoryMessage,
  TraceEntry,
  SessionConfig,
} from './session/session-manager.js';

export { MemorySummarizer } from './session/memory-summarizer.js';
export { estimateTokens, estimateMessagesTokens } from './session/token-estimator.js';
export { RedisClient, initRedis } from './session/redis-client.js';

export { CacheSubsystem, ToolCache, PlanTemplateCache, PromptPrefixManager } from './cache/cache-subsystem.js';

export { TriageLayer } from './orchestrator/triage.js';
export { CriticLayer } from './orchestrator/critic.js';
export { DagScheduler, topoSort } from './orchestrator/dag-scheduler.js';
export { Orchestrator } from './orchestrator/orchestrator.js';
export type { OrchestratorInput, OrchestratorOutput, OrchestratorDeps } from './orchestrator/orchestrator.js';
export * from './orchestrator/schemas.js';

export { CheckpointManager, getCheckpointManager } from './checkpoint/checkpoint-manager.js';
export { Telemetry, getTelemetry } from './telemetry/telemetry.js';
export { McpGateway } from './gateway/mcp-gateway.js';

// ─────────────────── V1.1 ───────────────────
export { SemanticCache, isSemanticCacheEligible } from './cache/semantic-cache.js';
export type { SemanticCacheEntry } from './cache/semantic-cache.js';
export { SubAgentRunner } from './orchestrator/sub-agent.js';
export type { SubAgentRequest, SubAgentResult } from './orchestrator/sub-agent.js';
export { computeWaves } from './orchestrator/dag-scheduler.js';
export { EngineEvaluator } from './eval/engine-eval.js';
export type { EvalReport } from './eval/engine-eval.js';

// ─────────────────── V1.2 ───────────────────
export { DegradeController, FeatureRollout } from './orchestrator/resilience.js';
export { DagLogger } from './orchestrator/dag-logger.js';
export type { DagRunLog, DagNodeLog } from './orchestrator/dag-logger.js';
