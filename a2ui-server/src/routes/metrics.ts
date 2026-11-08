import { Elysia } from "elysia";
import { getCurrentRuntime, EngineEvaluator } from "@a2ui/agent";

/**
 * 引擎可观测与运维端点
 *
 * GET    /metrics              聚合指标
 * GET    /metrics/sessions/:id 会话四分区内容
 * GET    /metrics/dag/:sid      DAG 执行日志（V1.2）
 * GET    /metrics/eval          评测集结果（V1.1）
 * GET    /metrics/degrade       降级状态（V1.2）
 * POST   /metrics/degrade       手动降级/恢复
 * GET    /metrics/rollout       灰度配置（V1.2）
 * PUT    /metrics/rollout       调整灰度比例
 */
export const metricsRoutes = new Elysia({ name: "metrics-routes", prefix: "/metrics" })
  .get("/", async ({ status }) => {
    const runtime = getCurrentRuntime();
    if (!runtime) return status(503, { error: "engine not initialized" });

    const snapshot = await runtime.telemetry.snapshot();
    const semanticHits = await runtime.semanticCache.getHitCount();

    return {
      ...snapshot,
      semanticCacheHits: semanticHits,
      degraded: runtime.degrade.isDegraded,
      redis: runtime.redis.isHealthy ? "connected" : "memory-fallback",
      recentRuns: runtime.telemetry.getRecentRuns().slice(-10),
    };
  })

  .get("/sessions/:id", async ({ params, status }) => {
    const runtime = getCurrentRuntime();
    if (!runtime) return status(503, { error: "engine not initialized" });

    const meta = await runtime.session.getMeta(params.id);
    if (!meta) return status(404, { error: "session not found" });

    const [workingMemory, entities, trace] = await Promise.all([
      runtime.session.getWorkingMemory(params.id),
      runtime.session.getEntities(params.id),
      runtime.session.getTrace(params.id),
    ]);

    return {
      meta,
      workingMemory: {
        summary: workingMemory.summary,
        recentCount: workingMemory.recent.length,
        facts: workingMemory.facts,
      },
      entities,
      trace: trace.slice(-20),
    };
  })

  .delete("/sessions/:id", async ({ params }) => {
    const runtime = getCurrentRuntime();
    if (!runtime) return { ok: false };

    await runtime.session.destroy(params.id);
    await runtime.checkpoint.clear(params.id);
    await runtime.dagLogger.clear(params.id);
    return { ok: true };
  })

  // ── V1.2 DAG 执行日志 ──
  .get("/dag/:sessionId", async ({ params, query, status }) => {
    const runtime = getCurrentRuntime();
    if (!runtime) return status(503, { error: "engine not initialized" });

    const limit = Number(query.limit ?? 20);
    const logs = await runtime.dagLogger.listBySession(params.sessionId, limit);
    return { count: logs.length, logs };
  })

  // ── V1.1 评测集 ──
  .get("/eval", async ({ status }) => {
    const runtime = getCurrentRuntime();
    if (!runtime) return status(503, { error: "engine not initialized" });

    const evaluator = new EngineEvaluator();
    const result = await evaluator.runAll(runtime.redis);
    return {
      overall: { score: result.overall.score, passed: result.overall.passed, total: result.overall.total },
      triage: result.triage,
      critic: result.critic,
      dag: result.dag,
      semantic: result.semantic,
    };
  })

  // ── V1.2 降级状态 ──
  .get("/degrade", async ({ status }) => {
    const runtime = getCurrentRuntime();
    if (!runtime) return status(503, { error: "engine not initialized" });
    return runtime.degrade.getState();
  })

  .post("/degrade", async ({ body, status }) => {
    const runtime = getCurrentRuntime();
    if (!runtime) return status(503, { error: "engine not initialized" });

    const degraded = Boolean((body as { degraded?: boolean })?.degraded);
    runtime.degrade.manual(degraded);
    return runtime.degrade.getState();
  })

  // ── V1.2 灰度配置 ──
  .get("/rollout", async ({ status }) => {
    const runtime = getCurrentRuntime();
    if (!runtime) return status(503, { error: "engine not initialized" });
    return runtime.rollout.load("engine-v1");
  })

  .put("/rollout", async ({ body, status }) => {
    const runtime = getCurrentRuntime();
    if (!runtime) return status(503, { error: "engine not initialized" });

    const { percentage, allowList, denyList } = (body ?? {}) as {
      percentage?: number;
      allowList?: string[];
      denyList?: string[];
    };

    const next = {
      percentage: Math.max(0, Math.min(100, Number(percentage ?? 0))),
      allowList,
      denyList,
    };
    await runtime.rollout.save("engine-v1", next);
    return next;
  })

  // ── DAG 模式开关 ──
  .get("/dag-mode", async () => {
    const runtime = getCurrentRuntime();
    if (!runtime) return { enabled: false };
    const flag = await runtime.redis.getString("engine:dag_mode");
    return { enabled: flag === "1" || flag === "true" };
  })

  .put("/dag-mode", async ({ body, status }) => {
    const runtime = getCurrentRuntime();
    if (!runtime) return status(503, { error: "engine not initialized" });

    const enabled = Boolean((body as { enabled?: boolean })?.enabled);
    await runtime.redis.setString("engine:dag_mode", enabled ? "1" : "0");
    console.log(`[metrics] DAG 模式已${enabled ? "开启" : "关闭"}`);
    return { enabled };
  });
