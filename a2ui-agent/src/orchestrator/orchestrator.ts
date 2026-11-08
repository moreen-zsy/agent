/**
 * 编排运行时
 *
 * 把 Triage → Planner → Worker → Critic 串成一条可观测的执行链，
 * 并与 SessionManager / CacheSubsystem / CheckpointManager 联动。
 *
 * 设计原则：
 *   - V1.0 以「可用、可观测、可回滚」为先，不追求并行
 *   - 简单任务走快捷路径（skipPlanner），不消耗 Planner token
 *   - 所有层输出都经 Zod 校验
 */

import { randomUUID } from "@ag-ui/client";
import type { LanguageModel } from "ai";

import { TriageLayer, type TriageMeta } from "./triage.js";
import { CriticLayer, type CriticContext } from "./critic.js";
import { DagScheduler, type DagRunResult, type NodeExecutor } from "./dag-scheduler.js";
import {
  dagPlanSchema,
  type DagPlan,
  type TriageResult,
  type WorkerResult,
} from "./schemas.js";
import type { SessionManager } from "../session/session-manager.js";
import type { CheckpointManager } from "../checkpoint/checkpoint-manager.js";
import type { CacheSubsystem } from "../cache/cache-subsystem.js";
import type { SemanticCache } from "../cache/semantic-cache.js";
import { isSemanticCacheEligible } from "../cache/semantic-cache.js";
import type { Telemetry } from "../telemetry/telemetry.js";
import type { McpGateway } from "../gateway/mcp-gateway.js";
import type { DegradeController } from "./resilience.js";
import type { DagLogger } from "./dag-logger.js";

export interface OrchestratorDeps {
  session: SessionManager;
  critic: CriticLayer;
  checkpoint: CheckpointManager;
  cache: CacheSubsystem;
  telemetry: Telemetry;
  gateway?: McpGateway;
  /** 用于摘要压缩与（未来）LLM 分诊的模型 */
  model?: LanguageModel;
}

export interface OrchestratorDeps {
  session: SessionManager;
  critic: CriticLayer;
  checkpoint: CheckpointManager;
  cache: CacheSubsystem;
  telemetry: Telemetry;
  gateway?: McpGateway;
  /** 用于摘要压缩与（未来）LLM 分诊的模型 */
  model?: LanguageModel;
  /** V1.1：语义缓存（可选） */
  semanticCache?: SemanticCache;
  /** V1.2：降级控制器（可选） */
  degrade?: DegradeController;
  /** V1.2：DAG 日志（可选） */
  dagLogger?: DagLogger;
  /** V1.1：最大并发度，默认 4 */
  maxConcurrency?: number;
}

export interface OrchestratorInput {
  sessionId: string;
  userText: string;
  meta: TriageMeta;
  /** 用户 ID，用于灰度与缓存隔离 */
  userId?: string;
  /** 业务域，用于语义缓存隔离 */
  domain?: string;
  /** 由上层注入的节点执行器（负责实际调用 LLM/MCP） */
  executor: NodeExecutor;
}

export interface OrchestratorOutput {
  runId: string;
  triage: TriageResult;
  plan: DagPlan;
  run: DagRunResult;
  ok: boolean;
  /** 供 SSE 推送的最终结果 */
  results: WorkerResult[];
  /** V1.1：是否命中语义缓存 */
  semanticHit?: { similarity: number; matchedQuery: string };
  /** V1.1：是否走了子 Agent */
  usedSubAgent?: boolean;
  /** V1.2：本次执行是否处于降级模式 */
  degraded: boolean;
}

export class Orchestrator {
  private readonly triage = new TriageLayer();

  constructor(private readonly deps: OrchestratorDeps) {}

  async run(input: OrchestratorInput): Promise<OrchestratorOutput> {
    const runId = randomUUID();
    const startedAt = Date.now();
    const { sessionId, userText } = input;

    // ── 0. 会话上下文 ──
    await this.deps.session.touchMeta(sessionId, { userId: input.userId });
    const entities = await this.deps.session.getEntities(sessionId);
    const degraded = this.deps.degrade?.isDegraded ?? false;

    const criticContext: CriticContext = {
      userText,
      triage: {
        taskType: "simple_query",
        complexity: 1,
        skipPlanner: true,
        requiredWorker: [],
        riskLevel: "safe",
      },
      entities,
    };

    // ── 1. Triage ──
    const triageStarted = Date.now();
    const triage = await this.triage.classify(userText, input.meta);
    criticContext.triage = triage;

    await this.deps.session.appendTrace(sessionId, {
      at: Date.now(),
      stage: "triage",
      input: userText,
      output: triage,
      durationMs: Date.now() - triageStarted,
    });

    // ── 1.5 V1.1 语义缓存（仅无状态只读查询）──
    const domain = input.domain ?? "food";
    if (
      this.deps.semanticCache &&
      triage.skipPlanner &&
      triage.riskLevel === "safe" &&
      isSemanticCacheEligible(userText)
    ) {
      const hit = await this.deps.semanticCache.get<WorkerResult[]>(
        userText,
        domain,
        input.userId,
      );
      if (hit) {
        console.log(
          `[orchestrator] 语义缓存命中 similarity=${hit.similarity} "${hit.matchedQuery}"`,
        );
        const run: DagRunResult = {
          planId: `semantic-${runId.slice(0, 8)}`,
          ok: true,
          results: hit.value,
          durationMs: Date.now() - startedAt,
          skipped: [],
          stats: { waves: 0, maxConcurrency: 0 },
        };
        this.deps.telemetry.recordRun({
          sessionId,
          runId,
          taskType: `semantic:${triage.taskType}`,
          ok: true,
          totalMs: run.durationMs,
          llmTokens: 0,
          nodeCount: 0,
          cacheHits: 1,
          cacheMisses: 0,
          at: Date.now(),
        });
        return {
          runId,
          triage,
          plan: { planId: run.planId, summary: "语义缓存命中", nodes: [] },
          run,
          ok: true,
          results: hit.value,
          semanticHit: { similarity: hit.similarity, matchedQuery: hit.matchedQuery },
          degraded,
        };
      }
    }

    // ── 2. Planner（或快捷路径）──
    const plan = triage.skipPlanner
      ? this.buildFastPathPlan(triage)
      : await this.plan(userText, triage, criticContext);

    await this.deps.session.touchMeta(sessionId, { currentPlanId: plan.planId });
    await this.deps.session.appendTrace(sessionId, {
      at: Date.now(),
      stage: "plan",
      input: { triage, skipPlanner: triage.skipPlanner },
      output: plan,
    });

    // ── 3. 执行 DAG（含 Checkpoint / Critic / 并行）──
    const scheduler = new DagScheduler({
      executor: this.wrapExecutorWithCheckpoint(input.executor, plan, sessionId),
      critic: this.deps.critic,
      criticContext,
      telemetry: this.deps.telemetry,
      // V1.1：无依赖节点并行；降级时退化为串行，优先保证稳定
      maxConcurrency: degraded ? 1 : (this.deps.maxConcurrency ?? 4),
    });

    const run = await scheduler.run(plan);

    // ── 4. 整体意图对齐校验 ──
    const finalVerdict = this.deps.critic.checkIntentAlignment(run.results, criticContext);
    let ok = run.ok && finalVerdict.verdict === "pass";

    // ── 4.5 V1.2 降级状态更新 ──
    if (this.deps.degrade) {
      if (ok) {
        this.deps.degrade.recordSuccess();
      } else {
        this.deps.degrade.recordFailure("planner_error");
      }
    }

    // ── 4.6 V1.1 写入语义缓存（仅成功的只读查询）──
    if (
      ok &&
      this.deps.semanticCache &&
      triage.skipPlanner &&
      triage.riskLevel === "safe" &&
      isSemanticCacheEligible(userText)
    ) {
      await this.deps.semanticCache.set(userText, domain, input.userId, run.results);
    }

    // ── 5. 记录轨迹与指标 ──
    const cacheStats = this.deps.cache.tools.getStats();
    await this.deps.session.appendTrace(sessionId, {
      at: Date.now(),
      stage: "worker",
      output: {
        planId: plan.planId,
        ok,
        nodeResults: run.results.map((r) => ({
          nodeId: r.nodeId,
          ok: r.ok,
          error: r.error,
        })),
        skipped: run.skipped,
        waves: run.stats.waves,
        maxConcurrency: run.stats.maxConcurrency,
      },
      durationMs: run.durationMs,
    });

    this.deps.telemetry.recordRun({
      sessionId,
      runId,
      taskType: triage.taskType,
      planId: plan.planId,
      ok,
      totalMs: Date.now() - startedAt,
      llmTokens: run.results.reduce((s, r) => s + (r.tokens ?? 0), 0),
      nodeCount: run.results.length,
      cacheHits: cacheStats.hits,
      cacheMisses: cacheStats.misses,
      at: Date.now(),
    });

    // ── 6. V1.2 持久化 DAG 执行日志 ──
    if (this.deps.dagLogger) {
      await this.deps.dagLogger.record({
        sessionId,
        userText,
        triage: `${triage.taskType}/${triage.riskLevel}`,
        plan,
        results: run.results,
        durationMs: run.durationMs,
        ok,
        waves: run.stats.waves,
        maxConcurrency: run.stats.maxConcurrency,
        skipped: run.skipped,
      });
    }

    return { runId, triage, plan, run, ok, results: run.results, degraded };
  }

  /**
   * 快捷路径：跳过 Planner，直接构造单节点计划
   *
   * 这是「简单任务不浪费 Planner token」的核心实现。
   */
  private buildFastPathPlan(triage: TriageResult): DagPlan {
    const workers = triage.requiredWorker.length > 0 ? triage.requiredWorker : ["menu_worker"];

    const nodes = workers.map((workerType, idx) => ({
      nodeId: `fast-${idx}-${workerType}`,
      workerType,
      dependsOn: idx === 0 ? [] : [`fast-${idx - 1}-${workers[idx - 1]}`],
      instruction: `按用户请求执行 ${workerType} 职责`,
      retry: { max: 1, backoffMs: 300 },
      timeoutMs: 30_000,
    }));

    return dagPlanSchema.parse({
      planId: `fast-${randomUUID().slice(0, 8)}`,
      summary: `快捷路径：${triage.reason ?? triage.taskType}`,
      nodes,
    });
  }

  /**
   * Planner 路径
   *
   * V1.0 先实现「模板化规划」：根据 triage 结果生成确定性 DAG，
   * 避免为了规划再调用一次 LLM（节省 token、降低延迟）。
   *
   * 真正的 LLM Planner 在 V1.1 引入（配合 Plan 模板缓存）。
   */
  private async plan(
    userText: string,
    triage: TriageResult,
    _ctx: CriticContext,
  ): Promise<DagPlan> {
    const workers = triage.requiredWorker.length > 0
      ? triage.requiredWorker
      : ["menu_worker", "agui_render_worker"];

    // 工具集哈希用于 L4 模板缓存
    const tools = this.deps.gateway?.getToolNames() ?? [];
    const cached = await this.deps.cache.plans.get<DagPlan>(userText, tools);
    if (cached) {
      const parsed = dagPlanSchema.safeParse(cached);
      if (parsed.success) return parsed.data;
    }

    const nodes = workers.map((workerType, idx) => ({
      nodeId: `n${idx + 1}-${workerType}`,
      workerType,
      dependsOn: idx === 0 ? [] : [`n${idx}-${workers[idx - 1]}`],
      instruction: this.instructionFor(workerType, userText, triage),
      retry: { max: triage.riskLevel === "high" ? 0 : 1, backoffMs: 300 },
      timeoutMs: workerType === "agui_render_worker" ? 60_000 : 30_000,
    }));

    const plan = dagPlanSchema.parse({
      planId: `plan-${randomUUID().slice(0, 8)}`,
      summary: `${triage.taskType}: ${userText.slice(0, 40)}`,
      nodes,
    });

    // 前置校验：不合法就不缓存
    const verdict = this.deps.critic.validatePlan(plan, _ctx);
    if (verdict.verdict === "pass") {
      await this.deps.cache.plans.set(userText, tools, plan);
    }

    return plan;
  }

  private instructionFor(workerType: string, userText: string, triage: TriageResult): string {
    switch (workerType) {
      case "menu_worker":
        return `查询与「${userText}」相关的菜单/菜品信息`;
      case "order_worker":
        return triage.riskLevel === "high"
          ? `为用户执行下单操作：${userText}`
          : `查询订单信息：${userText}`;
      case "address_worker":
        return `处理地址相关操作：${userText}`;
      case "cart_worker":
        return `处理购物车操作：${userText}`;
      case "agui_render_worker":
        return `根据已有数据生成 A2UI v0.9 界面描述`;
      default:
        return userText;
    }
  }

  /**
   * 包装执行器：在每个节点执行前打 Checkpoint
   */
  private wrapExecutorWithCheckpoint(
    executor: NodeExecutor,
    plan: DagPlan,
    sessionId: string,
  ): NodeExecutor {
    return async (node, deps) => {
      // 执行前快照
      const entities = await this.deps.session.getEntities(sessionId);
      const isCritical = node.workerType === "order_worker";

      const checkpoint = await this.deps.checkpoint.push(
        sessionId,
        plan.planId,
        node.nodeId,
        entities,
        isCritical,
      );

      const result = await executor(node, deps);

      if (!result.ok) {
        // 节点失败：回滚实体到执行前状态
        const rolledBack = await this.deps.checkpoint.rollback(sessionId, checkpoint.checkpointId);
        if (rolledBack) {
          await this.deps.session.updateEntities(sessionId, rolledBack);
          console.warn(`[orchestrator] 节点 ${node.nodeId} 失败，已回滚实体状态`);
        }
        await this.deps.session.appendTrace(sessionId, {
          at: Date.now(),
          stage: "error",
          node: node.nodeId,
          error: result.error,
        });
      } else {
        // 成功后丢弃快照，避免堆积
        await this.deps.checkpoint.discard(sessionId, checkpoint.checkpointId);
      }

      return result;
    };
  }
}
