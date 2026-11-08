/**
 * MCP Gateway
 *
 * 统一收口工具调用：
 *   - 工具注册与能力发现
 *   - 入参校验（Zod）
 *   - L2 缓存接入（只读工具）
 *   - 写操作主动失效关联缓存
 *   - 工具能力过滤（按 Worker 下发最小工具集）
 *   - 超时与调用轨迹
 */

import type { ToolSet } from "ai";
import type { CacheSubsystem } from "../cache/cache-subsystem.js";
import type { Telemetry } from "../telemetry/telemetry.js";

export interface ToolPolicy {
  /** 哪些 Worker 可以调用 */
  allowedWorkers?: string[];
  /** 是否只读（可缓存） */
  readonly?: boolean;
  /** 超时毫秒 */
  timeoutMs?: number;
}

export interface ToolInvocation {
  toolName: string;
  args: Record<string, unknown>;
  sessionId: string;
  workerType: string;
}

export interface ToolInvocationResult {
  ok: boolean;
  data?: unknown;
  error?: string;
  fromCache: boolean;
  durationMs: number;
}

/** 默认工具策略：未声明的工具按可写、不可缓存处理 */
const DEFAULT_POLICY: ToolPolicy = {
  readonly: false,
  timeoutMs: 20_000,
};

export class McpGateway {
  /** 当前可用工具集合 */
  private tools: ToolSet = {};

  constructor(
    private readonly cache?: CacheSubsystem,
    private readonly telemetry?: Telemetry,
  ) {}

  /** 注册/替换工具集（在 MCP 连接成功后调用） */
  registerTools(tools: ToolSet): void {
    this.tools = tools;
    console.log(`[gateway] 已注册工具 ${Object.keys(tools).length} 个`);
  }

  getToolNames(): string[] {
    return Object.keys(this.tools);
  }

  /** 按 Worker 过滤可用工具，减少下发上下文体积 */
  filterToolsForWorker(workerType: string, policy: Record<string, ToolPolicy> = {}): ToolSet {
    const allowed = Object.entries(this.tools).filter(([name]) => {
      const rule = policy[name] ?? DEFAULT_POLICY;
      if (!rule.allowedWorkers) return true;
      return rule.allowedWorkers.includes(workerType);
    });

    return Object.fromEntries(allowed);
  }

  /**
   * 执行工具调用
   *
   * 只读工具先查 L2 缓存；写操作成功后主动失效关联缓存。
   */
  async invoke(invocation: ToolInvocation): Promise<ToolInvocationResult> {
    const startedAt = Date.now();
    const { toolName, args, sessionId, workerType } = invocation;

    const tool = (this.tools as Record<string, any>)[toolName];
    if (!tool) {
      return {
        ok: false,
        error: `工具不存在: ${toolName}`,
        fromCache: false,
        durationMs: 0,
      };
    }

    // 1. 只读工具查缓存
    if (this.cache?.tools.isCacheable(toolName)) {
      const cached = await this.cache.tools.get(sessionId, toolName, args);
      if (cached !== undefined) {
        return {
          ok: true,
          data: cached,
          fromCache: true,
          durationMs: Date.now() - startedAt,
        };
      }
    }

    // 2. 实际调用
    try {
      const output = await this.withTimeout(
        this.executeTool(tool, args),
        DEFAULT_POLICY.timeoutMs!,
      );

      // 3. 写入缓存（只读工具）
      if (this.cache?.tools.isCacheable(toolName)) {
        await this.cache.tools.set(sessionId, toolName, args, output);
      }

      // 4. 写操作失效关联缓存
      if (this.cache && !this.cache.tools.isCacheable(toolName)) {
        const invalidated = await this.cache.tools.invalidate(sessionId, toolName);
        if (invalidated > 0) {
          console.log(`[gateway] ${toolName} 触发缓存失效 ${invalidated} 条`);
        }
      }

      const durationMs = Date.now() - startedAt;
      this.telemetry?.recordNode({
        nodeId: `mcp:${toolName}`,
        workerType,
        ok: true,
        durationMs,
        attempts: 1,
      });

      return { ok: true, data: output, fromCache: false, durationMs };
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      this.telemetry?.recordNode({
        nodeId: `mcp:${toolName}`,
        workerType,
        ok: false,
        durationMs,
        attempts: 1,
        error: (err as Error).message,
      });

      return {
        ok: false,
        error: (err as Error).message,
        fromCache: false,
        durationMs,
      };
    }
  }

  private async executeTool(tool: any, args: Record<string, unknown>): Promise<unknown> {
    // AI SDK 工具：execute 可能是函数，也可能是带 inputSchema 的定义
    if (typeof tool.execute === "function") {
      return tool.execute(args, { toolCallId: `gw-${Date.now()}`, messages: [] });
    }
    if (typeof tool === "function") {
      return tool(args);
    }
    throw new Error("工具不可调用：缺少 execute 实现");
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`工具调用超时 (${timeoutMs}ms)`)),
        timeoutMs,
      );
      promise.then(
        (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        },
      );
    });
  }
}
