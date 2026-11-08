/**
 * DAG 调度器
 *
 * V1.0：串行执行
 * V1.1：无依赖节点并行执行（并发度可配）
 *
 * 能力：
 *   - 拓扑调度：依赖满足即入队
 *   - 并行执行：同层无依赖节点同时跑
 *   - 节点级超时 / 指数退避重试
 *   - 单节点失败隔离：不污染整个计划
 *   - 失败传播：依赖失败的节点被跳过
 */

import type { DagNode, DagPlan, WorkerResult } from "./schemas.js";
import type { CriticLayer, CriticContext } from "./critic.js";
import type { Telemetry } from "../telemetry/telemetry.js";

export type NodeExecutor = (
  node: DagNode,
  deps: WorkerResult[],
) => Promise<WorkerResult>;

export interface DagRunResult {
  planId: string;
  ok: boolean;
  results: WorkerResult[];
  durationMs: number;
  skipped: string[];
  /** V1.1：并行度统计，便于展示调度效果 */
  stats: {
    /** 串行执行究竟需要多少轮 */
    waves: number;
    /** 实际达到的最大并发 */
    maxConcurrency: number;
  };
}

export interface DagSchedulerOptions {
  executor: NodeExecutor;
  critic?: CriticLayer;
  criticContext?: CriticContext;
  telemetry?: Telemetry;
  /** 单个节点最多重试次数（覆盖节点自带配置） */
  maxRetries?: number;
  /** V1.1：最大并发度，默认 4；设为 1 退化为串行 */
  maxConcurrency?: number;
}

export class DagScheduler {
  private readonly maxConcurrency: number;

  constructor(private readonly options: DagSchedulerOptions) {
    this.maxConcurrency = Math.max(1, options.maxConcurrency ?? 4);
  }

  async run(plan: DagPlan): Promise<DagRunResult> {
    const startedAt = Date.now();
    const results: WorkerResult[] = [];
    const byId = new Map(plan.nodes.map((n) => [n.nodeId, n]));
    const done = new Map<string, WorkerResult>();
    const skipped: string[] = [];

    const remaining = new Set(plan.nodes.map((n) => n.nodeId));
    /** 已判定失败且需阻断下游的节点 */
    const failed = new Set<string>();

    let waves = 0;
    let maxConcurrency = 0;

    while (remaining.size > 0) {
      // 1. 找出依赖已满足的节点
      const ready = [...remaining].filter((id) => {
        const node = byId.get(id)!;
        return node.dependsOn.every((d) => done.has(d));
      });

      if (ready.length === 0) {
        // 死锁：剩余节点依赖无法满足
        for (const id of remaining) skipped.push(id);
        break;
      }

      // 2. 剔除依赖失败（含被跳过）的节点
      const runnable: string[] = [];
      for (const id of ready) {
        const node = byId.get(id)!;
        const depFailed = node.dependsOn.some(
          (d) => failed.has(d) || skipped.includes(d),
        );
        if (depFailed) {
          remaining.delete(id);
          skipped.push(id);
        } else {
          runnable.push(id);
        }
      }

      if (runnable.length === 0) continue;

      waves++;
      // 3. 取本波次可并行执行的一批
      const batch = runnable.slice(0, this.maxConcurrency);
      maxConcurrency = Math.max(maxConcurrency, batch.length);

      for (const id of batch) remaining.delete(id);

      // 4. 并行执行
      const settled = await Promise.all(
        batch.map(async (nodeId) => {
          const node = byId.get(nodeId)!;

          // 前置校验
          if (this.options.critic && this.options.criticContext) {
            const verdict = this.options.critic.validateNode(node, this.options.criticContext);
            if (verdict.verdict === "abort") {
              const result: WorkerResult = {
                nodeId,
                workerType: node.workerType,
                ok: false,
                error: verdict.reasons.join("; "),
              };
              this.options.telemetry?.recordCritic(nodeId, verdict);
              return result;
            }
          }

          const depResults = node.dependsOn
            .map((d) => done.get(d))
            .filter((r): r is WorkerResult => !!r);

          return this.runNodeWithRetry(node, depResults);
        }),
      );

      // 5. 汇总结果
      for (const result of settled) {
        results.push(result);
        done.set(result.nodeId, result);
        if (!result.ok) failed.add(result.nodeId);
      }
    }

    return {
      planId: plan.planId,
      ok: results.every((r) => r.ok) && skipped.length === 0,
      results,
      durationMs: Date.now() - startedAt,
      skipped,
      stats: { waves, maxConcurrency },
    };
  }

  /** 节点执行 + 超时 + 重试 + 后置校验 */
  private async runNodeWithRetry(
    node: DagNode,
    deps: WorkerResult[],
  ): Promise<WorkerResult> {
    const maxRetries = this.options.maxRetries ?? node.retry.max;
    let lastResult: WorkerResult | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const startedAt = Date.now();

      try {
        const result = await this.withTimeout(
          this.options.executor(node, deps),
          node.timeoutMs,
        );

        result.durationMs = Date.now() - startedAt;
        lastResult = result;

        this.options.telemetry?.recordNode({
          nodeId: node.nodeId,
          workerType: node.workerType,
          ok: result.ok,
          durationMs: result.durationMs,
          attempts: attempt + 1,
          tokens: result.tokens,
        });

        if (!result.ok) {
          if (attempt < maxRetries) {
            await this.sleep(node.retry.backoffMs * 2 ** attempt);
            continue;
          }
          return result;
        }

        // 后置校验
        if (this.options.critic && this.options.criticContext) {
          const verdict = this.options.critic.validateWorkerResult(
            result,
            this.options.criticContext,
          );

          if (verdict.verdict === "pass") return result;

          if (verdict.verdict === "retry" && attempt < maxRetries) {
            this.options.telemetry?.recordCritic(node.nodeId, verdict);
            await this.sleep(node.retry.backoffMs * 2 ** attempt);
            continue;
          }

          this.options.telemetry?.recordCritic(node.nodeId, verdict);
          return {
            ...result,
            ok: false,
            error: verdict.reasons.join("; ") || "Critic 校验未通过",
          };
        }

        return result;
      } catch (err) {
        const durationMs = Date.now() - startedAt;
        const message = (err as Error).message;

        lastResult = {
          nodeId: node.nodeId,
          workerType: node.workerType,
          ok: false,
          error: message,
          durationMs,
        };

        this.options.telemetry?.recordNode({
          nodeId: node.nodeId,
          workerType: node.workerType,
          ok: false,
          durationMs,
          attempts: attempt + 1,
          error: message,
        });

        if (attempt < maxRetries) {
          await this.sleep(node.retry.backoffMs * 2 ** attempt);
          continue;
        }
      }
    }

    return (
      lastResult ?? {
        nodeId: node.nodeId,
        workerType: node.workerType,
        ok: false,
        error: "未知失败",
      }
    );
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`节点执行超时 (${timeoutMs}ms)`)),
        timeoutMs,
      );
      promise.then(
        (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        },
      );
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}

/** 拓扑排序（用于调试与日志展示执行顺序） */
export function topoSort(plan: DagPlan): string[] {
  const byId = new Map(plan.nodes.map((n) => [n.nodeId, n]));
  const visited = new Set<string>();
  const order: string[] = [];

  const visit = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    const node = byId.get(id);
    if (!node) return;
    for (const dep of node.dependsOn) visit(dep);
    order.push(id);
  };

  for (const n of plan.nodes) visit(n.nodeId);
  return order;
}

/** 计算理论上的最小执行波次（用于评估并行收益） */
export function computeWaves(plan: DagPlan): number {
  const byId = new Map(plan.nodes.map((n) => [n.nodeId, n]));
  const depth = new Map<string, number>();

  const visit = (id: string): number => {
    const cached = depth.get(id);
    if (cached !== undefined) return cached;
    const node = byId.get(id);
    if (!node) return 0;
    const d = node.dependsOn.length === 0
      ? 1
      : 1 + Math.max(...node.dependsOn.map(visit));
    depth.set(id, d);
    return d;
  };

  let max = 0;
  for (const n of plan.nodes) max = Math.max(max, visit(n.nodeId));
  return max;
}
