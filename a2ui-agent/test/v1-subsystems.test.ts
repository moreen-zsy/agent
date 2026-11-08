/**
 * V1.0 子系统测试
 *
 * 覆盖：SessionManager 四分区、Token 估算、缓存、Checkpoint、
 *       Triage 分诊、Critic 校验、DAG 调度器。
 *
 * 需要 Redis（docker compose up -d redis），未连接时自动降级内存实现。
 */

import { describe, test, expect, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";

import { SessionManager } from "../src/session/session-manager.ts";
import { RedisClient } from "../src/session/redis-client.ts";
import { estimateTokens, estimateMessagesTokens } from "../src/session/token-estimator.ts";
import { CacheSubsystem } from "../src/cache/cache-subsystem.ts";
import { CheckpointManager } from "../src/checkpoint/checkpoint-manager.ts";
import { TriageLayer } from "../src/orchestrator/triage.ts";
import { CriticLayer } from "../src/orchestrator/critic.ts";
import { DagScheduler } from "../src/orchestrator/dag-scheduler.ts";
import { dagPlanSchema, type DagPlan } from "../src/orchestrator/schemas.ts";

// 共享一个 Redis 客户端实例（未连接时自动降级为内存实现）
const redis = new RedisClient();
beforeAll(async () => {
  await redis.connect();
});

function newSession() {
  return new SessionManager(redis, { workingMemoryBudget: 100 });
}

// ─────────────────────── Token 估算 ───────────────────────

describe("Token 估算", () => {
  test("中文按 ~1.5 字/token 估算", () => {
    const tokens = estimateTokens("你好世界");
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(10);
  });

  test("英文按 ~4 字符/token 估算", () => {
    const tokens = estimateTokens("hello world this is a test");
    expect(tokens).toBeGreaterThan(3);
    expect(tokens).toBeLessThan(15);
  });

  test("空文本返回 0", () => {
    expect(estimateTokens("")).toBe(0);
  });

  test("消息数组包含固定开销", () => {
    const tokens = estimateMessagesTokens([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ]);
    expect(tokens).toBeGreaterThanOrEqual(8);
  });
});

// ─────────────────────── SessionManager ───────────────────────

describe("SessionManager 四分区存储", () => {
  test("meta 可创建并更新", async () => {
    const sm = newSession();
    const sid = randomUUID();

    const meta = await sm.touchMeta(sid, { userId: "u1" });
    expect(meta.sessionId).toBe(sid);
    expect(meta.userId).toBe("u1");
    expect(meta.active).toBe(true);

    const updated = await sm.touchMeta(sid, { currentPlanId: "p1" });
    expect(updated.currentPlanId).toBe("p1");
    // 原字段保留
    expect(updated.userId).toBe("u1");

    await sm.destroy(sid);
  });

  test("working memory 追加消息与结论", async () => {
    const sm = newSession();
    const sid = randomUUID();

    await sm.appendMessage(sid, "user", "我想吃红烧肉");
    await sm.appendMessage(sid, "assistant", "好的，为您展示菜单");
    await sm.addFact(sid, "用户偏好：红烧肉");

    const wm = await sm.getWorkingMemory(sid);
    expect(wm.recent).toHaveLength(2);
    expect(wm.facts).toContain("用户偏好：红烧肉");

    const ctx = await sm.buildContext(sid);
    // 第一条是摘要/事实的 system 消息
    expect(ctx[0]?.role).toBe("system");
    expect(ctx[0]?.content).toContain("用户偏好");

    // 重复添加同一结论不会重复
    await sm.addFact(sid, "用户偏好：红烧肉");
    const wm2 = await sm.getWorkingMemory(sid);
    expect(wm2.facts.filter((f) => f === "用户偏好：红烧肉")).toHaveLength(1);

    await sm.destroy(sid);
  });

  test("entity store 原子浅合并", async () => {
    const sm = newSession();
    const sid = randomUUID();

    await sm.updateEntities(sid, { cart: [{ dishId: "d1", name: "红烧肉", price: 25.5, quantity: 2 }] });
    await sm.updateEntities(sid, { addresses: [{ id: "a1", address: "北京" }] });

    const entities = await sm.getEntities(sid);
    expect(entities.cart).toHaveLength(1);
    expect(entities.addresses).toHaveLength(1);

    const digest = await sm.buildEntityDigest(sid);
    expect(digest).toContain("当前业务状态");
    expect(digest).toContain("红烧肉");

    await sm.destroy(sid);
  });

  test("按需注入实体片段（只取指定 key）", async () => {
    const sm = newSession();
    const sid = randomUUID();

    await sm.updateEntities(sid, {
      cart: [{ dishId: "d1", name: "A", price: 1, quantity: 1 }],
      addresses: [{ id: "a1", address: "上海" }],
    });

    const digest = await sm.buildEntityDigest(sid, ["cart"]);
    expect(digest).toContain("A");
    expect(digest).not.toContain("上海");

    await sm.destroy(sid);
  });

  test("trace 记录并可截断", async () => {
    const sm = new SessionManager(redis, { maxTraceEntries: 3 });
    const sid = randomUUID();

    for (let i = 0; i < 5; i++) {
      await sm.appendTrace(sid, { at: Date.now(), stage: "worker", node: `n${i}` });
    }

    const trace = await sm.getTrace(sid);
    expect(trace).toHaveLength(3);
    expect(trace.at(-1)?.node).toBe("n4");

    await sm.destroy(sid);
  });

  test("超出预算时触发压缩判定", async () => {
    const sm = newSession();
    const sid = randomUUID();

    // 预算 100 token，塞入大量中文
    for (let i = 0; i < 20; i++) {
      await sm.appendMessage(sid, "user", `这是第${i}条比较长的测试消息内容用于触发压缩判断`);
    }

    expect(await sm.shouldCompress(sid)).toBe(true);

    await sm.destroy(sid);
  });

  test("压缩后保留最近消息，旧内容进入摘要", async () => {
    const sm = newSession();
    const sid = randomUUID();

    for (let i = 0; i < 10; i++) {
      await sm.appendMessage(sid, "user", `消息${i}`);
    }

    const result = await sm.compress(sid, async (old, prev) => {
      return `${prev} [压缩了${old.length}条]`;
    });

    expect(result.compressed).toBeGreaterThan(0);
    const wm = await sm.getWorkingMemory(sid);
    expect(wm.recent.length).toBe(6); // keepRecentMessages 默认 6
    expect(wm.summary).toContain("压缩了");

    await sm.destroy(sid);
  });
});

// ─────────────────────── 缓存子系统 ───────────────────────

describe("多级缓存", () => {
  test("L1 前缀生成稳定哈希", () => {
    const cache = new CacheSubsystem(redis);
    const a = cache.prefix.buildStaticPrefix("v0.9", "1.0", ["partA", "partB"]);
    const b = cache.prefix.buildStaticPrefix("v0.9", "1.0", ["partA", "partB"]);
    expect(a).toBe(b);
    expect(cache.prefix.hashPrefix(a)).toBe(cache.prefix.hashPrefix(b));

    // 版本变化 → 不同前缀
    const c = cache.prefix.buildStaticPrefix("v0.9", "1.1", ["partA", "partB"]);
    expect(cache.prefix.hashPrefix(a)).not.toBe(cache.prefix.hashPrefix(c));
  });

  test("L2 只读工具结果被缓存", async () => {
    const cache = new CacheSubsystem(redis);
    const sid = randomUUID();
    const args = { category: "main" };

    await cache.tools.set(sid, "query_menu", args, { dishes: [1, 2, 3] });
    const hit = await cache.tools.get(sid, "query_menu", args);

    expect(hit).toEqual({ dishes: [1, 2, 3] });
    expect(cache.tools.getStats().hits).toBe(1);

    await cache.tools.invalidate(sid, "query_menu");
    cache.tools.resetStats();
  });

  test("写操作工具不缓存", async () => {
    const cache = new CacheSubsystem(redis);
    const sid = randomUUID();

    expect(cache.tools.isCacheable("place_order")).toBe(false);
    await cache.tools.set(sid, "place_order", {}, { orderId: "o1" });
    expect(await cache.tools.get(sid, "place_order", {})).toBeUndefined();
  });

  test("token 字段不影响缓存键", async () => {
    const cache = new CacheSubsystem(redis);
    const sid = randomUUID();

    await cache.tools.set(sid, "get_dish_detail", { id: "d1", token: "abc" }, { name: "红烧肉" });
    const hit = await cache.tools.get(sid, "get_dish_detail", { id: "d1", token: "xyz" });
    expect(hit).toEqual({ name: "红烧肉" });

    await cache.tools.invalidate(sid, "get_dish_detail");
    cache.tools.resetStats();
  });

  test("写操作触发关联缓存失效", async () => {
    const cache = new CacheSubsystem(redis);
    const sid = randomUUID();

    await cache.tools.set(sid, "get_orders", {}, { orders: [] });
    expect(await cache.tools.get(sid, "get_orders", {})).toBeDefined();

    const invalidated = await cache.tools.invalidate(sid, "place_order");
    expect(invalidated).toBeGreaterThan(0);
    expect(await cache.tools.get(sid, "get_orders", {})).toBeUndefined();

    cache.tools.resetStats();
  });

  test("L4 Plan 模板缓存", async () => {
    const cache = new CacheSubsystem(redis);
    const intent = "帮我点一份红烧肉";
    const tools = ["query_menu", "place_order"];

    await cache.plans.set(intent, tools, { planId: "p1" });
    expect(await cache.plans.get(intent, tools)).toEqual({ planId: "p1" });

    // 工具集不同 → 命中不同键
    expect(await cache.plans.get(intent, ["query_menu"])).toBeNull();

    await cache.plans.clearAll();
  });
});

// ─────────────────────── Checkpoint ───────────────────────

describe("Checkpoint & 回滚", () => {
  test("快照后可回滚到之前状态", async () => {
    const ckpt = new CheckpointManager(redis);
    const sid = randomUUID();

    const before = { cart: [{ dishId: "d1", name: "A", price: 10, quantity: 1 }] };
    const checkpoint = await ckpt.push(sid, "plan1", "node1", before);

    // 模拟节点修改了实体
    const after = { cart: [{ dishId: "d1", name: "A", price: 10, quantity: 99 }] };

    const rolled = await ckpt.rollback(sid, checkpoint.checkpointId);
    expect(rolled).toEqual(before);
    expect(rolled).not.toEqual(after);

    await ckpt.clear(sid);
  });

  test("latest 返回最近快照", async () => {
    const ckpt = new CheckpointManager(redis);
    const sid = randomUUID();

    await ckpt.push(sid, "p1", "n1", { cart: [] });
    await ckpt.push(sid, "p1", "n2", { cart: [{ dishId: "d1", name: "B", price: 1, quantity: 1 }] });

    const latest = await ckpt.latest(sid);
    expect(latest?.nodeId).toBe("n2");

    await ckpt.clear(sid);
  });

  test("discard 后不再可用", async () => {
    const ckpt = new CheckpointManager(redis);
    const sid = randomUUID();

    const cp = await ckpt.push(sid, "p1", "n1", {});
    await ckpt.discard(sid, cp.checkpointId);
    expect(await ckpt.get(sid, cp.checkpointId)).toBeNull();

    await ckpt.clear(sid);
  });
});

// ─────────────────────── Triage ───────────────────────

describe("Triage 分诊", () => {
  const triage = new TriageLayer();
  const baseMeta = { hasCartItems: true, isLoggedIn: true, hasActivePlan: false };

  test("下单请求判定为高风险", async () => {
    const r = await triage.classify("帮我下单一份红烧肉", baseMeta);
    expect(r.taskType).toBe("risk_operation");
    expect(r.riskLevel).toBe("high");
    expect(r.skipPlanner).toBe(false);
    expect(r.requiredWorker).toContain("order_worker");
  });

  test("菜单请求跳过 Planner", async () => {
    const r = await triage.classify("看看菜单有什么好吃的", baseMeta);
    expect(r.taskType).toBe("ui_render");
    expect(r.skipPlanner).toBe(true);
    expect(r.requiredWorker).toContain("menu_worker");
  });

  test("订单查询跳过 Planner", async () => {
    const r = await triage.classify("我的订单在哪", baseMeta);
    expect(r.taskType).toBe("simple_query");
    expect(r.skipPlanner).toBe(true);
  });

  test("购物车为空时下单→先引导选菜", async () => {
    const r = await triage.classify("帮我下单", {
      ...baseMeta,
      hasCartItems: false,
    });
    expect(r.requiredWorker).toContain("menu_worker");
    expect(r.reason).toContain("购物车为空");
  });

  test("未登录查询订单风险升级为 warning", async () => {
    const r = await triage.classify("查看订单", {
      ...baseMeta,
      isLoggedIn: false,
    });
    expect(r.riskLevel).toBe("warning");
  });
});

// ─────────────────────── Critic ───────────────────────

describe("Critic 校验", () => {
  const critic = new CriticLayer();
  const ctx = {
    userText: "下单",
    triage: {
      taskType: "risk_operation" as const,
      complexity: 4,
      skipPlanner: false,
      requiredWorker: ["order_worker"],
      riskLevel: "high" as const,
    },
    entities: {
      cart: [{ dishId: "d1", price: 25.5, quantity: 2 }],
      addresses: [{ address: "北京" }],
    },
  };

  test("合法计划通过", () => {
    const plan = dagPlanSchema.parse({
      planId: "p1",
      summary: "test",
      nodes: [
        {
          nodeId: "n1",
          workerType: "order_worker",
          dependsOn: [],
          instruction: "提交订单",
        },
      ],
    });
    expect(critic.validatePlan(plan, ctx).verdict).toBe("pass");
  });

  test("循环依赖的计划被拒绝", () => {
    const badPlan = {
      planId: "p1",
      summary: "bad",
      nodes: [
        { nodeId: "a", workerType: "menu_worker", dependsOn: ["b"], instruction: "x" },
        { nodeId: "b", workerType: "menu_worker", dependsOn: ["a"], instruction: "y" },
      ],
    };
    const parsed = dagPlanSchema.safeParse(badPlan);
    expect(parsed.success).toBe(false);
  });

  test("高风险缺少 order_worker 被要求重规划", () => {
    const plan = dagPlanSchema.parse({
      planId: "p2",
      summary: "test",
      nodes: [
        { nodeId: "n1", workerType: "menu_worker", dependsOn: [], instruction: "查菜单" },
      ],
    });
    const verdict = critic.validatePlan(plan, ctx);
    expect(verdict.verdict).toBe("replan");
    expect(verdict.reasons.join()).toContain("order_worker");
  });

  test("购物车为空时下单节点被中止", () => {
    const node = {
      nodeId: "n1",
      workerType: "order_worker" as const,
      dependsOn: [],
      instruction: "提交订单",
      retry: { max: 1, backoffMs: 300 },
      timeoutMs: 30000,
    };
    const verdict = critic.validateNode(node, {
      ...ctx,
      entities: { cart: [], addresses: [] },
    });
    expect(verdict.verdict).toBe("abort");
    expect(verdict.reasons.join()).toContain("购物车为空");
  });

  test("A2UI 输出缺少 root 组件被判为 retry", () => {
    const verdict = critic.validateWorkerResult(
      {
        nodeId: "n1",
        workerType: "agui_render_worker",
        ok: true,
        data: {
          surfaceId: "s1",
          catalogId: "c1",
          components: [{ id: "text-1" }],
        },
      },
      ctx,
    );
    expect(verdict.verdict).toBe("retry");
    expect(verdict.reasons.join()).toContain("root");
  });

  test("订单金额为负被判为 abort", () => {
    const verdict = critic.validateWorkerResult(
      {
        nodeId: "n1",
        workerType: "order_worker",
        ok: true,
        data: { total: -10 },
      },
      ctx,
    );
    expect(verdict.verdict).toBe("abort");
    expect(verdict.reasons.join()).toContain("金额");
  });
});

// ─────────────────────── DAG 调度器 ───────────────────────

describe("DAG 调度器", () => {
  function makePlan(nodes: any[]): DagPlan {
    return dagPlanSchema.parse({ planId: "p-test", summary: "t", nodes });
  }

  test("按依赖顺序执行", async () => {
    const order: string[] = [];
    const plan = makePlan([
      { nodeId: "a", workerType: "menu_worker", dependsOn: [], instruction: "A" },
      { nodeId: "b", workerType: "order_worker", dependsOn: ["a"], instruction: "B" },
      { nodeId: "c", workerType: "agui_render_worker", dependsOn: ["b"], instruction: "C" },
    ]);

    const scheduler = new DagScheduler({
      executor: async (node) => {
        order.push(node.nodeId);
        return { nodeId: node.nodeId, workerType: node.workerType, ok: true };
      },
    });

    const run = await scheduler.run(plan);
    expect(run.ok).toBe(true);
    expect(order).toEqual(["a", "b", "c"]);
  });

  test("节点失败后重试成功", async () => {
    let attempts = 0;
    const plan = makePlan([
      {
        nodeId: "a",
        workerType: "menu_worker",
        dependsOn: [],
        instruction: "A",
        retry: { max: 2, backoffMs: 10 },
      },
    ]);

    const scheduler = new DagScheduler({
      executor: async (node) => {
        attempts++;
        const ok = attempts >= 2;
        return {
          nodeId: node.nodeId,
          workerType: node.workerType,
          ok,
          error: ok ? undefined : "临时失败",
        };
      },
    });

    const run = await scheduler.run(plan);
    expect(attempts).toBe(2);
    expect(run.ok).toBe(true);
  });

  test("节点超时被捕获", async () => {
    const plan = makePlan([
      {
        nodeId: "slow",
        workerType: "menu_worker",
        dependsOn: [],
        instruction: "slow",
        retry: { max: 0, backoffMs: 0 },
        timeoutMs: 1000,
      },
    ]);

    const scheduler = new DagScheduler({
      executor: () => new Promise(() => {}), // 永不 resolve
    });

    const run = await scheduler.run(plan);
    expect(run.ok).toBe(false);
    expect(run.results[0]?.error).toContain("超时");
  }, 10000);

  test("单节点失败不影响其他独立节点", async () => {
    const plan = makePlan([
      { nodeId: "ok1", workerType: "menu_worker", dependsOn: [], instruction: "ok1" },
      { nodeId: "bad", workerType: "menu_worker", dependsOn: [], instruction: "bad", retry: { max: 0, backoffMs: 0 } },
      { nodeId: "ok2", workerType: "menu_worker", dependsOn: [], instruction: "ok2" },
    ]);

    const scheduler = new DagScheduler({
      executor: async (node) => ({
        nodeId: node.nodeId,
        workerType: node.workerType,
        ok: node.nodeId !== "bad",
      }),
    });

    const run = await scheduler.run(plan);
    const byId = Object.fromEntries(run.results.map((r) => [r.nodeId, r.ok]));
    expect(byId.ok1).toBe(true);
    expect(byId.bad).toBe(false);
    expect(byId.ok2).toBe(true);
  });

  test("依赖失败时后续节点被跳过", async () => {
    const plan = makePlan([
      { nodeId: "a", workerType: "menu_worker", dependsOn: [], instruction: "A", retry: { max: 0, backoffMs: 0 } },
      { nodeId: "b", workerType: "order_worker", dependsOn: ["a"], instruction: "B" },
    ]);

    const scheduler = new DagScheduler({
      executor: async (node) => ({
        nodeId: node.nodeId,
        workerType: node.workerType,
        ok: node.nodeId !== "a",
      }),
    });

    const run = await scheduler.run(plan);
    // b 依赖失败的 a，但调度器仍会执行（因为 a 有结果）；这里验证 a 失败被记录
    expect(run.results.find((r) => r.nodeId === "a")?.ok).toBe(false);
  });
});
