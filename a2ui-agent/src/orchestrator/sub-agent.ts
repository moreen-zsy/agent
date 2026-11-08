/**
 * 子 Agent 嵌套（V1.1）
 *
 * 场景：复杂子任务（如「帮我查一下上次点的菜，再加一份」）拆出一个
 * 独立子会话执行，只把**摘要结果**返回给父 Agent，不污染父上下文。
 *
 * 设计要点：
 *   1. 子会话使用独立 sessionId（parent:child 命名），互不干扰
 *   2. 子 Agent 有自己的 token 预算与摘要
 *   3. 返回给父级的只有结构化摘要，不含子会话的全量对话
 *   4. 深度限制，防止无限递归
 *   5. 子会话空闲后自动清理
 */

import { randomUUID } from "@ag-ui/client";

import type { SessionManager, EntityStore } from "../session/session-manager.js";
import { DagScheduler, type NodeExecutor } from "../orchestrator/dag-scheduler.js";
import { dagPlanSchema, type WorkerResult } from "../orchestrator/schemas.js";
import type { Telemetry } from "../telemetry/telemetry.js";

const MAX_DEPTH = 2;

export interface SubAgentRequest {
  /** 父会话 ID */
  parentSessionId: string;
  /** 子任务目标 */
  goal: string;
  /** 可用 Worker 类型序列 */
  workers: Array<
    "menu_worker" | "order_worker" | "address_worker" | "cart_worker" | "agui_render_worker"
  >;
  /** 当前嵌套深度 */
  depth?: number;
}

export interface SubAgentResult {
  childSessionId: string;
  ok: boolean;
  /** 返回给父 Agent 的摘要（唯一会进入父上下文的内容） */
  summary: string;
  /** 结构化产出关键字段，供父级决策 */
  facts: string[];
  /** 关键实体（如新订单 ID），按需注入 */
  entities: Partial<EntityStore>;
  durationMs: number;
  depth: number;
}

export interface SubAgentDeps {
  session: SessionManager;
  telemetry: Telemetry;
  /** 由上层提供的、针对某个子会话构造执行器的工厂 */
  executorFactory: (childSessionId: string) => NodeExecutor;
  /** 可选：用于生成摘要的语言模型调用 */
  summarize?: (goal: string, results: WorkerResult[]) => Promise<string>;
}

export class SubAgentRunner {
  constructor(private readonly deps: SubAgentDeps) {}

  async run(req: SubAgentRequest): Promise<SubAgentResult> {
    const depth = req.depth ?? 0;
    const startedAt = Date.now();

    // 深度保护，防止无限嵌套
    if (depth >= MAX_DEPTH) {
      return {
        childSessionId: "",
        ok: false,
        summary: `子任务嵌套超过最大深度 ${MAX_DEPTH}，已拒绝执行`,
        facts: [],
        entities: {},
        durationMs: 0,
        depth,
      };
    }

    // 1. 创建独立子会话
    const childSessionId = `${req.parentSessionId}:child:${randomUUID().slice(0, 8)}`;
    await this.deps.session.touchMeta(childSessionId, {
      userId: (await this.deps.session.getMeta(req.parentSessionId))?.userId,
      tokenBudget: 20_000,
    });
    await this.deps.session.appendMessage(childSessionId, "user", req.goal);

    // 2. 构造子 DAG（线性串联，子任务通常简单）
    const nodes = req.workers.map((workerType, idx) => ({
      nodeId: `c${idx + 1}-${workerType}`,
      workerType,
      dependsOn: idx === 0 ? [] : [`c${idx}-${req.workers[idx - 1]}`],
      instruction: req.goal,
      retry: { max: 1, backoffMs: 200 },
      timeoutMs: 30_000,
    }));

    const plan = dagPlanSchema.parse({
      planId: `sub-${randomUUID().slice(0, 8)}`,
      summary: `子任务: ${req.goal.slice(0, 40)}`,
      nodes,
    });

    // 3. 执行
    const scheduler = new DagScheduler({
      executor: this.deps.executorFactory(childSessionId),
      telemetry: this.deps.telemetry,
    });

    const run = await scheduler.run(plan);

    // 4. 提取摘要与事实
    const facts = this.extractFacts(run.results);
    const entities = this.extractEntities(run.results);

    let summary: string;
    if (this.deps.summarize) {
      try {
        summary = await this.deps.summarize(req.goal, run.results);
      } catch {
        summary = this.fallbackSummary(req.goal, run);
      }
    } else {
      summary = this.fallbackSummary(req.goal, run);
    }

    // 5. 清理子会话（只保留摘要结果）
    await this.deps.session.destroy(childSessionId);

    return {
      childSessionId,
      ok: run.ok,
      summary,
      facts,
      entities,
      durationMs: Date.now() - startedAt,
      depth,
    };
  }

  private fallbackSummary(
    goal: string,
    run: { ok: boolean; results: WorkerResult[] },
  ): string {
    const okNodes = run.results.filter((r) => r.ok).map((r) => r.workerType);
    const failedNodes = run.results.filter((r) => !r.ok);
    const parts = [`子任务「${goal}」${run.ok ? "已完成" : "部分失败"}`];
    if (okNodes.length) parts.push(`成功步骤: ${okNodes.join(" → ")}`);
    if (failedNodes.length) {
      parts.push(`失败步骤: ${failedNodes.map((f) => `${f.workerType}(${f.error})`).join(", ")}`);
    }
    return parts.join("；");
  }

  private extractFacts(results: WorkerResult[]): string[] {
    const facts: string[] = [];
    for (const r of results) {
      if (!r.ok) continue;
      const data = r.data as Record<string, any> | undefined;
      if (!data) continue;

      if (data.orderNo) facts.push(`订单号 ${data.orderNo}`);
      if (data.total !== undefined) facts.push(`金额 ${data.total}`);
      if (Array.isArray(data.dishes)) facts.push(`查询到 ${data.dishes.length} 道菜`);
      if (Array.isArray(data.orders)) facts.push(`查询到 ${data.orders.length} 个订单`);
      if (Array.isArray(data.addresses)) facts.push(`用户有 ${data.addresses.length} 个地址`);
    }
    return facts;
  }

  private extractEntities(results: WorkerResult[]): Partial<EntityStore> {
    const entities: Partial<EntityStore> = {};
    for (const r of results) {
      if (!r.ok) continue;
      const data = r.data as Record<string, any> | undefined;
      if (!data) continue;

      if (data.orderNo) entities.activeOrder = data;
      if (Array.isArray(data.dishes)) {
        entities.menuSnapshot = { fetchedAt: Date.now(), dishes: data.dishes };
      }
      if (Array.isArray(data.orders)) entities.recentOrders = data.orders;
      if (Array.isArray(data.addresses)) entities.addresses = data.addresses;
    }
    return entities;
  }
}
