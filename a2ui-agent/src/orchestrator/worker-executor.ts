/**
 * Worker 执行器工厂（DAG 化）
 *
 * 把现有能力包装成 DAG 节点执行器：
 *   - 业务工具节点：通过 McpGateway 调用（带 L2 缓存）
 *   - agui_render_worker：调用次级 LLM 生成 A2UI
 *
 * 设计原则：
 *   - 不改变各能力的内部实现，只做「适配」
 *   - 节点输出统一为 WorkerResult，便于 Critic 校验与日志
 */

import type { LanguageModel } from "ai";
import type { ToolSet } from "ai";

import type { NodeExecutor } from "../orchestrator/dag-scheduler.js";
import type { DagNode, WorkerResult } from "../orchestrator/schemas.js";
import type { McpGateway } from "../gateway/mcp-gateway.js";
import type { SessionManager, EntityStore } from "../session/session-manager.js";
import { generateA2UIComponents } from "../tools/generate-a2ui.js";
import type { ModelMessage } from "ai";

export interface WorkerFactoryDeps {
  gateway: McpGateway;
  session: SessionManager;
  model: LanguageModel;
  appType: string;
  sessionId: string;
  messages: ModelMessage[];
  /** 已收集的业务工具结果（供 UI 生成使用） */
  toolResults: Array<{ toolCallId: string; toolName: string; output: unknown }>;
  sessionCache?: Map<string, any>;
}

/** workerType → 该 Worker 负责的工具有序列表 */
export const WORKER_TOOL_PLAN: Record<string, string[]> = {
  menu_worker: ["query_menu"],
  order_worker: ["get_orders"],
  address_worker: ["get_user_addresses"],
  cart_worker: [],
  agui_render_worker: [],
};

/**
 * 从并行依赖节点的结果中收集工具数据
 *
 * 每个业务节点把自己的工具输出放在 result.data 里，
 * 同时记录了 toolName，以便渲染节点知道数据来源。
 */
function collectFromDeps(
  deps: WorkerFactoryDeps,
  depResults: WorkerResult[],
): Array<{ toolCallId: string; toolName: string; output: unknown }> {
  const collected: Array<{ toolCallId: string; toolName: string; output: unknown }> = [];

  for (const r of depResults) {
    if (!r.ok) continue;
    const meta = r as WorkerResult & { toolName?: string };
    const toolName = meta.toolName ?? WORKER_TOOL_PLAN[r.workerType]?.[0];
    if (!toolName) continue;

    collected.push({
      toolCallId: `dag-${r.nodeId}-${toolName}`,
      toolName,
      output: r.data,
    });
  }

  return collected;
}

/** 根据用户文本挑选 menu_worker 该调哪个工具 */
function pickMenuTool(userText: string): { tool: string; args: Record<string, unknown> } {
  const detailLike = /介绍|详情|是什么|多少钱|好吃吗|怎么样/.test(userText);

  if (detailLike) {
    // 尝试从文本中提取菜品名（取「介绍下X」「X是什么」中的 X）
    const m = userText.match(/(?:介绍(?:一下|下)?|看看|查询|搜索)\s*([^\s，。！？,]{2,20})/);
    const dishName = m?.[1];
    if (dishName) return { tool: "search_dish", args: { dishName } };
  }

  return { tool: "query_menu", args: {} };
}

/**
 * 创建 DAG 节点执行器
 */
export function createWorkerExecutor(deps: WorkerFactoryDeps): NodeExecutor {
  return async (node: DagNode, depResults: WorkerResult[]): Promise<WorkerResult> => {
    const startedAt = Date.now();

    try {
      // ── AGUI 渲染节点 ──
      if (node.workerType === "agui_render_worker") {
        // 并行场景下不能用共享数组的「先到先得」顺序，
        // 改为从依赖节点的结果中稳定收集，保证输出可复现。
        const collected = collectFromDeps(deps, depResults);
        const renderToolResults = collected.length > 0 ? collected : deps.toolResults;

        const scenario = inferScenario(
          renderToolResults.map((t) => t.toolName),
          node.instruction,
        );

        if (!scenario) {
          return {
            nodeId: node.nodeId,
            workerType: node.workerType,
            ok: false,
            error: "无法推断 A2UI 场景",
            durationMs: Date.now() - startedAt,
          };
        }

        const result = await generateA2UIComponents({
          model: deps.model,
          messages: deps.messages,
          appType: deps.appType,
          scenario: scenario as any,
          toolResults: renderToolResults,
          sessionCache: deps.sessionCache,
        });

        return {
          nodeId: node.nodeId,
          workerType: node.workerType,
          ok: true,
          data: {
            surfaceId: result.surfaceId,
            catalogId: result.catalogId,
            components: result.components,
            data: result.data,
          },
          durationMs: Date.now() - startedAt,
        };
      }

      // ── 业务工具节点 ──
      const toolPlan = WORKER_TOOL_PLAN[node.workerType] ?? [];
      if (toolPlan.length === 0) {
        return {
          nodeId: node.nodeId,
          workerType: node.workerType,
          ok: true,
          data: {},
          durationMs: Date.now() - startedAt,
        };
      }

      let lastData: unknown = undefined;
      let lastToolName: string | undefined;

      for (const tool of toolPlan) {
        const { tool: actualTool, args } =
          tool === "query_menu" ? pickMenuTool(node.instruction) : { tool, args: {} };

        const invocation = await deps.gateway.invoke({
          toolName: actualTool,
          args,
          sessionId: deps.sessionId,
          workerType: node.workerType,
        });

        if (!invocation.ok) {
          return {
            nodeId: node.nodeId,
            workerType: node.workerType,
            ok: false,
            error: invocation.error,
            durationMs: Date.now() - startedAt,
          };
        }

        lastData = invocation.data;
        lastToolName = actualTool;
        deps.toolResults.push({
          toolCallId: `dag-${node.nodeId}-${actualTool}`,
          toolName: actualTool,
          output: invocation.data,
        });
      }

      return {
        nodeId: node.nodeId,
        workerType: node.workerType,
        ok: true,
        data: lastData,
        durationMs: Date.now() - startedAt,
        // 记录实际调用的工具名，供并行汇合时识别数据来源
        ...(lastToolName ? { toolName: lastToolName } : {}),
      } as WorkerResult;
    } catch (err) {
      return {
        nodeId: node.nodeId,
        workerType: node.workerType,
        ok: false,
        error: (err as Error).message,
        durationMs: Date.now() - startedAt,
      };
    }
  };
}

/** 推断 A2UI 场景 */
function inferScenario(
  toolNames: string[],
  instruction: string,
): "menu" | "dish_detail" | "orders" | "order_detail" | "place_order" | null {
  const set = new Set(toolNames);

  if (set.has("place_order")) return "place_order";
  if (set.has("get_order_detail")) return "order_detail";
  if (set.has("get_orders")) return "orders";
  if (set.has("search_dish") || set.has("get_dish_detail")) return "dish_detail";
  if (set.has("query_menu")) {
    if (/介绍|详情|是什么|多少钱/.test(instruction)) return "dish_detail";
    return "menu";
  }
  return null;
}

/** 把 Config 中的工具集合转为 gateway 可用的形式 */
export function registerToolsToGateway(gateway: McpGateway, tools: ToolSet): void {
  gateway.registerTools(tools);
}
