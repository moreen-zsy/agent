/**
 * Critic 反思 & 校验层
 *
 * 前置校验（Plan 生成后、执行前）：
 *   - DAG 结构合法性（由 schemas.ts 的 superRefine 完成）
 *   - 工具权限、参数范围
 *
 * 后置校验（Worker 执行后、推送前）：
 *   - A2UI 输出是否符合协议
 *   - 业务规则（订单金额、地址合法性）
 *   - 是否偏离用户意图
 *
 * 分支策略：pass / retry / replan / abort
 */

import {
  a2uiOutputSchema,
  criticVerdictSchema,
  dagPlanSchema,
  type CriticVerdict,
  type DagPlan,
  type TriageResult,
  type WorkerResult,
} from "./schemas.js";

export interface CriticContext {
  userText: string;
  triage: TriageResult;
  /** 实体状态快照，用于业务校验 */
  entities: {
    cart?: Array<{ dishId: string; price: number; quantity: number }>;
    addresses?: Array<{ address: string }>;
  };
}

export class CriticLayer {
  // ─────────────────── 前置校验 ───────────────────

  /** 校验 DAG 计划合法性 */
  validatePlan(plan: unknown, ctx: CriticContext): CriticVerdict {
    const parsed = dagPlanSchema.safeParse(plan);
    if (!parsed.success) {
      return criticVerdictSchema.parse({
        verdict: "replan",
        reasons: parsed.error.issues.map((i) => `计划校验失败: ${i.message} (${i.path.join(".")})`),
      });
    }

    const reasons: string[] = [];

    // 高风险任务必须包含 Critic 关注的下单节点
    if (ctx.triage.riskLevel === "high") {
      const hasOrderNode = parsed.data.nodes.some((n) => n.workerType === "order_worker");
      if (!hasOrderNode) {
        reasons.push("高风险任务缺少 order_worker 节点");
      }
    }

    // 节点数上限，防止 Planner 生成过大计划
    if (parsed.data.nodes.length > 8) {
      reasons.push(`计划节点数过多(${parsed.data.nodes.length})，超过上限 8`);
    }

    if (reasons.length > 0) {
      return criticVerdictSchema.parse({ verdict: "replan", reasons });
    }

    return criticVerdictSchema.parse({ verdict: "pass", reasons: ["计划结构合法"] });
  }

  /** 校验单个节点是否允许执行（权限、参数范围） */
  validateNode(node: DagPlan["nodes"][number], ctx: CriticContext): CriticVerdict {
    const reasons: string[] = [];

    // 下单节点必须满足业务前置条件
    if (node.workerType === "order_worker" && /下单|提交订单/i.test(node.instruction)) {
      if (!ctx.entities.cart || ctx.entities.cart.length === 0) {
        reasons.push("购物车为空，不能下单");
      }
    }

    // 涉及地址的操作必须有地址
    if (node.workerType === "address_worker" && /修改|设置默认/i.test(node.instruction)) {
      if (!ctx.entities.addresses || ctx.entities.addresses.length === 0) {
        reasons.push("用户没有可用地址");
      }
    }

    if (reasons.length > 0) {
      return criticVerdictSchema.parse({
        verdict: reasons.some((r) => r.includes("购物车为空")) ? "abort" : "retry",
        reasons,
        retryNodeId: node.nodeId,
      });
    }

    return criticVerdictSchema.parse({ verdict: "pass", reasons: [] });
  }

  // ─────────────────── 后置校验 ───────────────────

  /** 校验 Worker 输出 */
  validateWorkerResult(result: WorkerResult, ctx: CriticContext): CriticVerdict {
    const reasons: string[] = [];

    if (!result.ok) {
      return criticVerdictSchema.parse({
        verdict: "retry",
        reasons: [`节点 ${result.nodeId} 执行失败: ${result.error ?? "未知错误"}`],
        retryNodeId: result.nodeId,
      });
    }

    // AGUI 渲染节点的输出必须符合 A2UI 协议
    if (result.workerType === "agui_render_worker") {
      const parsed = a2uiOutputSchema.safeParse(result.data);
      if (!parsed.success) {
        reasons.push(
          `A2UI 输出不合规: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
        );
      } else {
        // 根组件必须是 root
        const hasRoot = parsed.data.components.some((c: any) => c.id === "root");
        if (!hasRoot) reasons.push("A2UI 输出缺少 id 为 root 的根组件");
      }
    }

    // 订单节点：金额必须为正
    if (result.workerType === "order_worker" && result.data) {
      const amount = this.extractTotal(result.data);
      if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
        reasons.push(`订单金额异常: ${amount}`);
      }
    }

    if (reasons.length === 0) {
      return criticVerdictSchema.parse({ verdict: "pass", reasons: [] });
    }

    // 协议不合规属于可重试问题；业务金额异常直接中止
    const isBusinessError = reasons.some((r) => r.includes("金额"));
    return criticVerdictSchema.parse({
      verdict: isBusinessError ? "abort" : "retry",
      reasons,
      retryNodeId: isBusinessError ? undefined : result.nodeId,
    });
  }

  /** 从各种可能的输出形态中提取订单金额 */
  private extractTotal(data: unknown): number | undefined {
    if (!data || typeof data !== "object") return undefined;
    const obj = data as Record<string, any>;
    const candidate =
      obj.total ??
      obj.order?.total ??
      obj.data?.total ??
      obj.data?.order?.total;
    if (candidate === undefined || candidate === null) return undefined;
    const n = Number(candidate);
    return Number.isFinite(n) ? n : undefined;
  }

  /** 后置：判断整体是否偏离用户意图（轻量规则，不调用 LLM） */
  checkIntentAlignment(results: WorkerResult[], ctx: CriticContext): CriticVerdict {
    const allFailed = results.length > 0 && results.every((r) => !r.ok);
    if (allFailed) {
      return criticVerdictSchema.parse({
        verdict: "abort",
        reasons: ["所有节点均执行失败，无法满足用户请求"],
      });
    }
    return criticVerdictSchema.parse({ verdict: "pass", reasons: [] });
  }
}
