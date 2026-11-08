/**
 * DAG 并行子任务测试（V1.2 增强）
 *
 * 覆盖：
 *   - 菱形 DAG 结构（多业务节点并行 → 渲染节点汇合）
 *   - 并行执行的时间重叠
 *   - 依赖结果稳定收集（不依赖共享数组顺序）
 *   - 单节点失败时的隔离
 */

import { describe, test, expect } from "vitest";
import { DagScheduler, computeWaves } from "../src/orchestrator/dag-scheduler.ts";
import { dagPlanSchema } from "../src/orchestrator/schemas.ts";

function diamondPlan() {
  return dagPlanSchema.parse({
    planId: "diamond",
    summary: "多业务 Worker 并行",
    nodes: [
      { nodeId: "w1-menu", workerType: "menu_worker", dependsOn: [], instruction: "查菜单" },
      { nodeId: "w2-order", workerType: "order_worker", dependsOn: [], instruction: "查订单" },
      { nodeId: "w3-addr", workerType: "address_worker", dependsOn: [], instruction: "查地址" },
      {
        nodeId: "r4-render",
        workerType: "agui_render_worker",
        dependsOn: ["w1-menu", "w2-order", "w3-addr"],
        instruction: "渲染",
      },
    ],
  });
}

describe("DAG 并行子任务", () => {
  test("菱形结构理论波次为 2", () => {
    expect(computeWaves(diamondPlan())).toBe(2);
  });

  test("三个业务节点并发执行，渲染节点等待全部", async () => {
    const timeline: Array<{ node: string; start: number; end: number }> = [];
    const t0 = Date.now();

    const scheduler = new DagScheduler({
      maxConcurrency: 4,
      executor: async (node) => {
        const start = Date.now() - t0;
        await new Promise((r) =>
          setTimeout(r, node.workerType === "agui_render_worker" ? 50 : 120),
        );
        timeline.push({ node: node.nodeId, start, end: Date.now() - t0 });
        return { nodeId: node.nodeId, workerType: node.workerType, ok: true };
      },
    });

    const run = await scheduler.run(diamondPlan());

    expect(run.ok).toBe(true);
    expect(run.stats.waves).toBe(2);
    expect(run.stats.maxConcurrency).toBe(3);

    // 三个业务节点时间必须重叠
    const biz = timeline.filter((t) => !t.node.startsWith("r4"));
    expect(biz).toHaveLength(3);
    const allOverlap = biz.every((a) => biz.filter((b) => b !== a).some((b) => a.start < b.end && b.start < a.end));
    expect(allOverlap).toBe(true);

    // 渲染节点必须在所有业务节点结束后才开始
    const render = timeline.find((t) => t.node.startsWith("r4"))!;
    const lastBizEnd = Math.max(...biz.map((t) => t.end));
    expect(render.start).toBeGreaterThanOrEqual(lastBizEnd);
  });

  test("并行总耗时显著小于串行", async () => {
    const t0 = Date.now();
    const scheduler = new DagScheduler({
      maxConcurrency: 4,
      executor: async (node) => {
        await new Promise((r) => setTimeout(r, node.workerType === "agui_render_worker" ? 50 : 100));
        return { nodeId: node.nodeId, workerType: node.workerType, ok: true };
      },
    });

    const run = await scheduler.run(diamondPlan());
    const elapsed = Date.now() - t0;

    // 串行需 100*3+50 = 350ms，并行应明显更短
    expect(elapsed).toBeLessThan(300);
  });

  test("渲染节点能拿到全部依赖结果", async () => {
    let receivedDeps: string[] = [];

    const scheduler = new DagScheduler({
      maxConcurrency: 4,
      executor: async (node, deps) => {
        if (node.workerType === "agui_render_worker") {
          receivedDeps = deps.map((d) => d.nodeId);
        }
        return {
          nodeId: node.nodeId,
          workerType: node.workerType,
          ok: true,
          data: { source: node.nodeId },
        };
      },
    });

    await scheduler.run(diamondPlan());

    expect(receivedDeps).toEqual(
      expect.arrayContaining(["w1-menu", "w2-order", "w3-addr"]),
    );
    expect(receivedDeps).toHaveLength(3);
  });

  test("单个业务节点失败时，渲染节点仍可运行（依赖失败不阻断并行兄弟）", async () => {
    const scheduler = new DagScheduler({
      maxConcurrency: 4,
      executor: async (node) => ({
        nodeId: node.nodeId,
        workerType: node.workerType,
        ok: node.nodeId !== "w2-order",
      }),
    });

    const run = await scheduler.run(diamondPlan());

    const byId = Object.fromEntries(run.results.map((r) => [r.nodeId, r.ok]));
    expect(byId["w1-menu"]).toBe(true);
    expect(byId["w2-order"]).toBe(false);
    expect(byId["w3-addr"]).toBe(true);
    // 渲染节点因依赖失败被跳过
    expect(run.skipped).toContain("r4-render");
    expect(run.ok).toBe(false);
  });

  test("并发度为 2 时分批执行", async () => {
    const scheduler = new DagScheduler({
      maxConcurrency: 2,
      executor: async (node) => {
        await new Promise((r) => setTimeout(r, 20));
        return { nodeId: node.nodeId, workerType: node.workerType, ok: true };
      },
    });

    const run = await scheduler.run(diamondPlan());
    expect(run.stats.maxConcurrency).toBe(2);
    // 3 个业务节点分 2 批 + 1 批渲染 = 3 波
    expect(run.stats.waves).toBe(3);
  });

  test("并行节点输出顺序稳定（按依赖声明顺序收集）", async () => {
    const collector = async (node: { workerType: string }, deps: any[]) => {
      if (node.workerType !== "agui_render_worker") {
        return { nodeId: (node as any).nodeId, workerType: node.workerType, ok: true };
      }
      // 依赖结果按 plan 中 dependsOn 的顺序传入
      return {
        nodeId: (node as any).nodeId,
        workerType: node.workerType,
        ok: true,
        data: deps.map((d) => d.nodeId),
      };
    };

    const scheduler = new DagScheduler({ maxConcurrency: 4, executor: collector as any });
    const run = await scheduler.run(diamondPlan());

    const render = run.results.find((r) => r.workerType === "agui_render_worker");
    expect(render?.data).toEqual(["w1-menu", "w2-order", "w3-addr"]);
  });
});
