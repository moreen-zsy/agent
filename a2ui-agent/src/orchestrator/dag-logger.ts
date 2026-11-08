/**
 * DAG 持久化日志与回放（V1.2）
 *
 * 每次 DAG 执行落一份完整日志（节点输入输出、耗时、Critic 判定），
 * 支持：
 *   - 按 session / planId 查询历史执行
 *   - 回放：用记录的输入重跑，对比输出差异
 *   - 调试面板数据源
 */

import type { RedisClient } from "../session/redis-client.ts";
import type { DagPlan, WorkerResult, CriticVerdict } from "./schemas.ts";

const LOG_TTL = 60 * 60 * 24 * 3; // 3 天
const MAX_LOGS = 500;

export interface DagNodeLog {
  nodeId: string;
  workerType: string;
  instruction: string;
  dependsOn: string[];
  ok: boolean;
  durationMs: number;
  error?: string;
  /** 精简后的输出，避免日志过大 */
  outputDigest?: string;
  verdict?: CriticVerdict;
}

export interface DagRunLog {
  logId: string;
  sessionId: string;
  planId: string;
  planSummary: string;
  startedAt: number;
  durationMs: number;
  ok: boolean;
  waves: number;
  maxConcurrency: number;
  nodes: DagNodeLog[];
  skipped: string[];
  /** 触发本轮的用户输入 */
  userText: string;
  triage: string;
}

export class DagLogger {
  constructor(private readonly redis: RedisClient) {}

  private logKey(logId: string): string {
    return `dag:log:${logId}`;
  }

  private sessionIndexKey(sessionId: string): string {
    return `dag:index:${sessionId}`;
  }

  /** 记录一次执行 */
  async record(params: {
    sessionId: string;
    userText: string;
    triage: string;
    plan: DagPlan;
    results: WorkerResult[];
    durationMs: number;
    ok: boolean;
    waves: number;
    maxConcurrency: number;
    skipped: string[];
  }): Promise<DagRunLog> {
    const logId = `${params.plan.planId}-${Date.now()}`;
    const nodeMap = new Map(params.plan.nodes.map((n) => [n.nodeId, n]));

    const nodes: DagNodeLog[] = params.results.map((r) => {
      const node = nodeMap.get(r.nodeId);
      return {
        nodeId: r.nodeId,
        workerType: r.workerType,
        instruction: node?.instruction ?? "",
        dependsOn: node?.dependsOn ?? [],
        ok: r.ok,
        durationMs: r.durationMs ?? 0,
        error: r.error,
        outputDigest: this.digest(r.data),
      };
    });

    const log: DagRunLog = {
      logId,
      sessionId: params.sessionId,
      planId: params.plan.planId,
      planSummary: params.plan.summary,
      startedAt: Date.now() - params.durationMs,
      durationMs: params.durationMs,
      ok: params.ok,
      waves: params.waves,
      maxConcurrency: params.maxConcurrency,
      nodes,
      skipped: params.skipped,
      userText: params.userText,
      triage: params.triage,
    };

    await this.redis.setJSON(this.logKey(logId), log, LOG_TTL);

    const index = (await this.redis.getJSON<string[]>(this.sessionIndexKey(params.sessionId))) ?? [];
    index.push(logId);
    await this.redis.setJSON(
      this.sessionIndexKey(params.sessionId),
      index.slice(-MAX_LOGS),
      LOG_TTL,
    );

    return log;
  }

  /** 查询某会话的执行历史 */
  async listBySession(sessionId: string, limit = 20): Promise<DagRunLog[]> {
    const index = (await this.redis.getJSON<string[]>(this.sessionIndexKey(sessionId))) ?? [];
    const ids = index.slice(-limit);
    const logs: DagRunLog[] = [];
    for (const id of ids) {
      const log = await this.redis.getJSON<DagRunLog>(this.logKey(id));
      if (log) logs.push(log);
    }
    return logs;
  }

  /** 获取单条日志 */
  async get(logId: string): Promise<DagRunLog | null> {
    return this.redis.getJSON<DagRunLog>(this.logKey(logId));
  }

  /** 清理某会话的日志 */
  async clear(sessionId: string): Promise<number> {
    const index = (await this.redis.getJSON<string[]>(this.sessionIndexKey(sessionId))) ?? [];
    for (const id of index) {
      await this.redis.del(this.logKey(id));
    }
    await this.redis.del(this.sessionIndexKey(sessionId));
    return index.length;
  }

  /** 输出精简摘要，控制日志体积 */
  private digest(data: unknown): string | undefined {
    if (data === undefined || data === null) return undefined;
    try {
      const s = JSON.stringify(data);
      if (s.length <= 400) return s;
      return `${s.slice(0, 400)}...(共 ${s.length} 字符)`;
    } catch {
      return undefined;
    }
  }
}
