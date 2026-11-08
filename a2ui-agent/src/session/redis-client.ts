/**
 * Redis 客户端封装
 *
 * 基于 Bun 内置的 `Bun.redis`（单例，自动读取 REDIS_URL）。
 * 提供统一的 JSON 读写、TTL、哈希操作与命名空间管理。
 *
 * 若 Redis 不可用，所有操作降级为 no-op / 内存 Map，
 * 保证引擎在缺少 Redis 时仍能运行（只是失去跨进程持久化）。
 */

const REDIS_URL_ENV = "REDIS_URL";
const DEFAULT_URL = "redis://localhost:6380";

type RedisLike = {
  ping(): Promise<string>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: any[]): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  exists(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  hgetall(key: string): Promise<Record<string, string>>;
  hset(key: string, fields: Record<string, string>): Promise<number>;
  hdel(key: string, ...fields: string[]): Promise<number>;
  incr(key: string): Promise<number>;
  scan(cursor: string, ...args: any[]): Promise<[string, string[]]>;
};

/** 内存降级实现，Redis 不可用时使用 */
class MemoryFallback {
  private store = new Map<string, { value: string; expireAt?: number }>();

  private alive(key: string): boolean {
    const item = this.store.get(key);
    if (!item) return false;
    if (item.expireAt && Date.now() > item.expireAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  get(key: string): string | null {
    if (!this.alive(key)) return null;
    return this.store.get(key)?.value ?? null;
  }

  set(key: string, value: string, ttlSeconds?: number): void {
    this.store.set(key, {
      value,
      expireAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    });
  }

  del(key: string): void {
    this.store.delete(key);
  }

  keys(prefix: string): string[] {
    return [...this.store.keys()].filter((k) => k.startsWith(prefix) && this.alive(k));
  }
}

export class RedisClient {
  private readonly memory = new MemoryFallback();
  private readonly real: RedisLike | null;
  private healthy = false;

  constructor(url: string = process.env[REDIS_URL_ENV] || DEFAULT_URL) {
    const candidate = (globalThis as any).Bun?.redis;
    if (candidate && typeof candidate.ping === "function") {
      this.real = candidate as RedisLike;
    } else {
      this.real = null;
      console.warn("[redis] Bun.redis 不可用，降级为内存存储");
    }
    this.url = url;
  }

  private readonly url: string;

  /** 探测连通性；失败后自动降级为内存实现 */
  async connect(): Promise<boolean> {
    if (!this.real) return false;
    try {
      const pong = await this.real.ping();
      this.healthy = pong === "PONG";
      if (!this.healthy) console.warn("[redis] ping 响应异常，降级为内存存储");
      return this.healthy;
    } catch (err) {
      this.healthy = false;
      console.warn(`[redis] 连接失败(${this.url})，降级为内存存储:`, (err as Error).message);
      return false;
    }
  }

  get isHealthy(): boolean {
    return this.healthy;
  }

  // ─────────────────────── 基础操作 ───────────────────────

  async getJSON<T>(key: string): Promise<T | null> {
    const raw = this.healthy && this.real ? await this.real.get(key) : this.memory.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setJSON(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const raw = JSON.stringify(value);
    if (this.healthy && this.real) {
      if (ttlSeconds) await this.real.set(key, raw, "EX", ttlSeconds);
      else await this.real.set(key, raw);
    } else {
      this.memory.set(key, raw, ttlSeconds);
    }
  }

  async setString(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (this.healthy && this.real) {
      if (ttlSeconds) await this.real.set(key, value, "EX", ttlSeconds);
      else await this.real.set(key, value);
    } else {
      this.memory.set(key, value, ttlSeconds);
    }
  }

  async getString(key: string): Promise<string | null> {
    if (this.healthy && this.real) return this.real.get(key);
    return this.memory.get(key);
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    if (this.healthy && this.real) {
      await this.real.del(...keys);
    } else {
      for (const k of keys) this.memory.del(k);
    }
  }

  async exists(key: string): Promise<boolean> {
    if (this.healthy && this.real) return (await this.real.exists(key)) > 0;
    return this.memory.get(key) !== null;
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    if (this.healthy && this.real) {
      await this.real.expire(key, ttlSeconds);
      return;
    }
    const raw = this.memory.get(key);
    if (raw) this.memory.set(key, raw, ttlSeconds);
  }

  // ─────────────────────── 哈希操作 ───────────────────────

  async hgetall(key: string): Promise<Record<string, string>> {
    if (this.healthy && this.real) {
      const res = await this.real.hgetall(key);
      return { ...res };
    }
    const raw = this.memory.get(key);
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  async hset(key: string, fields: Record<string, string>): Promise<void> {
    if (this.healthy && this.real) {
      await this.real.hset(key, fields);
      return;
    }
    const current = await this.hgetall(key);
    this.memory.set(key, JSON.stringify({ ...current, ...fields }));
  }

  async hdel(key: string, ...fields: string[]): Promise<void> {
    if (this.healthy && this.real) {
      await this.real.hdel(key, ...fields);
      return;
    }
    const current = await this.hgetall(key);
    for (const f of fields) delete current[f];
    this.memory.set(key, JSON.stringify(current));
  }

  // ─────────────────────── 按前缀清理 ───────────────────────

  /** 删除所有匹配前缀的 key（Redis 用 SCAN 避免阻塞） */
  async delByPrefix(prefix: string): Promise<number> {
    if (this.healthy && this.real) {
      let deleted = 0;
      let cursor = "0";
      do {
        const [next, keys] = await this.real.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 200);
        cursor = next;
        if (keys.length > 0) {
          await this.real.del(...keys);
          deleted += keys.length;
        }
      } while (cursor !== "0");
      return deleted;
    }

    const keys = this.memory.keys(prefix);
    for (const k of keys) this.memory.del(k);
    return keys.length;
  }

  // ─────────────────────── 计数器 ───────────────────────

  async incrBy(key: string, by = 1): Promise<number> {
    if (this.healthy && this.real) {
      let n = 0;
      for (let i = 0; i < by; i++) n = await this.real.incr(key);
      return n;
    }
    const cur = Number(this.memory.get(key) ?? 0) + by;
    this.memory.set(key, String(cur));
    return cur;
  }
}

/** 全局单例 */
let instance: RedisClient | null = null;

export function getRedis(): RedisClient {
  if (!instance) instance = new RedisClient();
  return instance;
}

/** 初始化连接（在服务启动时调用一次） */
export async function initRedis(): Promise<RedisClient> {
  const client = getRedis();
  await client.connect();
  return client;
}
