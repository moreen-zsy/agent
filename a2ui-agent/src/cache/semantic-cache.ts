/**
 * L3 语义缓存（V1.1）
 *
 * 用于无状态只读查询：相同/高度相似的 query 直接返回历史结果，
 * 避免重复调用 LLM 与 MCP。
 *
 * 实现说明：
 *   不引入向量数据库。采用「轻量语义指纹」方案：
 *     1. 文本归一化（去标点、去空白、繁简/大小写统一）
 *     2. 中文按字 bigram + 英文按词，构建特征集合
 *     3. Jaccard 相似度比对，超过阈值视为命中
 *
 *   相比向量方案：
 *     - 零外部依赖，无需 embedding 模型调用（省一次 LLM/网络往返）
 *     - 对「菜单/菜品/订单」这类短查询效果足够
 *     - 命中判定可解释（能显示相似度与命中的原 query）
 *
 * ❌ 红线：写操作、带状态依赖的任务（下单、改购物车）一律不走语义缓存。
 */

import type { RedisClient } from "../session/redis-client.js";

const CACHE_PREFIX = "cache:l3:";
const DEFAULT_TTL = 15 * 60; // 15 分钟
const DEFAULT_THRESHOLD = 0.92;
const MAX_CANDIDATES = 200;

export interface SemanticCacheEntry<T = unknown> {
  key: string;
  /** 原始 query，便于调试 */
  query: string;
  /** 归一化后的特征 */
  features: string[];
  /** 业务域（food / campus），用于隔离 */
  domain: string;
  /** 用户隔离 */
  userId?: string;
  value: T;
  createdAt: number;
  hits: number;
}

export interface SemanticCacheOptions {
  redis: RedisClient;
  /** 相似度阈值，默认 0.92 */
  threshold?: number;
  /** TTL 秒 */
  ttlSeconds?: number;
}

export class SemanticCache {
  private readonly threshold: number;
  private readonly ttl: number;

  constructor(private readonly options: SemanticCacheOptions) {
    this.threshold = options.threshold ?? DEFAULT_THRESHOLD;
    this.ttl = options.ttlSeconds ?? DEFAULT_TTL;
  }

  private indexKey(domain: string, userId?: string): string {
    return `${CACHE_PREFIX}index:${domain}:${userId ?? "anon"}`;
  }

  private entryKey(domain: string, userId: string | undefined, key: string): string {
    return `${CACHE_PREFIX}item:${domain}:${userId ?? "anon"}:${key}`;
  }

  // ─────────────────────── 特征计算 ───────────────────────

  /** 文本归一化：去标点、统一小写、去多余空白 */
  private normalize(text: string): string {
    return text
      .toLowerCase()
      .replace(/[\s\u3000]+/g, "")
      .replace(/[，。！？、；：""''（）【】《》,.!?;:'"()\[\]{}<>~`@#$%^&*+=|\\/-]/g, "");
  }

  /**
   * 生成特征集合
   *   - 中文：相邻 2 字 bigram（单字查询则用单字）
   *   - 英文/数字：按词切分
   */
  private featureize(text: string): string[] {
    const normalized = this.normalize(text);
    if (!normalized) return [];

    const features = new Set<string>();
    const cjk = /[\u4e00-\u9fa5]/;
    const tokens = normalized.match(/[\u4e00-\u9fa5]+|[a-z0-9]+/g) ?? [];

    for (const token of tokens) {
      if (cjk.test(token)) {
        if (token.length === 1) {
          features.add(token);
        } else {
          for (let i = 0; i < token.length - 1; i++) {
            features.add(token.slice(i, i + 2));
          }
        }
      } else {
        features.add(token);
      }
    }

    return [...features];
  }

  /** Jaccard 相似度 */
  private similarity(a: string[], b: string[]): number {
    if (a.length === 0 || b.length === 0) return 0;
    const setA = new Set(a);
    const setB = new Set(b);
    let inter = 0;
    for (const x of setA) if (setB.has(x)) inter++;
    const union = setA.size + setB.size - inter;
    return union === 0 ? 0 : inter / union;
  }

  private hashFeatures(features: string[]): string {
    const s = [...features].sort().join("|");
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  // ─────────────────────── 读 ───────────────────────

  /**
   * 查询语义缓存
   *
   * @returns 命中时返回 { value, similarity, matchedQuery }
   */
  async get<T>(
    query: string,
    domain: string,
    userId?: string,
  ): Promise<{ value: T; similarity: number; matchedQuery: string } | null> {
    const features = this.featureize(query);
    if (features.length === 0) return null;

    const index = (await this.options.redis.getJSON<string[]>(
      this.indexKey(domain, userId),
    )) ?? [];

    if (index.length === 0) return null;

    let best: { entry: SemanticCacheEntry<T>; similarity: number } | null = null;

    // 取最近的部分候选，避免全量比对
    const candidates = index.slice(-MAX_CANDIDATES);

    for (const key of candidates) {
      const entry = await this.options.redis.getJSON<SemanticCacheEntry<T>>(
        this.entryKey(domain, userId, key),
      );
      if (!entry) continue;

      const sim = this.similarity(features, entry.features);
      if (sim >= this.threshold && (!best || sim > best.similarity)) {
        best = { entry, similarity: sim };
      }
    }

    if (!best) return null;

    // 命中计数（用于观测）
    void this.options.redis.incrBy(`${CACHE_PREFIX}hits`);

    return {
      value: best.entry.value,
      similarity: Number(best.similarity.toFixed(3)),
      matchedQuery: best.entry.query,
    };
  }

  // ─────────────────────── 写 ───────────────────────

  async set<T>(
    query: string,
    domain: string,
    userId: string | undefined,
    value: T,
  ): Promise<void> {
    const features = this.featureize(query);
    if (features.length === 0) return;

    const key = this.hashFeatures(features);
    const entry: SemanticCacheEntry<T> = {
      key,
      query,
      features,
      domain,
      userId,
      value,
      createdAt: Date.now(),
      hits: 0,
    };

    await this.options.redis.setJSON(
      this.entryKey(domain, userId, key),
      entry,
      this.ttl,
    );

    const index = (await this.options.redis.getJSON<string[]>(
      this.indexKey(domain, userId),
    )) ?? [];

    if (!index.includes(key)) {
      index.push(key);
      // 容量控制
      const trimmed = index.slice(-MAX_CANDIDATES);
      await this.options.redis.setJSON(this.indexKey(domain, userId), trimmed, this.ttl);
    }
  }

  /** 清空某个域/用户的语义缓存 */
  async clear(domain: string, userId?: string): Promise<number> {
    return this.options.redis.delByPrefix(`${CACHE_PREFIX}item:${domain}:${userId ?? "anon"}:`);
  }

  /** 统计命中数 */
  async getHitCount(): Promise<number> {
    return Number((await this.options.redis.getString(`${CACHE_PREFIX}hits`)) ?? 0);
  }

  /** 对外暴露特征计算，便于测试与调试 */
  analyze(query: string): { normalized: string; features: string[]; similarity: (a: string, b: string) => number } {
    return {
      normalized: this.normalize(query),
      features: this.featureize(query),
      similarity: (a: string, b: string) =>
        Number(this.similarity(this.featureize(a), this.featureize(b)).toFixed(3)),
    };
  }
}

/**
 * 判定一次请求是否「允许」走语义缓存
 *
 * 只有无状态只读查询才安全：
 *   - 不能含写操作关键词
 *   - 不能依赖购物车/订单等会话状态
 */
const FORBIDDEN_PATTERNS = [
  /下单|点一份|帮我点|结算|付款|支付|提交订单/,
  /取消|删除|修改|改成|换成|更新/,
  /加入购物车|加到购物车|再来一份|再加/,
  /我的|当前|刚才|上次/, // 强会话依赖
];

export function isSemanticCacheEligible(query: string): boolean {
  const text = query.trim();
  if (text.length === 0) return false;
  if (text.length > 60) return false; // 过长查询语义不稳定
  return !FORBIDDEN_PATTERNS.some((re) => re.test(text));
}
