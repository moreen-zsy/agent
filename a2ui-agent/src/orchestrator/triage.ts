/**
 * Triage 分诊层
 *
 * 职责：把用户输入分流到不同处理路径，避免所有请求都走完整 Planner 流程。
 * 输出强约束的 TriageResult，后续层只认这个结构。
 *
 * 实现方式：规则优先（零成本、低延迟），规则无法判定时回退到默认值。
 * 方案文档提到「流量上来后可替换为小模型微调分类器」，这里预留了 llmClassifier 注入点。
 */

import { triageResultSchema, type TriageResult } from "./schemas.js";

export type LLMClassifier = (
  userText: string,
  meta: TriageMeta,
) => Promise<TriageResult | null>;

export interface TriageMeta {
  /** 购物车是否非空 */
  hasCartItems: boolean;
  /** 是否已登录 */
  isLoggedIn: boolean;
  /** 会话是否已有进行中的计划 */
  hasActivePlan: boolean;
}

interface RuleMatch {
  keywords: string[];
  result: Partial<TriageResult> & { taskType: TriageResult["taskType"] };
}

/** 高风险操作：必须经过 Critic 双重校验 */
const RISK_RULES: RuleMatch[] = [
  {
    keywords: ["下单", "点一份", "帮我点", "结算", "付款", "支付", "确认订单", "提交订单"],
    result: {
      taskType: "risk_operation",
      complexity: 4,
      skipPlanner: false,
      requiredWorker: ["cart_worker", "order_worker", "agui_render_worker"],
      riskLevel: "high",
      reason: "涉及下单/支付，属高风险操作",
    },
  },
];

/** 多步骤任务：需要 Planner 编排 */
const MULTI_STEP_RULES: RuleMatch[] = [
  {
    keywords: ["改地址", "换地址", "修改地址", "再加一份", "再来一份", "取消订单", "改订单"],
    result: {
      taskType: "multi_step_tool",
      complexity: 3,
      skipPlanner: false,
      requiredWorker: ["address_worker", "cart_worker", "order_worker", "agui_render_worker"],
      riskLevel: "warning",
      reason: "涉及多步骤状态变更",
    },
  },
];

/** 简单查询：跳过 Planner */
const SIMPLE_RULES: RuleMatch[] = [
  {
    keywords: ["我的订单", "历史订单", "订单列表", "订单详情", "订单状态", "查看订单"],
    result: {
      taskType: "simple_query",
      complexity: 2,
      skipPlanner: true,
      requiredWorker: ["order_worker", "agui_render_worker"],
      riskLevel: "safe",
      reason: "只读订单查询",
    },
  },
  {
    keywords: ["菜单", "有什么吃", "吃什么", "推荐", "招牌", "热销", "菜品"],
    result: {
      taskType: "ui_render",
      complexity: 2,
      skipPlanner: true,
      requiredWorker: ["menu_worker", "agui_render_worker"],
      riskLevel: "safe",
      reason: "菜单浏览/渲染",
    },
  },
  {
    keywords: ["介绍", "详情", "是什么", "多少钱", "好吃吗"],
    result: {
      taskType: "simple_query",
      complexity: 2,
      skipPlanner: true,
      requiredWorker: ["menu_worker", "agui_render_worker"],
      riskLevel: "safe",
      reason: "菜品详情查询",
    },
  },
];

function match(rules: RuleMatch[], text: string): TriageResult | null {
  for (const rule of rules) {
    if (rule.keywords.some((k) => text.includes(k))) {
      return triageResultSchema.parse({
        taskType: rule.result.taskType,
        complexity: rule.result.complexity ?? 2,
        skipPlanner: rule.result.skipPlanner ?? false,
        requiredWorker: rule.result.requiredWorker ?? ["agui_render_worker"],
        riskLevel: rule.result.riskLevel ?? "safe",
        reason: rule.result.reason,
      });
    }
  }
  return null;
}

export class TriageLayer {
  constructor(private readonly llmClassifier?: LLMClassifier) {}

  /**
   * 分诊
   *
   * 优先级：高风险 → 多步骤 → 简单查询 → LLM 分类器 → 默认
   */
  async classify(userText: string, meta: TriageMeta): Promise<TriageResult> {
    const text = userText.toLowerCase();

    // 1. 规则匹配（快、免费、可解释）
    const risk = match(RISK_RULES, text);
    if (risk) return this.applyContext(risk, meta);

    const multi = match(MULTI_STEP_RULES, text);
    if (multi) return this.applyContext(multi, meta);

    const simple = match(SIMPLE_RULES, text);
    if (simple) return this.applyContext(simple, meta);

    // 2. 规则未命中时，可选走 LLM 分类器
    if (this.llmClassifier) {
      try {
        const llmResult = await this.llmClassifier(userText, meta);
        if (llmResult) {
          const parsed = triageResultSchema.safeParse(llmResult);
          if (parsed.success) return this.applyContext(parsed.data, meta);
        }
      } catch (err) {
        console.warn("[triage] LLM 分类器失败，回退默认:", (err as Error).message);
      }
    }

    // 3. 默认：交给 Planner 保守处理
    return triageResultSchema.parse({
      taskType: "multi_step_tool",
      complexity: 3,
      skipPlanner: false,
      requiredWorker: ["menu_worker", "agui_render_worker"],
      riskLevel: "safe",
      reason: "未命中规则，保守走 Planner",
    });
  }

  /** 结合会话上下文微调分诊结果 */
  private applyContext(result: TriageResult, meta: TriageMeta): TriageResult {
    // 购物车为空时做「下单」类操作，需要先引导加购
    if (result.taskType === "risk_operation" && !meta.hasCartItems) {
      return {
        ...result,
        complexity: Math.max(3, result.complexity),
        requiredWorker: ["menu_worker", "cart_worker", "agui_render_worker"],
        reason: `${result.reason}；但购物车为空，需先选菜`,
      };
    }

    // 未登录的操作订单，先提示登录
    if (result.requiredWorker.includes("order_worker") && !meta.isLoggedIn) {
      return {
        ...result,
        riskLevel: result.riskLevel === "safe" ? "warning" : result.riskLevel,
        reason: `${result.reason}；但用户未登录`,
      };
    }

    return result;
  }
}
