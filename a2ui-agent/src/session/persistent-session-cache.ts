/**
 * Redis 支撑的会话数据缓存
 *
 * 替代原来的进程内 Map：进程重启后数据不丢失，
 * 且多个实例可共享同一会话状态。
 *
 * 为了不破坏引擎现有的同步 API（sessionCache.has/get/set），
 * 这里采用「内存写穿 + Redis 异步持久化」策略：
 *   - 读：命中内存直接返回；未命中返回 undefined（由上层触发重新查询）
 *   - 写：同时写内存与 Redis
 *
 * 预热：会话开始时调用 hydrate() 从 Redis 载入到内存。
 */

import type { RedisClient } from "../session/redis-client.js";

const CACHE_TTL = 60 * 30;

export class PersistentSessionCache extends Map<string, any> {
  constructor(
    private readonly redis: RedisClient,
    private readonly threadId: string,
  ) {
    super();
  }

  private key(name?: string): string {
    return name
      ? `session:${this.threadId}:tool_cache:${name}`
      : `session:${this.threadId}:tool_cache`;
  }

  /** 从 Redis 载入已有数据到内存 */
  async hydrate(): Promise<number> {
    const all = await this.redis.hgetall(this.key());
    let n = 0;
    for (const [k, raw] of Object.entries(all)) {
      try {
        super.set(k, JSON.parse(raw));
        n++;
      } catch {
        // 忽略损坏的条目
      }
    }
    return n;
  }

  override set(key: string, value: any): this {
    super.set(key, value);
    // 异步落盘，不阻塞主流程
    void this.redis.hset(this.key(), { [key]: JSON.stringify(value) });
    void this.redis.expire(this.key(), CACHE_TTL);
    return this;
  }

  override has(key: string): boolean {
    return super.has(key);
  }

  override get(key: string): any {
    return super.get(key);
  }

  override delete(key: string): boolean {
    void this.redis.hdel(this.key(), key);
    return super.delete(key);
  }

  async clearPersistent(): Promise<void> {
    super.clear();
    await this.redis.del(this.key());
  }
}
