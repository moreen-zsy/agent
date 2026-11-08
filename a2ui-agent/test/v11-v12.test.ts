/**
 * V1.1 / V1.2 测试
 *
 * 覆盖：DAG 并行调度、语义缓存、子 Agent、降级、灰度、DAG 日志、评测集。
 */

import { describe, test, expect, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";

import { RedisClient } from "../src/session/redis-client.ts";
import { SessionManager } from "../src/session/session-manager.ts";
import { Telemetry } from "../src/telemetry/telemetry.ts";
import { DagScheduler, computeWaves } from "../src/orchestrator/dag-scheduler.ts";
import { dagPlanSchema } from "../src/orchestrator/schemas.ts";
import { SemanticCache, isSemanticCacheEligible } from "../src/cache/semantic-cache.ts";
import { SubAgentRunner } from "../src/orchestrator/sub-agent.ts";
import { DegradeController, FeatureRollout } from "../src/orchestrator/resilience.ts";
import { DagLogger } from "../src/orchestrator/dag-logger.ts";
import { EngineEvaluator } from "../src/eval/engine-eval.ts";

const redis = new RedisClient();
beforeAll(async () => {
  await redis.connect();
});

// ─────────────────────── V1.1 DAG 并行 ───────────────────────

describe("V1.1 DAG 并行调度", () => {
  const plan = (nodes: any[]) => dagPlanSchema.parse({ planId: "p", summary: "s", nodes });

  test("无依赖节点并行执行，达到并发 3", async () => {
    const p = plan([
      { nodeId: "a", workerType: "menu_worker", dependsOn: [], instruction: "a" },
      { nodeId: "b", workerType: "menu_worker", dependsOn: [], instruction: "b" },
      { nodeId: "c", workerType: "menu_worker", dependsOn: [], instruction: "c" },
    ]);

    const scheduler = new DagScheduler({
      executor: async (node) => {
        await new Promise((r) => setTimeout(r, 40));
        return { nodeId: node.nodeId, workerType: node.workerType, ok: true };
      },
      maxConcurrency: 3,
    });

    const start = Date.now();
    const run = await scheduler.run(p);
    const elapsed = Date.now() - start;

    expect(run.ok).toBe(true);
    expect(run.stats.maxConcurrency).toBe(3);
    expect(run.stats.waves).toBe(1);
    // 串行需 120ms，并行应明显更短
    expect(elapsed).toBeLessThan(110);
  });

  test("并发度为 1 时退化为串行", async () => {
    const p = plan([
      { nodeId: "a", workerType: "menu_worker", dependsOn: [], instruction: "a" },
      { nodeId: "b", workerType: "menu_worker", dependsOn: [], instruction: "b" },
    ]);

    let concurrent = 0;
    let maxConcurrent = 0;

    const scheduler = new DagScheduler({
      maxConcurrency: 1,
      executor: async (node) => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise((r) => setTimeout(r, 20));
        concurrent--;
        return { nodeId: node.nodeId, workerType: node.workerType, ok: true };
      },
    });

    await scheduler.run(p);
    expect(maxConcurrent).toBe(1);
  });

  test("链式依赖串行执行", async () => {
    const p = plan([
      { nodeId: "a", workerType: "menu_worker", dependsOn: [], instruction: "a" },
      { nodeId: "b", workerType: "menu_worker", dependsOn: ["a"], instruction: "b" },
      { nodeId: "c", workerType: "menu_worker", dependsOn: ["b"], instruction: "c" },
    ]);

    const order: string[] = [];
    const scheduler = new DagScheduler({
      executor: async (node) => {
        order.push(node.nodeId);
        return { nodeId: node.nodeId, workerType: node.workerType, ok: true };
      },
    });

    const run = await scheduler.run(p);
    expect(order).toEqual(["a", "b", "c"]);
    expect(run.stats.waves).toBe(3);
  });

  test("菱形依赖：并行分支后汇合", async () => {
    const p = plan([
      { nodeId: "root", workerType: "menu_worker", dependsOn: [], instruction: "r" },
      { nodeId: "left", workerType: "menu_worker", dependsOn: ["root"], instruction: "l" },
      { nodeId: "right", workerType: "menu_worker", dependsOn: ["root"], instruction: "r" },
      { nodeId: "join", workerType: "agui_render_worker", dependsOn: ["left", "right"], instruction: "j" },
    ]);

    expect(computeWaves(p)).toBe(3);

    const scheduler = new DagScheduler({
      maxConcurrency: 4,
      executor: async (node) => ({ nodeId: node.nodeId, workerType: node.workerType, ok: true }),
    });

    const run = await scheduler.run(p);
    expect(run.stats.waves).toBe(3);
    expect(run.stats.maxConcurrency).toBe(2); // left + right 并行
  });

  test("依赖失败的节点被跳过", async () => {
    const p = plan([
      { nodeId: "a", workerType: "menu_worker", dependsOn: [], instruction: "a", retry: { max: 0, backoffMs: 0 } },
      { nodeId: "b", workerType: "order_worker", dependsOn: ["a"], instruction: "b" },
    ]);

    const scheduler = new DagScheduler({
      executor: async (node) => ({
        nodeId: node.nodeId,
        workerType: node.workerType,
        ok: node.nodeId !== "a",
      }),
    });

    const run = await scheduler.run(p);
    expect(run.results.find((r) => r.nodeId === "a")?.ok).toBe(false);
    expect(run.skipped).toContain("b");
    expect(run.ok).toBe(false);
  });
});

// ─────────────────────── V1.1 语义缓存 ───────────────────────

describe("V1.1 语义缓存", () => {
  test("只读查询允许，写操作禁止", () => {
    expect(isSemanticCacheEligible("看看菜单")).toBe(true);
    expect(isSemanticCacheEligible("有什么推荐")).toBe(true);
    expect(isSemanticCacheEligible("帮我下单")).toBe(false);
    expect(isSemanticCacheEligible("我的订单")).toBe(false);
    expect(isSemanticCacheEligible("取消订单")).toBe(false);
  });

  test("超长查询不缓存", () => {
    expect(isSemanticCacheEligible("看看菜单".repeat(20))).toBe(false);
  });

  test("完全相同 query 命中且相似度为 1", async () => {
    const cache = new SemanticCache({ redis, threshold: 0.9 });
    const domain = `t-${randomUUID()}`;

    await cache.set("看看菜单", domain, "u1", { dishes: 12 });
    const hit = await cache.get("看看菜单", domain, "u1");

    expect(hit).not.toBeNull();
    expect(hit!.similarity).toBe(1);
    expect(hit!.value).toEqual({ dishes: 12 });

    await cache.clear(domain, "u1");
  });

  test("标点空白差异仍命中", async () => {
    const cache = new SemanticCache({ redis, threshold: 0.9 });
    const domain = `t-${randomUUID()}`;

    await cache.set("看看菜单", domain, "u1", { ok: 1 });
    const hit = await cache.get("看 看 菜 单！", domain, "u1");

    expect(hit).not.toBeNull();

    await cache.clear(domain, "u1");
  });

  test("不相关 query 不命中", async () => {
    const cache = new SemanticCache({ redis, threshold: 0.9 });
    const domain = `t-${randomUUID()}`;

    await cache.set("看看菜单", domain, "u1", { ok: 1 });
    const hit = await cache.get("查询我的订单状态", domain, "u1");

    expect(hit).toBeNull();

    await cache.clear(domain, "u1");
  });

  test("跨用户隔离", async () => {
    const cache = new SemanticCache({ redis, threshold: 0.9 });
    const domain = `t-${randomUUID()}`;

    await cache.set("看看菜单", domain, "u1", { ok: 1 });
    expect(await cache.get("看看菜单", domain, "u2")).toBeNull();

    await cache.clear(domain, "u1");
  });

  test("特征分析可解释", () => {
    const cache = new SemanticCache({ redis });
    const a = cache.analyze("看看菜单");
    expect(a.features.length).toBeGreaterThan(0);
    expect(a.similarity("看看菜单", "看看菜单")).toBe(1);
    expect(a.similarity("看看菜单", "我的订单")).toBeLessThan(0.5);
  });
});

// ─────────────────────── V1.1 子 Agent ───────────────────────

describe("V1.1 子 Agent 嵌套", () => {
  test("子任务执行后返回摘要，父会话不受污染", async () => {
    const session = new SessionManager(redis);
    const telemetry = new Telemetry(redis);
    const parentSid = `parent-${randomUUID()}`;

    await session.touchMeta(parentSid, { userId: "u1" });
    await session.appendMessage(parentSid, "user", "父级上下文");

    const runner = new SubAgentRunner({
      session,
      telemetry,
      executorFactory: () => async (node) => ({
        nodeId: node.nodeId,
        workerType: node.workerType,
        ok: true,
        data: { dishes: [{ id: "d1" }, { id: "d2" }] },
      }),
    });

    const result = await runner.run({
      parentSessionId: parentSid,
      goal: "查一下有哪些菜",
      workers: ["menu_worker"],
    });

    expect(result.ok).toBe(true);
    expect(result.summary).toContain("已完成");
    expect(result.facts.some((f) => f.includes("2 道菜"))).toBe(true);
    expect(result.depth).toBe(0);

    // 父会话工作记忆未被污染
    const parentWm = await session.getWorkingMemory(parentSid);
    expect(parentWm.recent).toHaveLength(1);
    expect(parentWm.recent[0]!.content).toBe("父级上下文");

    // 子会话已清理
    expect(await session.getMeta(result.childSessionId)).toBeNull();

    await session.destroy(parentSid);
  });

  test("超出最大深度被拒绝", async () => {
    const session = new SessionManager(redis);
    const telemetry = new Telemetry(redis);
    const sid = `depth-${randomUUID()}`;

    const runner = new SubAgentRunner({
      session,
      telemetry,
      executorFactory: () => async (node) => ({
        nodeId: node.nodeId,
        workerType: node.workerType,
        ok: true,
      }),
    });

    const result = await runner.run({
      parentSessionId: sid,
      goal: "x",
      workers: ["menu_worker"],
      depth: 5,
    });

    expect(result.ok).toBe(false);
    expect(result.summary).toContain("最大深度");
  });
});

// ─────────────────────── V1.2 降级 ───────────────────────

describe("V1.2 降级控制", () => {
  test("连续失败达阈值后降级", () => {
    const ctrl = new DegradeController(redis, { threshold: 2 });

    expect(ctrl.isDegraded).toBe(false);

    ctrl.recordFailure("planner_error");
    expect(ctrl.isDegraded).toBe(false);

    ctrl.recordFailure("planner_timeout");
    expect(ctrl.isDegraded).toBe(true);
    expect(ctrl.getState().reason).toBe("planner_timeout");
  });

  test("成功一次重置失败计数", () => {
    const ctrl = new DegradeController(redis, { threshold: 2 });

    ctrl.recordFailure("planner_error");
    ctrl.recordSuccess();
    ctrl.recordFailure("planner_error");

    expect(ctrl.isDegraded).toBe(false);
    expect(ctrl.getState().failures).toBe(1);
  });

  test("冷却期过后自动恢复", () => {
    const ctrl = new DegradeController(redis, { threshold: 1, cooldownMs: 50 });

    ctrl.recordFailure("planner_error");
    expect(ctrl.isDegraded).toBe(true);

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(ctrl.isDegraded).toBe(false);
        resolve();
      }, 80);
    });
  });

  test("手动降级与恢复", () => {
    const ctrl = new DegradeController(redis);

    ctrl.manual(true);
    expect(ctrl.isDegraded).toBe(true);
    expect(ctrl.getState().reason).toBe("manual");

    ctrl.manual(false);
    expect(ctrl.isDegraded).toBe(false);
  });
});

// ─────────────────────── V1.2 灰度 ───────────────────────

describe("V1.2 灰度发布", () => {
  test("0% 灰度全部关闭", () => {
    const rollout = new FeatureRollout(redis, { percentage: 0 });
    expect(rollout.isEnabled("user-1")).toBe(false);
    expect(rollout.isEnabled("user-2")).toBe(false);
  });

  test("100% 灰度全部开启", () => {
    const rollout = new FeatureRollout(redis, { percentage: 100 });
    expect(rollout.isEnabled("user-1")).toBe(true);
  });

  test("同一用户结果稳定（分桶幂等）", () => {
    const rollout = new FeatureRollout(redis, { percentage: 50 });
    const first = rollout.isEnabled("user-stable");
    for (let i = 0; i < 20; i++) {
      expect(rollout.isEnabled("user-stable")).toBe(first);
    }
  });

  test("白名单优先于比例", () => {
    const rollout = new FeatureRollout(redis, {
      percentage: 0,
      allowList: ["vip-user"],
    });
    expect(rollout.isEnabled("vip-user")).toBe(true);
    expect(rollout.isEnabled("normal-user")).toBe(false);
  });

  test("黑名单优先于白名单与比例", () => {
    const rollout = new FeatureRollout(redis, {
      percentage: 100,
      denyList: ["banned"],
    });
    expect(rollout.isEnabled("banned")).toBe(false);
    expect(rollout.isEnabled("ok-user")).toBe(true);
  });

  test("未登录用户不走新逻辑", () => {
    const rollout = new FeatureRollout(redis, { percentage: 100 });
    expect(rollout.isEnabled(undefined)).toBe(false);
  });
});

// ─────────────────────── V1.2 DAG 日志 ───────────────────────

describe("V1.2 DAG 执行日志", () => {
  test("记录执行并可回查", async () => {
    const logger = new DagLogger(redis);
    const sid = `log-${randomUUID()}`;

    const plan = dagPlanSchema.parse({
      planId: "plan-1",
      summary: "测试计划",
      nodes: [
        { nodeId: "n1", workerType: "menu_worker", dependsOn: [], instruction: "查菜单" },
        { nodeId: "n2", workerType: "agui_render_worker", dependsOn: ["n1"], instruction: "渲染" },
      ],
    });

    const log = await logger.record({
      sessionId: sid,
      userText: "看看菜单",
      triage: "ui_render/safe",
      plan,
      results: [
        { nodeId: "n1", workerType: "menu_worker", ok: true, durationMs: 100, data: { dishes: 12 } },
        { nodeId: "n2", workerType: "agui_render_worker", ok: true, durationMs: 200 },
      ],
      durationMs: 300,
      ok: true,
      waves: 2,
      maxConcurrency: 1,
      skipped: [],
    });

    expect(log.nodes).toHaveLength(2);
    expect(log.nodes[0]!.instruction).toBe("查菜单");

    const list = await logger.listBySession(sid);
    expect(list).toHaveLength(1);

    const fetched = await logger.get(log.logId);
    expect(fetched?.ok).toBe(true);

    await logger.clear(sid);
    expect(await logger.listBySession(sid)).toHaveLength(0);
  });

  test("大输出被摘要截断", async () => {
    const logger = new DagLogger(redis);
    const sid = `log-${randomUUID()}`;

    const plan = dagPlanSchema.parse({
      planId: "p",
      summary: "s",
      nodes: [{ nodeId: "n1", workerType: "menu_worker", dependsOn: [], instruction: "x" }],
    });

    const log = await logger.record({
      sessionId: sid,
      userText: "x",
      triage: "simple_query/safe",
      plan,
      results: [
        {
          nodeId: "n1",
          workerType: "menu_worker",
          ok: true,
          durationMs: 1,
          data: { big: "x".repeat(2000) },
        },
      ],
      durationMs: 1,
      ok: true,
      waves: 1,
      maxConcurrency: 1,
      skipped: [],
    });

    expect(log.nodes[0]!.outputDigest!.length).toBeLessThan(500);
    expect(log.nodes[0]!.outputDigest).toContain("共");

    await logger.clear(sid);
  });
});

// ─────────────────────── 评测集 ───────────────────────

describe("评测集", () => {
  test("Triage 分诊准确率 100%", async () => {
    const evaluator = new EngineEvaluator();
    const report = await evaluator.evalTriage();
    expect(report.score).toBe(1);
  });

  test("Critic 校验准确率 100%", () => {
    const evaluator = new EngineEvaluator();
    const report = evaluator.evalCritic();
    expect(report.score).toBe(1);
  });

  test("DAG 并行调度正确", async () => {
    const evaluator = new EngineEvaluator();
    const report = await evaluator.evalDag();
    expect(report.score).toBe(1);
  });

  test("语义缓存行为正确", async () => {
    const evaluator = new EngineEvaluator();
    const report = await evaluator.evalSemanticCache(redis);
    expect(report.score).toBe(1);
  });

  test("全量评测通过", async () => {
    const evaluator = new EngineEvaluator();
    const result = await evaluator.runAll(redis);
    console.log(
      `[eval] triage=${result.triage.score} critic=${result.critic.score} dag=${result.dag.score} semantic=${result.semantic.score} overall=${result.overall.score}`,
    );
    expect(result.overall.score).toBe(1);
  });
});
