/**
 * 编排桥接层
 *
 * 目标：在不替换「主 LLM + 次级 LLM」双模型流的前提下，
 * 让 V1.0/V1.1/V1.2 的编排能力真正参与生产路径。
 *
 * 接管范围（渐进）：
 *   1. Triage 取代硬编码的 classifyUserIntent
 *   2. Critic 对最终 A2UI 输出做后置校验
 *   3. Checkpoint 记录实体状态，失败可回滚
 *   4. 降级 / 灰度 / 语义缓存 / DAG 日志
 *
 * 不接管：LLM 与 MCP 的实际调用（保持原实现，确保输出等价）
 */

import type { TriageResult } from "../orchestrator/schemas.js";
import type { TriageMeta } from "../orchestrator/triage.js";
import type { EngineRuntime } from "../runtime.js";
import type { WorkerResult } from "../orchestrator/schemas.js";

/** 旧意图 → Triage 结果映射，保证向后兼容 */
export type LegacyIntent = "menu" | "order" | "checkout" | "general";

export interface OrchestrationPlan {
  /** 是否启用编排（灰度决定） */
  enabled: boolean;
  /** Triage 结果（未启用时为 null，调用方回退旧逻辑） */
  triage: TriageResult | null;
  /** 建议的 activeTools（未启用时为 null） */
  activeTools: string[] | null;
  /** 是否处于降级模式 */
  degraded: boolean;
  /** 语义缓存命中时的直接结果 */
  cachedResults?: WorkerResult[];
  /** 语义缓存命中信息 */
  semanticHit?: { similarity: number; matchedQuery: string };
  /** 执行 ID，用于日志关联 */
  traceId: string;
}

export interface OrchestrationContext {
  runtime: EngineRuntime;
  sessionId: string;
  userId?: string;
  domain?: string;
  userText: string;
  meta: TriageMeta;
}

/** Triage 的 worker 列表 → 旧版 activeTools 名称
 *
 * 必须与 `getActiveToolsForIntent` 的旧集合保持一致：
 * 工具越多，LLM 越容易在多个相近工具间犹豫，反而降低调用率。
 */
const WORKER_TO_TOOLS: Record<string, string[]> = {
  menu_worker: ["query_menu", "search_dish"],
  order_worker: ["get_orders", "get_order_detail", "update_order_status", "cancel_order"],
  address_worker: ["get_user_addresses"],
  cart_worker: [],
  agui_render_worker: ["generate_a2ui"],
};

/** 把 Triage 结果转成 Elysia/LLM 所需的 activeTools 列表 */
export function triageToActiveTools(
  triage: TriageResult,
  allToolNames: string[],
): string[] {
  const wanted = new Set<string>(["generate_a2ui"]);

  for (const worker of triage.requiredWorker) {
    for (const tool of WORKER_TO_TOOLS[worker] ?? []) {
      wanted.add(tool);
    }
  }

  // 高风险操作额外放开地址与下单工具
  if (triage.riskLevel === "high") {
    wanted.add("get_user_addresses");
    wanted.add("place_order");
  }

  // 只保留实际存在的工具，避免 activeTools 含不存在的名字
  return [...wanted].filter((t) => allToolNames.includes(t));
}

/** 旧意图分类映射到 Triage 结果（降级路径使用） */
export function legacyIntentToTriage(intent: LegacyIntent): TriageResult {
  switch (intent) {
    case "menu":
      return {
        taskType: "ui_render",
        complexity: 2,
        skipPlanner: true,
        requiredWorker: ["menu_worker", "agui_render_worker"],
        riskLevel: "safe",
        reason: "旧版意图分类：menu",
      };
    case "order":
      return {
        taskType: "simple_query",
        complexity: 2,
        skipPlanner: true,
        requiredWorker: ["order_worker", "agui_render_worker"],
        riskLevel: "safe",
        reason: "旧版意图分类：order",
      };
    case "checkout":
      return {
        taskType: "risk_operation",
        complexity: 4,
        skipPlanner: false,
        requiredWorker: ["menu_worker", "order_worker", "agui_render_worker"],
        riskLevel: "high",
        reason: "旧版意图分类：checkout",
      };
    default:
      return {
        taskType: "multi_step_tool",
        complexity: 3,
        skipPlanner: false,
        requiredWorker: ["menu_worker", "agui_render_worker"],
        riskLevel: "safe",
        reason: "旧版意图分类：general",
      };
  }
}

/**
 * 执行编排前置阶段
 *
 * 返回 plan；调用方据此决定走新逻辑还是回退。
 */
export async function prepareOrchestration(
  ctx: OrchestrationContext,
): Promise<OrchestrationPlan> {
  const { runtime, sessionId, userId, userText, meta } = ctx;
  const traceId = `orch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // 1. 灰度判定（每次从 Redis 读取，支持运行期调整）
  const enabled = await runtime.rollout.load("engine-v1").then((c) => {
    if (!userId) return false;
    if (c.allowList?.includes(userId)) return true;
    if (c.denyList?.includes(userId)) return false;
    return runtime.rollout.isEnabled(userId);
  });

  // 2. 降级状态
  const degraded = runtime.degrade.isDegraded;

  if (!enabled) {
    return { enabled: false, triage: null, activeTools: null, degraded, traceId };
  }

  // 3. Triage（动态导入避免循环依赖）
  const { TriageLayer } = await import("../orchestrator/triage.js");
  const triageLayer = new TriageLayer();
  const triage = await triageLayer.classify(userText, meta);

  // 4. 语义缓存（仅只读安全查询）
  const { isSemanticCacheEligible } = await import("../cache/semantic-cache.js");
  const domain = ctx.domain ?? "food";

  if (
    triage.skipPlanner &&
    triage.riskLevel === "safe" &&
    isSemanticCacheEligible(userText)
  ) {
    const hit = await runtime.semanticCache.get<WorkerResult[]>(
      userText,
      domain,
      userId,
    );
    if (hit) {
      console.log(
        `[orchestration] 语义缓存命中 sim=${hit.similarity} "${hit.matchedQuery}"`,
      );
      return {
        enabled: true,
        triage,
        activeTools: null,
        degraded,
        cachedResults: hit.value,
        semanticHit: { similarity: hit.similarity, matchedQuery: hit.matchedQuery },
        traceId,
      };
    }
  }

  // 5. 记录到会话轨迹
  await runtime.session.appendTrace(sessionId, {
    at: Date.now(),
    stage: "triage",
    input: userText,
    output: triage,
  });

  return {
    enabled: true,
    triage,
    activeTools: null,
    degraded,
    traceId,
  };
}

/**
 * 后置：校验并记录 A2UI 输出
 *
 * 在主流程拿到最终 A2UI 组件后调用。
 */
export async function finalizeOrchestration(params: {
  runtime: EngineRuntime;
  sessionId: string;
  userText: string;
  triage: TriageResult | null;
  a2ui: { surfaceId: string; catalogId: string; components: unknown[] } | null;
  durationMs: number;
  cacheHits: number;
  cacheMisses: number;
}): Promise<{ ok: boolean; reasons: string[] }> {
  const { runtime, sessionId, userText, triage, a2ui } = params;

  // 1. Critic 后置校验
  const { CriticLayer } = await import("../orchestrator/critic.js");
  const critic = new CriticLayer();

  const reasons: string[] = [];
  let ok = true;

  if (a2ui) {
    const verdict = critic.validateWorkerResult(
      {
        nodeId: "a2ui",
        workerType: "agui_render_worker",
        ok: true,
        data: a2ui,
      },
      {
        userText,
        triage: triage ?? legacyIntentToTriage("general"),
        entities: {},
      },
    );

    if (verdict.verdict !== "pass") {
      ok = false;
      reasons.push(...verdict.reasons);
      console.warn(`[orchestration] Critic 未通过: ${verdict.reasons.join("; ")}`);
      runtime.telemetry.recordCritic("a2ui", verdict);
    }
  }

  // 2. 成功/失败反馈到降级控制器
  if (ok) runtime.degrade.recordSuccess();
  else runtime.degrade.recordFailure("planner_error");

  // 3. 埋点
  runtime.telemetry.recordRun({
    sessionId,
    runId: `run-${Date.now()}`,
    taskType: triage?.taskType ?? "legacy",
    ok,
    totalMs: params.durationMs,
    llmTokens: 0,
    nodeCount: a2ui?.components.length ?? 0,
    cacheHits: params.cacheHits,
    cacheMisses: params.cacheMisses,
    at: Date.now(),
  });

  // 4. DAG 日志（单节点视图，便于与编排层统一观测）
  await runtime.dagLogger.record({
    sessionId,
    userText,
    triage: triage ? `${triage.taskType}/${triage.riskLevel}` : "legacy",
    plan: {
      planId: `inline-${Date.now()}`,
      summary: "双 LLM 内联执行",
      nodes: [
        {
          nodeId: "a2ui",
          workerType: "agui_render_worker",
          dependsOn: [],
          instruction: triage?.reason ?? "legacy path",
          retry: { max: 0, backoffMs: 0 },
          timeoutMs: 60000,
        },
      ],
    },
    results: [
      {
        nodeId: "a2ui",
        workerType: "agui_render_worker",
        ok,
        data: a2ui ?? undefined,
        durationMs: params.durationMs,
        error: reasons.join("; ") || undefined,
      },
    ],
    durationMs: params.durationMs,
    ok,
    waves: 1,
    maxConcurrency: 1,
    skipped: [],
  });

  return { ok, reasons };
}

/**
 * 读取 DAG 模式开关
 *
 * 默认 **开启**（V1.2 起为默认路径）：调度器强制保证 UI 渲染节点执行，
 * 比双 LLM 直连更稳定。
 *
 * Redis 中显式写入 "0" 可关闭并回退双 LLM 直连。
 */
export async function isDagModeEnabled(runtime: EngineRuntime): Promise<boolean> {
  const flag = await runtime.redis.getString("engine:dag_mode");
  if (flag === null || flag === undefined || flag === "") return true;
  return flag === "1" || flag === "true";
}

export async function setDagMode(runtime: EngineRuntime, enabled: boolean): Promise<void> {
  await runtime.redis.setString("engine:dag_mode", enabled ? "1" : "0");
}

/**
 * 用 DAG 方式执行一轮请求
 *
 * 构造线性依赖链：业务 Worker → agui_render_worker
 * 由调度器保证 UI 节点一定执行。
 */
export async function runViaDag(params: {
  runtime: EngineRuntime;
  sessionId: string;
  userText: string;
  triage: TriageResult;
  model: any;
  messages: any[];
  appType: string;
  sessionCache?: Map<string, any>;
  toolResults: Array<{ toolCallId: string; toolName: string; output: unknown }>;
  gateway: any;
  maxConcurrency?: number;
}): Promise<{
  ok: boolean;
  a2ui: { surfaceId: string; catalogId: string; components: any[]; data?: any } | null;
  results: WorkerResult[];
  durationMs: number;
}> {
  const { DagScheduler } = await import("./dag-scheduler.js");
  const { CriticLayer } = await import("./critic.js");
  const { createWorkerExecutor } = await import("./worker-executor.js");
  const { dagPlanSchema } = await import("./schemas.js");

  const workerTypes = params.triage.requiredWorker.filter(
    (w) => w !== "agui_render_worker",
  );

  // ── 菱形 DAG：业务 Worker 全部并行 → 渲染节点等待全部 ──
  //
  //   [menu_worker] ─┐
  //   [order_worker] ─┼─→ [agui_render_worker]
  //   [addr_worker]  ─┘
  //
  // 业务 Worker 之间无依赖，可并发；渲染节点必须等全部完成
  // 才能拿到完整数据，因此 dependsOn 指向所有业务节点。
  const dataNodes = workerTypes.map((workerType, idx) => ({
    nodeId: `w${idx + 1}-${workerType}`,
    workerType,
    dependsOn: [] as string[],
    instruction: params.userText,
    retry: { max: 0, backoffMs: 200 },
    timeoutMs: 30_000,
  }));

  const renderNodeId = `r-${dataNodes.length + 1}-agui_render_worker`;
  const renderNode = {
    nodeId: renderNodeId,
    workerType: "agui_render_worker" as const,
    dependsOn: dataNodes.map((n) => n.nodeId),
    instruction: params.userText,
    retry: { max: 0, backoffMs: 200 },
    timeoutMs: 90_000,
  };

  const nodes = [...dataNodes, renderNode];

  const plan = dagPlanSchema.parse({
    planId: `dag-${Date.now()}`,
    summary: `${params.triage.taskType}: ${params.userText.slice(0, 40)}`,
    nodes,
  });

  const executor = createWorkerExecutor({
    gateway: params.gateway,
    session: params.runtime.session,
    model: params.model,
    appType: params.appType,
    sessionId: params.sessionId,
    messages: params.messages,
    toolResults: params.toolResults,
    sessionCache: params.sessionCache,
  });

  const scheduler = new DagScheduler({
    executor,
    critic: new CriticLayer(),
    criticContext: {
      userText: params.userText,
      triage: params.triage,
      entities: await params.runtime.session.getEntities(params.sessionId),
    },
    telemetry: params.runtime.telemetry,
    maxConcurrency: params.maxConcurrency ?? 4,
  });

  const run = await scheduler.run(plan);
  const renderResult = run.results.find((r) => r.workerType === "agui_render_worker");

  return {
    ok: run.ok,
    a2ui: (renderResult?.data as any) ?? null,
    results: run.results,
    durationMs: run.durationMs,
  };
}

export async function cacheIfEligible(params: {
  runtime: EngineRuntime;
  sessionId: string;
  userId?: string;
  domain?: string;
  userText: string;
  triage: TriageResult | null;
  a2ui: unknown;
}): Promise<void> {
  const { runtime, userText, triage, a2ui } = params;
  if (!triage || !a2ui) return;
  if (!triage.skipPlanner || triage.riskLevel !== "safe") return;

  const { isSemanticCacheEligible } = await import("../cache/semantic-cache.js");
  if (!isSemanticCacheEligible(userText)) return;

  await runtime.semanticCache.set(
    userText,
    params.domain ?? "food",
    params.userId,
    a2ui,
  );
}
