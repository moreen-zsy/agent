/**
 * 会话内存子系统
 *
 * 核心思想：区分【送入 LLM 的上下文】、【业务状态】、【审计日志】，
 * 不再把所有内容混在一起喂给大模型。
 *
 * 一个 session 拆成 4 块独立存储：
 *   session:{sid}:meta           会话元数据
 *   session:{sid}:working_memory 受控上下文（token 预算 + 摘要压缩）
 *   session:{sid}:entity_store   结构化业务实体（按需注入，不进 prompt）
 *   session:{sid}:trace          完整轨迹（仅审计/回放，默认不进 prompt）
 */

import { RedisClient, getRedis } from "./redis-client.js";
import { estimateMessagesTokens, estimateTokens } from "./token-estimator.js";

// ─────────────────────── 类型定义 ───────────────────────

export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface MemoryMessage {
  role: MessageRole;
  content: string;
  /** 该条消息产生的 token 估算 */
  tokens?: number;
  createdAt: number;
  /** 是否已被摘要压缩 */
  summarized?: boolean;
}

export interface SessionMeta {
  sessionId: string;
  userId?: string;
  createdAt: number;
  lastActiveAt: number;
  /** 该会话累计 token 预算 */
  tokenBudget: number;
  /** 已消耗 token（估算） */
  tokensUsed: number;
  currentPlanId?: string;
  active: boolean;
  /** 摘要版本，用于判断是否需要重新压缩 */
  summaryVersion: number;
}

/** 点餐业务的强结构化状态 */
export interface EntityStore {
  /** 购物车 */
  cart?: Array<{
    dishId: string;
    name: string;
    price: number;
    quantity: number;
    image?: string;
  }>;
  /** 地址列表 */
  addresses?: Array<{
    id: string;
    address: string;
    contactName?: string;
    phone?: string;
    isDefault?: boolean;
  }>;
  /** 当前选中的菜品 */
  selectedDish?: Record<string, unknown>;
  /** 最近查询到的订单 */
  recentOrders?: Array<Record<string, unknown>>;
  /** 当前进行中的订单 */
  activeOrder?: Record<string, unknown>;
  /** 菜单快照（用于避免重复查询） */
  menuSnapshot?: {
    fetchedAt: number;
    dishes: Array<Record<string, unknown>>;
  };
  /** 业务自定义键值 */
  extras?: Record<string, unknown>;
}

/** 轨迹记录（审计/回放） */
export interface TraceEntry {
  at: number;
  stage: "triage" | "plan" | "worker" | "critic" | "mcp" | "sse" | "error";
  node?: string;
  input?: unknown;
  output?: unknown;
  durationMs?: number;
  tokens?: number;
  error?: string;
}

export interface WorkingMemory {
  /** 摘要后的历史（压缩产物） */
  summary: string;
  /** 最近 N 轮原文（永远保留） */
  recent: MemoryMessage[];
  /** 关键结论（如「用户已下单」） */
  facts: string[];
  /** 当前计划进度 */
  planProgress?: {
    planId: string;
    completed: string[];
    pending: string[];
  };
}

// ─────────────────────── 配置 ───────────────────────

export interface SessionConfig {
  /** 工作记忆最大 token 数，超过则触发压缩 */
  workingMemoryBudget: number;
  /** 保留的最近消息条数（不参与摘要） */
  keepRecentMessages: number;
  /** 空闲多少秒后过期 */
  idleTtlSeconds: number;
  /** 轨迹最多保留多少条 */
  maxTraceEntries: number;
}

const DEFAULT_CONFIG: SessionConfig = {
  workingMemoryBudget: 4000,
  keepRecentMessages: 6,
  idleTtlSeconds: 30 * 60,
  maxTraceEntries: 500,
};

// ─────────────────────── SessionManager ───────────────────────

export class SessionManager {
  private readonly config: SessionConfig;

  constructor(
    private readonly redis: RedisClient = getRedis(),
    config: Partial<SessionConfig> = {},
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private key(sid: string, part: "meta" | "working_memory" | "entity_store" | "trace"): string {
    return `session:${sid}:${part}`;
  }

  // ── meta ──

  async getMeta(sid: string): Promise<SessionMeta | null> {
    return this.redis.getJSON<SessionMeta>(this.key(sid, "meta"));
  }

  async touchMeta(sid: string, patch: Partial<SessionMeta> = {}): Promise<SessionMeta> {
    const now = Date.now();
    const existing = await this.getMeta(sid);
    const meta: SessionMeta = {
      sessionId: sid,
      createdAt: existing?.createdAt ?? now,
      lastActiveAt: now,
      tokenBudget: existing?.tokenBudget ?? 50_000,
      tokensUsed: existing?.tokensUsed ?? 0,
      active: true,
      summaryVersion: existing?.summaryVersion ?? 0,
      ...existing,
      ...patch,
    };
    await this.redis.setJSON(this.key(sid, "meta"), meta, this.config.idleTtlSeconds);
    return meta;
  }

  // ── working memory ──

  async getWorkingMemory(sid: string): Promise<WorkingMemory> {
    const wm = await this.redis.getJSON<WorkingMemory>(this.key(sid, "working_memory"));
    return wm ?? { summary: "", recent: [], facts: [] };
  }

  /** 追加一条消息到工作记忆 */
  async appendMessage(sid: string, role: MessageRole, content: string): Promise<void> {
    const wm = await this.getWorkingMemory(sid);
    wm.recent.push({
      role,
      content,
      tokens: estimateTokens(content),
      createdAt: Date.now(),
    });
    await this.redis.setJSON(this.key(sid, "working_memory"), wm, this.config.idleTtlSeconds);
  }

  /** 记录一条关键结论 */
  async addFact(sid: string, fact: string): Promise<void> {
    const wm = await this.getWorkingMemory(sid);
    if (!wm.facts.includes(fact)) {
      wm.facts.push(fact);
      // 限制结论条数，避免无限增长
      if (wm.facts.length > 20) wm.facts = wm.facts.slice(-20);
    }
    await this.redis.setJSON(this.key(sid, "working_memory"), wm, this.config.idleTtlSeconds);
  }

  /** 判断是否需要压缩工作记忆 */
  async shouldCompress(sid: string): Promise<boolean> {
    const wm = await this.getWorkingMemory(sid);
    const tokens = estimateMessagesTokens(wm.recent) + estimateTokens(wm.summary);
    return tokens > this.config.workingMemoryBudget;
  }

  /**
   * 压缩工作记忆
   *
   * 策略 B（自适应摘要）的轻量实现：
   * 将超出保留窗口的旧消息交给调用方提供的 summarizer 压缩，
   * 结果并入 summary，同时保留最近 N 条原文。
   *
   * @param summarizer 由上层注入的摘要函数（需要调用 LLM）
   */
  async compress(
    sid: string,
    summarizer: (old: MemoryMessage[], prevSummary: string) => Promise<string>,
  ): Promise<{ compressed: number; summary: string }> {
    const wm = await this.getWorkingMemory(sid);
    const keep = this.config.keepRecentMessages;

    if (wm.recent.length <= keep) {
      return { compressed: 0, summary: wm.summary };
    }

    const old = wm.recent.slice(0, wm.recent.length - keep);
    const recent = wm.recent.slice(-keep);

    const newSummary = await summarizer(old, wm.summary);

    wm.summary = newSummary;
    wm.recent = recent;
    await this.redis.setJSON(this.key(sid, "working_memory"), wm, this.config.idleTtlSeconds);

    await this.touchMeta(sid, {
      summaryVersion: ((await this.getMeta(sid))?.summaryVersion ?? 0) + 1,
    });

    return { compressed: old.length, summary: newSummary };
  }

  /**
   * 组装送入 LLM 的上下文
   *
   * 顺序：静态摘要 → 关键结论 → 最近原文
   * 返回纯消息数组，可直接拼进 messages。
   */
  async buildContext(sid: string): Promise<MemoryMessage[]> {
    const wm = await this.getWorkingMemory(sid);
    const out: MemoryMessage[] = [];

    const contextParts: string[] = [];
    if (wm.summary) contextParts.push(`【历史摘要】\n${wm.summary}`);
    if (wm.facts.length > 0) contextParts.push(`【已知事实】\n- ${wm.facts.join("\n- ")}`);

    if (contextParts.length > 0) {
      out.push({
        role: "system",
        content: contextParts.join("\n\n"),
        createdAt: Date.now(),
        tokens: estimateTokens(contextParts.join("\n\n")),
      });
    }

    out.push(...wm.recent);
    return out;
  }

  // ── entity store ──

  async getEntities(sid: string): Promise<EntityStore> {
    return (await this.redis.getJSON<EntityStore>(this.key(sid, "entity_store"))) ?? {};
  }

  /** 原子更新实体（浅合并） */
  async updateEntities(sid: string, patch: Partial<EntityStore>): Promise<EntityStore> {
    const current = await this.getEntities(sid);
    const merged: EntityStore = { ...current, ...patch };
    await this.redis.setJSON(this.key(sid, "entity_store"), merged, this.config.idleTtlSeconds);
    return merged;
  }

  /** 按需注入实体片段到上下文（不是全部塞进 prompt） */
  async buildEntityDigest(sid: string, keys?: Array<keyof EntityStore>): Promise<string> {
    const entities = await this.getEntities(sid);
    const picked = keys
      ? Object.fromEntries(keys.map((k) => [k, entities[k]]).filter(([, v]) => v != null))
      : Object.fromEntries(Object.entries(entities).filter(([, v]) => v != null));

    if (Object.keys(picked).length === 0) return "";
    return `【当前业务状态】\n${JSON.stringify(picked, null, 2)}`;
  }

  // ── trace ──

  async appendTrace(sid: string, entry: TraceEntry): Promise<void> {
    const key = this.key(sid, "trace");
    const list = (await this.redis.getJSON<TraceEntry[]>(key)) ?? [];
    list.push(entry);
    // 环形截断，避免无限增长
    const trimmed = list.length > this.config.maxTraceEntries
      ? list.slice(-this.config.maxTraceEntries)
      : list;
    await this.redis.setJSON(key, trimmed, this.config.idleTtlSeconds);
  }

  async getTrace(sid: string): Promise<TraceEntry[]> {
    return (await this.redis.getJSON<TraceEntry[]>(this.key(sid, "trace"))) ?? [];
  }

  // ── 生命周期 ──

  /** 清理整个会话 */
  async destroy(sid: string): Promise<void> {
    await this.redis.delByPrefix(`session:${sid}:`);
  }

  /** 清理所有过期会话（由定时任务调用） */
  async sweepIdle(): Promise<number> {
    return this.redis.delByPrefix("session:");
  }
}

/** 全局单例 */
let instance: SessionManager | null = null;

export function getSessionManager(): SessionManager {
  if (!instance) instance = new SessionManager();
  return instance;
}
