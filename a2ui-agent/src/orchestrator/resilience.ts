/**
 * 降级与灰度（V1.2）
 *
 * 降级策略：
 *   Planner 不可用 / 超时 / 连续失败时，自动切换为「简单路由模式」，
 *   直接走 Triage 快捷路径，保证基础可用性。
 *
 * 灰度发布：
 *   按用户 ID 哈希分桶，控制新编排逻辑的放量比例。
 *   支持随时调回 0%（全量回滚到旧路径）。
 */

import type { RedisClient } from "../session/redis-client.js";

// ─────────────────────── 灰度 ───────────────────────

export interface RolloutConfig {
  /** 灰度比例 0~100 */
  percentage: number;
  /** 白名单用户（总是走新逻辑） */
  allowList?: string[];
  /** 黑名单用户（总是走旧逻辑） */
  denyList?: string[];
}

export class FeatureRollout {
  private config: RolloutConfig;

  constructor(
    private readonly redis: RedisClient,
    initial: RolloutConfig = { percentage: 0 },
  ) {
    this.config = initial;
  }

  /** 从 Redis 加载配置（支持运行期热更新） */
  async load(feature: string): Promise<RolloutConfig> {
    const stored = await this.redis.getJSON<RolloutConfig>(`rollout:${feature}`);
    if (stored) this.config = stored;
    return this.config;
  }

  async save(feature: string, config: RolloutConfig): Promise<void> {
    this.config = config;
    await this.redis.setJSON(`rollout:${feature}`, config);
  }

  /** 稳定哈希：同一用户始终落同一桶 */
  private bucket(userId: string): number {
    let h = 2166136261;
    for (let i = 0; i < userId.length; i++) {
      h ^= userId.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) % 100;
  }

  /** 判断某用户是否走新逻辑 */
  isEnabled(userId?: string): boolean {
    if (!userId) return false;
    if (this.config.allowList?.includes(userId)) return true;
    if (this.config.denyList?.includes(userId)) return false;
    return this.bucket(userId) < this.config.percentage;
  }
}

// ─────────────────────── 降级 ───────────────────────

export type DegradeReason =
  | "planner_timeout"
  | "planner_error"
  | "consecutive_failures"
  | "manual";

export interface DegradeState {
  degraded: boolean;
  reason?: DegradeReason;
  since?: number;
  /** 连续失败计数 */
  failures: number;
  /** 自动恢复时间点 */
  recoverAt?: number;
}

const FAILURE_THRESHOLD = 3;
const COOLDOWN_MS = 60_000;

export class DegradeController {
  private state: DegradeState = { degraded: false, failures: 0 };

  constructor(
    private readonly redis: RedisClient,
    private readonly options: { threshold?: number; cooldownMs?: number } = {},
  ) {}

  get isDegraded(): boolean {
    // 冷却期结束自动恢复
    if (this.state.degraded && this.state.recoverAt && Date.now() > this.state.recoverAt) {
      this.state = { degraded: false, failures: 0 };
      console.log("[degrade] 冷却结束，恢复正常模式");
    }
    return this.state.degraded;
  }

  /** 记录一次失败，达到阈值即降级 */
  recordFailure(reason: DegradeReason): void {
    this.state.failures++;
    const threshold = this.options.threshold ?? FAILURE_THRESHOLD;

    if (this.state.failures >= threshold && !this.state.degraded) {
      this.state.degraded = true;
      this.state.reason = reason;
      this.state.since = Date.now();
      this.state.recoverAt = Date.now() + (this.options.cooldownMs ?? COOLDOWN_MS);
      console.warn(
        `[degrade] 连续失败 ${this.state.failures} 次，降级为简单路由模式（${reason}）`,
      );
      void this.persist();
    }
  }

  /** 记录成功，重置失败计数 */
  recordSuccess(): void {
    if (this.state.failures > 0) this.state.failures = 0;
  }

  /** 手动降级 / 恢复 */
  manual(degraded: boolean): void {
    this.state = degraded
      ? { degraded: true, reason: "manual", since: Date.now(), failures: 0 }
      : { degraded: false, failures: 0 };
    void this.persist();
  }

  getState(): DegradeState {
    return { ...this.state };
  }

  private async persist(): Promise<void> {
    try {
      await this.redis.setJSON("degrade:state", this.state, 3600);
    } catch {
      // 持久化失败不影响主流程
    }
  }
}
