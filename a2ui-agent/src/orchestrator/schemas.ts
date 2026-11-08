/**
 * 编排层数据契约（全部 Zod 强约束）
 *
 * 四层：Triage → Planner → Worker → Critic
 * 每层输出都必须通过 Zod 校验，禁止自由文本进入下一层。
 */

import { z } from "zod";

// ─────────────────────── Triage 分诊层 ───────────────────────

export const taskTypeSchema = z.enum([
  "simple_query", // 简单查询（菜品介绍）
  "ui_render", // 静态 UI 渲染
  "multi_step_tool", // 多步骤工具调用
  "risk_operation", // 高风险（下单、支付）
]);

export const triageResultSchema = z.object({
  taskType: taskTypeSchema,
  /** 复杂度 1~5，决定是否走 Planner */
  complexity: z.number().int().min(1).max(5),
  /** 是否跳过 Planner 直接进 Worker */
  skipPlanner: z.boolean(),
  /** 需要的 Worker 类型 */
  requiredWorker: z.array(
    z.enum(["menu_worker", "order_worker", "address_worker", "cart_worker", "agui_render_worker"]),
  ),
  /** 风险级别，high 时强制 Critic 双重校验 */
  riskLevel: z.enum(["safe", "warning", "high"]),
  /** 分诊理由（用于 trace 与调试） */
  reason: z.string().optional(),
});

export type TriageResult = z.infer<typeof triageResultSchema>;

// ─────────────────────── Planner 规划层 ───────────────────────

export const workerTypeSchema = z.enum([
  "menu_worker",
  "order_worker",
  "address_worker",
  "cart_worker",
  "agui_render_worker",
]);

export const dagNodeSchema = z.object({
  nodeId: z.string().min(1),
  workerType: workerTypeSchema,
  /** 依赖的前置节点 ID，支持并行 */
  dependsOn: z.array(z.string()).default([]),
  /** 节点任务描述（给 Worker 的指令） */
  instruction: z.string().min(1),
  /** 重试策略 */
  retry: z
    .object({
      max: z.number().int().min(0).max(5).default(1),
      backoffMs: z.number().int().min(0).default(300),
    })
    .default({ max: 1, backoffMs: 300 }),
  /** 超时毫秒 */
  timeoutMs: z.number().int().min(1000).max(120000).default(30000),
});

export const dagPlanSchema = z
  .object({
    planId: z.string().min(1),
    /** 计划摘要，用于日志与缓存 */
    summary: z.string(),
    nodes: z.array(dagNodeSchema).min(1),
  })
  .superRefine((plan, ctx) => {
    const ids = new Set<string>();

    for (const node of plan.nodes) {
      if (ids.has(node.nodeId)) {
        ctx.addIssue({
          code: "custom",
          message: `节点 ID 重复: ${node.nodeId}`,
          path: ["nodes"],
        });
      }
      ids.add(node.nodeId);
    }

    // 依赖必须存在，且不允许自依赖
    for (const node of plan.nodes) {
      for (const dep of node.dependsOn) {
        if (dep === node.nodeId) {
          ctx.addIssue({
            code: "custom",
            message: `节点 ${node.nodeId} 不能依赖自身`,
            path: ["nodes"],
          });
        } else if (!ids.has(dep)) {
          ctx.addIssue({
            code: "custom",
            message: `节点 ${node.nodeId} 依赖了不存在的节点 ${dep}`,
            path: ["nodes"],
          });
        }
      }
    }

    // 环检测（DFS）
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const byId = new Map(plan.nodes.map((n) => [n.nodeId, n]));

    const visit = (id: string): boolean => {
      if (visiting.has(id)) return true; // 发现环
      if (visited.has(id)) return false;
      visiting.add(id);
      const node = byId.get(id);
      if (node) {
        for (const dep of node.dependsOn) {
          if (visit(dep)) return true;
        }
      }
      visiting.delete(id);
      visited.add(id);
      return false;
    };

    for (const node of plan.nodes) {
      if (visit(node.nodeId)) {
        ctx.addIssue({
          code: "custom",
          message: "DAG 中存在循环依赖",
          path: ["nodes"],
        });
        break;
      }
    }
  });

export type DagNode = z.infer<typeof dagNodeSchema>;
export type DagPlan = z.infer<typeof dagPlanSchema>;

// ─────────────────────── Worker 执行层 ───────────────────────

export const workerResultSchema = z.object({
  nodeId: z.string(),
  workerType: workerTypeSchema,
  ok: z.boolean(),
  /** 结构化输出，由各 Worker 自定义 Schema 进一步校验 */
  data: z.unknown().optional(),
  /** 给上层的中文说明 */
  message: z.string().optional(),
  /** 执行耗时 */
  durationMs: z.number().optional(),
  /** 消耗 token 估算 */
  tokens: z.number().optional(),
  /** 实际调用的工具名（并行汇合时用于识别数据来源） */
  toolName: z.string().optional(),
  error: z.string().optional(),
});

export type WorkerResult = z.infer<typeof workerResultSchema>;

// ─────────────────────── Critic 校验层 ───────────────────────

export const criticVerdictSchema = z.object({
  verdict: z.enum(["pass", "retry", "replan", "abort"]),
  /** 校验意见 */
  reasons: z.array(z.string()).default([]),
  /** 需要重试的节点 */
  retryNodeId: z.string().optional(),
});

export type CriticVerdict = z.infer<typeof criticVerdictSchema>;

// ─────────────────────── A2UI 输出校验 ───────────────────────

export const a2uiOperationSchema = z.record(z.string(), z.unknown());

export const a2uiOutputSchema = z.object({
  surfaceId: z.string().min(1),
  catalogId: z.string().min(1),
  components: z.array(
    z
      .object({
        id: z.string().min(1),
      })
      .passthrough(),
  ).min(1),
  data: z.unknown().optional(),
});

export type A2UIOutput = z.infer<typeof a2uiOutputSchema>;
