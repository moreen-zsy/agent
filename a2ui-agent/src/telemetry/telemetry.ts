/**
 * 遥测 / 埋点
 *
 * 收集：DAG 节点耗时、token 用量、缓存命中率、Critic 结果、整轮耗时。
 * 存储：Redis 计数器 + 内存环形缓冲（便于 /metrics 端点快速读取）。
 */

import type { RedisClient } from "../session/redis-client.js";
import { getRedis } from "../session/redis-client.js";
import type { CriticVerdict } from "../orchestrator/schemas.js";

export interface NodeMetric {
  nodeId: string;
  workerType: string;
  ok: boolean;
  durationMs: number;
  attempts: number;
  tokens?: number;
  error?: string;
}

export interface RunMetric {
  sessionId: string;
  runId: string;
  taskType: string;
  planId?: string;
  ok: boolean;
  totalMs: number;
  llmTokens: number;
  nodeCount: number;
  cacheHits: number;
  cacheMisses: number;
  at: number;
}

const METRIC_TTL = 60 * 60 * 24;

export class Telemetry {
  private readonly recentRuns: RunMetric[] = [];
  private readonly MAX_RECENT = 100;

  constructor(private readonly redis: RedisClient = getRedis()) {}

  // ─────────────────── 节点级 ───────────────────

  recordNode(metric: NodeMetric): void {
    const prefix = "metrics:node";
    void this.bump(`${prefix}:total`);
    void this.bump(`${prefix}:ok`, metric.ok ? 1 : 0);
    void this.bump(`${prefix}:fail`, metric.ok ? 0 : 1);
    void this.bump(`${prefix}:duration_ms`, metric.durationMs);
    if (metric.tokens) void this.bump(`${prefix}:tokens`, metric.tokens);
    if (metric.attempts > 1) void this.bump(`${prefix}:retries`, metric.attempts - 1);

    if (metric.error) {
      console.warn(
        `[telemetry] 节点失败 node=${metric.nodeId} worker=${metric.workerType} attempts=${metric.attempts}: ${metric.error}`,
      );
    }
  }

  recordCritic(nodeId: string, verdict: CriticVerdict): void {
    void this.bump(`metrics:critic:${verdict.verdict}`);
    if (verdict.verdict !== "pass") {
      console.warn(`[telemetry] Critic ${verdict.verdict} @ ${nodeId}: ${verdict.reasons.join("; ")}`);
    }
  }

  // ─────────────────── 整轮 ───────────────────

  recordRun(metric: RunMetric): void {
    this.recentRuns.push(metric);
    if (this.recentRuns.length > this.MAX_RECENT) this.recentRuns.shift();

    void this.bump("metrics:run:total");
    void this.bump("metrics:run:ok", metric.ok ? 1 : 0);
    void this.bump("metrics:run:fail", metric.ok ? 0 : 1);
    void this.bump("metrics:run:duration_ms", metric.totalMs);
    void this.bump("metrics:run:tokens", metric.llmTokens);
    void this.bump("metrics:run:cache_hits", metric.cacheHits);
    void this.bump("metrics:run:cache_misses", metric.cacheMisses);
  }

  /** 最近 N 轮执行记录 */
  getRecentRuns(): RunMetric[] {
    return [...this.recentRuns];
  }

  /** 汇总指标（给 /metrics 端点使用） */
  async snapshot(): Promise<{
    runs: Record<string, number>;
    nodes: Record<string, number>;
    critic: Record<string, number>;
    cacheHitRate: number;
  }> {
    const read = async (key: string) => Number((await this.redis.getString(`metrics:${key}`)) ?? 0);

    const runs = {
      total: await read("run:total"),
      ok: await read("run:ok"),
      fail: await read("run:fail"),
      avgDurationMs: 0,
      avgTokens: 0,
    };
    const totalRuns = runs.total || 1;
    runs.avgDurationMs = Math.round((await read("run:duration_ms")) / totalRuns);
    runs.avgTokens = Math.round((await read("run:tokens")) / totalRuns);

    const nodes = {
      total: await read("node:total"),
      ok: await read("node:ok"),
      fail: await read("node:fail"),
      retries: await read("node:retries"),
      avgDurationMs: 0,
    };
    const totalNodes = nodes.total || 1;
    nodes.avgDurationMs = Math.round((await read("node:duration_ms")) / totalNodes);

    const critic = {
      pass: await read("critic:pass"),
      retry: await read("critic:retry"),
      replan: await read("critic:replan"),
      abort: await read("critic:abort"),
    };

    const hits = await read("run:cache_hits");
    const misses = await read("run:cache_misses");
    const cacheHitRate = hits + misses > 0 ? hits / (hits + misses) : 0;

    return { runs, nodes, critic, cacheHitRate };
  }

  /** 重置所有指标 */
  async reset(): Promise<void> {
    this.recentRuns.length = 0;
    await this.redis.delByPrefix("metrics:");
  }

  private async bump(key: string, amount = 1): Promise<void> {
    if (amount === 0) return;
    try {
      await this.redis.incrBy(key, amount);
    } catch {
      // 埋点失败不影响主流程
    }
  }
}

let instance: Telemetry | null = null;

export function getTelemetry(): Telemetry {
  if (!instance) instance = new Telemetry();
  return instance;
}

void METRIC_TTL;
