/**
 * 引擎运行时容器
 *
 * 统一初始化 Redis、会话、缓存、Checkpoint、遥测、网关，
 * 并在全局复用（单例），避免每次请求重建。
 */

import { runAgentStream } from "./engine/agent.js";
import { getRedis, initRedis, type RedisClient } from "./session/redis-client.js";
import { SessionManager, type SessionConfig } from "./session/session-manager.js";
import { CacheSubsystem } from "./cache/cache-subsystem.js";
import { CheckpointManager } from "./checkpoint/checkpoint-manager.js";
import { Telemetry } from "./telemetry/telemetry.js";
import { McpGateway } from "./gateway/mcp-gateway.js";
import { MemorySummarizer } from "./session/memory-summarizer.js";
import { SemanticCache } from "./cache/semantic-cache.js";
import { DegradeController, FeatureRollout } from "./orchestrator/resilience.js";
import { DagLogger } from "./orchestrator/dag-logger.js";
import { setRuntime, getCurrentRuntime } from "./runtime-registry.js";

export interface EngineRuntime {
  redis: RedisClient;
  session: SessionManager;
  cache: CacheSubsystem;
  checkpoint: CheckpointManager;
  telemetry: Telemetry;
  gateway: McpGateway;
  /** V1.1 语义缓存 */
  semanticCache: SemanticCache;
  /** V1.2 降级控制 */
  degrade: DegradeController;
  /** V1.2 灰度发布 */
  rollout: FeatureRollout;
  /** V1.2 DAG 日志 */
  dagLogger: DagLogger;
  /** 摘要器（需模型，延迟到首次使用时注入） */
  createSummarizer: (model: any) => MemorySummarizer;
}

let runtime: EngineRuntime | null = null;
let initPromise: Promise<EngineRuntime> | null = null;

/** 获取（并惰性初始化）运行时 */
export async function getRuntime(config?: Partial<SessionConfig>): Promise<EngineRuntime> {
  if (runtime) return runtime;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const redis = await initRedis();

    const session = new SessionManager(redis, config);
    const cache = new CacheSubsystem(redis);
    const checkpoint = new CheckpointManager(redis);
    const telemetry = new Telemetry(redis);
    const gateway = new McpGateway(cache, telemetry);
    const semanticCache = new SemanticCache({ redis });
    const degrade = new DegradeController(redis);
    const rollout = new FeatureRollout(redis, { percentage: 100 });
    const dagLogger = new DagLogger(redis);

    runtime = {
      redis,
      session,
      cache,
      checkpoint,
      telemetry,
      gateway,
      semanticCache,
      degrade,
      rollout,
      dagLogger,
      createSummarizer: (model: any) =>
        new MemorySummarizer({ model }),
    };

    console.log(
      `[runtime] 引擎初始化完成 redis=${redis.isHealthy ? "connected" : "memory-fallback"}`,
    );
    // 写入全局注册表，供引擎内部（可能通过不同模块路径）读取
    setRuntime(runtime);
    return runtime;
  })();

  return initPromise;
}

/** 同步获取（已初始化时）；未初始化返回 null */
export function peekRuntime(): EngineRuntime | null {
  return getCurrentRuntime();
}

export { runAgentStream };
export { getRedis };
