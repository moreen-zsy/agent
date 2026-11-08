/**
 * 多级缓存子系统
 *
 * L1 Prompt 前缀缓存（KV 优化）：把固定前缀与动态内容拆分，提高服务商 KV 命中率
 * L2 MCP 工具调用缓存：只读工具结果，短 TTL，写操作主动失效
 * L4 Plan 模板缓存：相同意图 + 相同工具集复用 DAG
 *
 * L3 语义缓存需要向量库，属于 V1.1，此处留接口。
 */

import { RedisClient, getRedis } from "../session/redis-client.js";

// ─────────────────────── L1 Prompt 前缀 ───────────────────────

export interface PromptSegments {
  /** 固定不变的部分，必须排在最前 */
  staticPrefix: string;
  /** 动态部分（工作记忆、用户输入） */
  dynamicSuffix: string;
}

/**
 * Prompt 前缀管理器
 *
 * 目标：同一「协议版本 + prompt 版本」下，生成的前缀**字节级一致**，
 * 让服务商的 KV Cache 能复用 prefill 结果。
 *
 * 关键约束：
 * 1. 前缀内不允许出现时间戳、随机数、用户相关数据
 * 2. 版本号变化即视为新前缀（旧缓存自然失效）
 */
export class PromptPrefixManager {
  private readonly cache = new Map<string, string>();

  /**
   * 构造稳定前缀
   *
   * @param protocolVersion A2UI 协议版本
   * @param promptVersion   本引擎自己的 prompt 版本
   * @param parts           有序的固定片段（工具描述、Schema 等）
   */
  buildStaticPrefix(
    protocolVersion: string,
    promptVersion: string,
    parts: string[],
  ): string {
    const cacheKey = `${protocolVersion}|${promptVersion}|${parts.length}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    // 片段顺序固定，分隔符固定 → 输出稳定
    const prefix = [
      `<!-- A2UI_PROTOCOL=${protocolVersion} ENGINE_PROMPT=${promptVersion} -->`,
      ...parts,
    ].join("\n\n---\n\n");

    this.cache.set(cacheKey, prefix);
    return prefix;
  }

  /** 计算前缀的稳定哈希，用于缓存键与调试 */
  hashPrefix(prefix: string): string {
    let h = 0;
    for (let i = 0; i < prefix.length; i++) {
      h = (h * 31 + prefix.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(16);
  }

  /** 拼接完整 prompt */
  compose(segments: PromptSegments): string {
    return `${segments.staticPrefix}\n\n---\n\n${segments.dynamicSuffix}`;
  }
}

// ─────────────────────── L2 MCP 工具缓存 ───────────────────────

/** 只读工具才允许缓存 */
const READONLY_TOOLS = new Set([
  "query_menu",
  "search_dish",
  "get_dish_detail",
  "get_orders",
  "get_order_detail",
  "get_user_addresses",
  "query_facilities",
  "get_facility_detail",
  "get_reservations",
  "query_payments",
]);

/** 每个工具默认 TTL（秒） */
const TOOL_TTL: Record<string, number> = {
  query_menu: 300, // 菜单 5min
  search_dish: 300,
  get_dish_detail: 1800, // 菜品详情 30min
  get_orders: 30, // 订单变化快
  get_order_detail: 30,
  get_user_addresses: 300,
};

/** 写操作需要失效的缓存前缀 */
const INVALIDATION_MAP: Record<string, string[]> = {
  place_order: ["get_orders", "get_order_detail"],
  update_order_status: ["get_orders", "get_order_detail"],
  cancel_order: ["get_orders", "get_order_detail"],
  update_dish: ["query_menu", "search_dish", "get_dish_detail"],
  create_dish: ["query_menu", "search_dish"],
  delete_dish: ["query_menu", "search_dish", "get_dish_detail"],
  book_facility: ["get_reservations", "query_facilities"],
  cancel_reservation: ["get_reservations", "query_facilities"],
};

export interface ToolCacheStats {
  hits: number;
  misses: number;
  invalidations: number;
}

export class ToolCache {
  private stats: ToolCacheStats = { hits: 0, misses: 0, invalidations: 0 };

  constructor(private readonly redis: RedisClient = getRedis()) {}

  /** 缓存键：工具名 + 入参哈希（不含 token 等易变字段） */
  private key(sessionId: string, toolName: string, args: unknown): string {
    const normalized = this.normalizeArgs(args);
    return `cache:l2:${sessionId}:${toolName}:${this.hash(normalized)}`;
  }

  private normalizeArgs(args: unknown): string {
    if (!args || typeof args !== "object") return String(args ?? "");
    // 剔除鉴权等与业务无关的字段，避免同一业务请求缓存 miss
    const { token: _t, jwt: _j, ...rest } = args as Record<string, unknown>;
    const sorted = Object.keys(rest)
      .sort()
      .map((k) => `${k}=${JSON.stringify(rest[k])}`);
    return sorted.join("&");
  }

  private hash(s: string): string {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  isCacheable(toolName: string): boolean {
    return READONLY_TOOLS.has(toolName);
  }

  async get(sessionId: string, toolName: string, args: unknown): Promise<unknown | undefined> {
    if (!this.isCacheable(toolName)) return undefined;

    const value = await this.redis.getJSON<unknown>(this.key(sessionId, toolName, args));
    if (value === null || value === undefined) {
      this.stats.misses++;
      return undefined;
    }
    this.stats.hits++;
    return value;
  }

  async set(
    sessionId: string,
    toolName: string,
    args: unknown,
    value: unknown,
  ): Promise<void> {
    if (!this.isCacheable(toolName)) return;
    const ttl = TOOL_TTL[toolName] ?? 120;
    await this.redis.setJSON(this.key(sessionId, toolName, args), value, ttl);
  }

  /** 写操作后主动失效关联缓存（不依赖 TTL 自然过期） */
  async invalidate(sessionId: string, writeTool: string): Promise<number> {
    const targets = INVALIDATION_MAP[writeTool];
    if (!targets || targets.length === 0) return 0;

    let total = 0;
    for (const tool of targets) {
      total += await this.redis.delByPrefix(`cache:l2:${sessionId}:${tool}:`);
    }
    this.stats.invalidations += total;
    return total;
  }

  getStats(): ToolCacheStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = { hits: 0, misses: 0, invalidations: 0 };
  }
}

// ─────────────────────── L4 Plan 模板缓存 ───────────────────────

export class PlanTemplateCache {
  constructor(private readonly redis: RedisClient = getRedis()) {}

  private key(intentHash: string, toolsetHash: string): string {
    return `cache:l4:plan:${intentHash}:${toolsetHash}`;
  }

  private hash(s: string): string {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  /** 生成缓存键（调用方传入意图与工具集标识） */
  buildKey(intent: string, tools: string[]): { intentHash: string; toolsetHash: string } {
    const toolset = [...tools].sort().join(",");
    return {
      intentHash: this.hash(intent.trim().toLowerCase()),
      toolsetHash: this.hash(toolset),
    };
  }

  async get<T>(intent: string, tools: string[]): Promise<T | null> {
    const { intentHash, toolsetHash } = this.buildKey(intent, tools);
    return this.redis.getJSON<T>(this.key(intentHash, toolsetHash));
  }

  async set(intent: string, tools: string[], plan: unknown, ttlSeconds = 3600): Promise<void> {
    const { intentHash, toolsetHash } = this.buildKey(intent, tools);
    await this.redis.setJSON(this.key(intentHash, toolsetHash), plan, ttlSeconds);
  }

  /** 工具集或协议变化时清空所有 plan 模板 */
  async clearAll(): Promise<number> {
    return this.redis.delByPrefix("cache:l4:plan:");
  }
}

// ─────────────────────── 统一入口 ───────────────────────

export class CacheSubsystem {
  readonly prefix = new PromptPrefixManager();
  readonly tools: ToolCache;
  readonly plans: PlanTemplateCache;

  constructor(redis: RedisClient = getRedis()) {
    this.tools = new ToolCache(redis);
    this.plans = new PlanTemplateCache(redis);
  }

  /** 汇总统计，用于埋点 */
  getStats() {
    return {
      tool: this.tools.getStats(),
    };
  }
}

let instance: CacheSubsystem | null = null;

export function getCacheSubsystem(): CacheSubsystem {
  if (!instance) instance = new CacheSubsystem();
  return instance;
}
