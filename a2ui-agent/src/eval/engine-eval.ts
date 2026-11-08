/**
 * 评测集（V1.1）
 *
 * 用一批固定 case 回归评估引擎质量：
 *   - Triage 分诊准确率
 *   - Critic 校验准确率
 *   - 语义缓存命中行为
 *   - DAG 并行调度正确性
 *
 * 不依赖真实 LLM，纯离线运行，可放入 CI。
 */

import { TriageLayer } from "../orchestrator/triage.js";
import { CriticLayer } from "../orchestrator/critic.js";
import { dagPlanSchema, triageResultSchema, type TriageResult } from "../orchestrator/schemas.js";
import { DagScheduler, computeWaves } from "../orchestrator/dag-scheduler.js";
import { isSemanticCacheEligible, SemanticCache } from "../cache/semantic-cache.js";
import type { RedisClient } from "../session/redis-client.js";

// ─────────────────────── 用例定义 ───────────────────────

export interface TriageCase {
  input: string;
  hasCartItems: boolean;
  isLoggedIn: boolean;
  expect: Partial<Pick<TriageResult, "taskType" | "skipPlanner" | "riskLevel">>;
}

export interface EvalReport {
  total: number;
  passed: number;
  failed: number;
  score: number;
  details: Array<{ name: string; ok: boolean; message?: string }>;
}

const TRIAGE_CASES: TriageCase[] = [
  { input: "看看菜单", hasCartItems: false, isLoggedIn: true, expect: { taskType: "ui_render", skipPlanner: true, riskLevel: "safe" } },
  { input: "有什么推荐", hasCartItems: false, isLoggedIn: true, expect: { taskType: "ui_render", skipPlanner: true } },
  { input: "介绍下红烧肉", hasCartItems: false, isLoggedIn: true, expect: { taskType: "simple_query", skipPlanner: true } },
  { input: "我的订单", hasCartItems: false, isLoggedIn: true, expect: { taskType: "simple_query", skipPlanner: true } },
  { input: "查看订单详情", hasCartItems: false, isLoggedIn: true, expect: { taskType: "simple_query", skipPlanner: true } },
  { input: "帮我下单一份红烧肉", hasCartItems: true, isLoggedIn: true, expect: { taskType: "risk_operation", skipPlanner: false, riskLevel: "high" } },
  { input: "结算购物车", hasCartItems: true, isLoggedIn: true, expect: { taskType: "risk_operation", riskLevel: "high" } },
  { input: "修改地址", hasCartItems: false, isLoggedIn: true, expect: { taskType: "multi_step_tool", skipPlanner: false } },
  { input: "取消订单", hasCartItems: false, isLoggedIn: true, expect: { taskType: "multi_step_tool" } },
];

// ─────────────────────── 评测执行 ───────────────────────

export class EngineEvaluator {
  private readonly triage = new TriageLayer();
  private readonly critic = new CriticLayer();

  /** Triage 分诊准确率 */
  async evalTriage(): Promise<EvalReport> {
    const details: EvalReport["details"] = [];

    for (const c of TRIAGE_CASES) {
      const result = await this.triage.classify(c.input, {
        hasCartItems: c.hasCartItems,
        isLoggedIn: c.isLoggedIn,
        hasActivePlan: false,
      });

      const mismatches: string[] = [];
      for (const [k, v] of Object.entries(c.expect)) {
        if ((result as any)[k] !== v) {
          mismatches.push(`${k}: 期望 ${v}, 实际 ${(result as any)[k]}`);
        }
      }

      details.push({
        name: `triage: ${c.input}`,
        ok: mismatches.length === 0,
        message: mismatches.join("; ") || undefined,
      });
    }

    return this.summarize(details);
  }

  /** Critic 校验准确率 */
  evalCritic(): EvalReport {
    const details: EvalReport["details"] = [];
    const ctx = {
      userText: "test",
      triage: triageResultSchema.parse({
        taskType: "risk_operation",
        complexity: 4,
        skipPlanner: false,
        requiredWorker: ["order_worker"],
        riskLevel: "high",
      }),
      entities: {
        cart: [{ dishId: "d1", price: 10, quantity: 1 }],
        addresses: [{ address: "x" }],
      },
    };

    const goodPlan = dagPlanSchema.parse({
      planId: "p",
      summary: "s",
      nodes: [{ nodeId: "n1", workerType: "order_worker", dependsOn: [], instruction: "下单" }],
    });
    details.push({
      name: "critic: 合法计划通过",
      ok: this.critic.validatePlan(goodPlan, ctx).verdict === "pass",
    });

    const cyclic = dagPlanSchema.safeParse({
      planId: "p",
      summary: "s",
      nodes: [
        { nodeId: "a", workerType: "menu_worker", dependsOn: ["b"], instruction: "x" },
        { nodeId: "b", workerType: "menu_worker", dependsOn: ["a"], instruction: "y" },
      ],
    });
    details.push({ name: "critic: 循环依赖被拒绝", ok: !cyclic.success });

    const noOrder = dagPlanSchema.parse({
      planId: "p",
      summary: "s",
      nodes: [{ nodeId: "n1", workerType: "menu_worker", dependsOn: [], instruction: "查菜单" }],
    });
    details.push({
      name: "critic: 高风险缺 order_worker 应重规划",
      ok: this.critic.validatePlan(noOrder, ctx).verdict === "replan",
    });

    details.push({
      name: "critic: 空购物车禁止下单",
      ok:
        this.critic.validateNode(
          {
            nodeId: "n1",
            workerType: "order_worker",
            dependsOn: [],
            instruction: "提交订单",
            retry: { max: 1, backoffMs: 0 },
            timeoutMs: 30000,
          },
          { ...ctx, entities: { cart: [], addresses: [] } },
        ).verdict === "abort",
    });

    details.push({
      name: "critic: A2UI 缺 root 应重试",
      ok:
        this.critic.validateWorkerResult(
          {
            nodeId: "n1",
            workerType: "agui_render_worker",
            ok: true,
            data: { surfaceId: "s", catalogId: "c", components: [{ id: "x" }] },
          },
          ctx,
        ).verdict === "retry",
    });

    details.push({
      name: "critic: 负金额中止",
      ok:
        this.critic.validateWorkerResult(
          { nodeId: "n1", workerType: "order_worker", ok: true, data: { total: -1 } },
          ctx,
        ).verdict === "abort",
    });

    return this.summarize(details);
  }

  /** DAG 并行调度正确性 */
  async evalDag(): Promise<EvalReport> {
    const details: EvalReport["details"] = [];

    const parallelPlan = dagPlanSchema.parse({
      planId: "p",
      summary: "s",
      nodes: [
        { nodeId: "a", workerType: "menu_worker", dependsOn: [], instruction: "a" },
        { nodeId: "b", workerType: "menu_worker", dependsOn: [], instruction: "b" },
        { nodeId: "c", workerType: "menu_worker", dependsOn: [], instruction: "c" },
      ],
    });

    details.push({
      name: "dag: 独立节点理论 1 波",
      ok: computeWaves(parallelPlan) === 1,
    });

    const scheduler = new DagScheduler({
      executor: async (node) => {
        await new Promise((r) => setTimeout(r, 30));
        return { nodeId: node.nodeId, workerType: node.workerType, ok: true };
      },
      maxConcurrency: 3,
    });

    const run = await scheduler.run(parallelPlan);
    details.push({
      name: "dag: 三节点并行实际达到并发 3",
      ok: run.stats.maxConcurrency === 3,
      message: `waves=${run.stats.waves}, maxConcurrency=${run.stats.maxConcurrency}`,
    });

    details.push({
      name: "dag: 并行耗时小于串行",
      ok: run.durationMs < 90,
      message: `durationMs=${run.durationMs}`,
    });

    const chainPlan = dagPlanSchema.parse({
      planId: "p2",
      summary: "s",
      nodes: [
        { nodeId: "a", workerType: "menu_worker", dependsOn: [], instruction: "a" },
        { nodeId: "b", workerType: "menu_worker", dependsOn: ["a"], instruction: "b" },
        { nodeId: "c", workerType: "menu_worker", dependsOn: ["b"], instruction: "c" },
      ],
    });
    details.push({
      name: "dag: 链式依赖理论 3 波",
      ok: computeWaves(chainPlan) === 3,
    });

    const chainScheduler = new DagScheduler({
      executor: async (node) => ({ nodeId: node.nodeId, workerType: node.workerType, ok: true }),
    });
    const chainRun = await chainScheduler.run(chainPlan);
    details.push({
      name: "dag: 链式依赖串行执行 3 波",
      ok: chainRun.stats.waves === 3,
    });

    return this.summarize(details);
  }

  /** 语义缓存判定与相似度 */
  async evalSemanticCache(redis: RedisClient): Promise<EvalReport> {
    const details: EvalReport["details"] = [];
    const cache = new SemanticCache({ redis, threshold: 0.9 });
    const domain = `eval-${Date.now()}`;

    details.push({
      name: "semantic: 只读查询允许缓存",
      ok: isSemanticCacheEligible("看看菜单") && isSemanticCacheEligible("有什么推荐"),
    });

    details.push({
      name: "semantic: 写操作禁止缓存",
      ok:
        !isSemanticCacheEligible("帮我下单一份红烧肉") &&
        !isSemanticCacheEligible("取消订单") &&
        !isSemanticCacheEligible("修改地址"),
    });

    details.push({
      name: "semantic: 会话强依赖禁止缓存",
      ok: !isSemanticCacheEligible("我的订单") && !isSemanticCacheEligible("刚才点的菜"),
    });

    await cache.set("看看菜单", domain, "u1", { dishes: 12 });
    const exact = await cache.get("看看菜单", domain, "u1");
    details.push({
      name: "semantic: 相同 query 命中",
      ok: exact !== null && exact.similarity === 1,
    });

    const variant = await cache.get("  看看，菜单！ ", domain, "u1");
    details.push({
      name: "semantic: 标点空白差异仍命中",
      ok: variant !== null,
    });

    const miss = await cache.get("帮我查订单状态", domain, "u1");
    details.push({
      name: "semantic: 不相关 query 不命中",
      ok: miss === null,
    });

    const otherUser = await cache.get("看看菜单", domain, "u2");
    details.push({
      name: "semantic: 跨用户隔离",
      ok: otherUser === null,
    });

    await cache.clear(domain, "u1");
    return this.summarize(details);
  }

  /** 运行全部评测 */
  async runAll(redis: RedisClient): Promise<{
    triage: EvalReport;
    critic: EvalReport;
    dag: EvalReport;
    semantic: EvalReport;
    overall: EvalReport;
  }> {
    const triage = await this.evalTriage();
    const critic = this.evalCritic();
    const dag = await this.evalDag();
    const semantic = await this.evalSemanticCache(redis);

    const allDetails = [
      ...triage.details,
      ...critic.details,
      ...dag.details,
      ...semantic.details,
    ];

    return { triage, critic, dag, semantic, overall: this.summarize(allDetails) };
  }

  private summarize(details: EvalReport["details"]): EvalReport {
    const passed = details.filter((d) => d.ok).length;
    return {
      total: details.length,
      passed,
      failed: details.length - passed,
      score: details.length === 0 ? 1 : passed / details.length,
      details,
    };
  }
}
