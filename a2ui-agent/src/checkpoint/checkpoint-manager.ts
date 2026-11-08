/**
 * Checkpoint & 回滚
 *
 * 在 DAG 每个节点执行**前**对 entity_store 打快照。
 * 节点校验失败时，可回滚到上一个 checkpoint 的实体状态。
 *
 * 不做分布式事务，属于应用层快照回滚，适合当前项目体量。
 */

import type { RedisClient } from "../session/redis-client.js";
import { getRedis } from "../session/redis-client.js";
import type { EntityStore } from "../session/session-manager.js";

export interface Checkpoint {
  checkpointId: string;
  planId: string;
  nodeId: string;
  sessionId: string;
  /** 打快照时刻的完整实体状态 */
  entities: EntityStore;
  createdAt: number;
  /** 高风险节点（下单）会额外标记，便于双检 */
  isCritical: boolean;
}

const CHECKPOINT_TTL = 60 * 30; // 30 分钟
const MAX_CHECKPOINTS = 20;

export class CheckpointManager {
  constructor(private readonly redis: RedisClient = getRedis()) {}

  private indexKey(sessionId: string): string {
    return `ckpt:${sessionId}:index`;
  }

  private dataKey(sessionId: string, checkpointId: string): string {
    return `ckpt:${sessionId}:data:${checkpointId}`;
  }

  /** 创建快照 */
  async push(
    sessionId: string,
    planId: string,
    nodeId: string,
    entities: EntityStore,
    isCritical = false,
  ): Promise<Checkpoint> {
    const checkpointId = `${planId}:${nodeId}:${Date.now()}`;
    const checkpoint: Checkpoint = {
      checkpointId,
      planId,
      nodeId,
      sessionId,
      entities: structuredCloneSafe(entities),
      createdAt: Date.now(),
      isCritical,
    };

    await this.redis.setJSON(this.dataKey(sessionId, checkpointId), checkpoint, CHECKPOINT_TTL);

    const index = (await this.redis.getJSON<string[]>(this.indexKey(sessionId))) ?? [];
    index.push(checkpointId);
    // 只保留最近 N 个，避免无限增长
    const trimmed = index.slice(-MAX_CHECKPOINTS);
    await this.redis.setJSON(this.indexKey(sessionId), trimmed, CHECKPOINT_TTL);

    // 清理被挤出的数据
    for (const old of index.slice(0, index.length - MAX_CHECKPOINTS)) {
      await this.redis.del(this.dataKey(sessionId, old));
    }

    return checkpoint;
  }

  /** 获取指定快照 */
  async get(sessionId: string, checkpointId: string): Promise<Checkpoint | null> {
    return this.redis.getJSON<Checkpoint>(this.dataKey(sessionId, checkpointId));
  }

  /** 取最近一个快照 */
  async latest(sessionId: string): Promise<Checkpoint | null> {
    const index = (await this.redis.getJSON<string[]>(this.indexKey(sessionId))) ?? [];
    const last = index.at(-1);
    if (!last) return null;
    return this.get(sessionId, last);
  }

  /**
   * 回滚到指定快照
   *
   * 返回快照中的实体状态，由调用方写回 SessionManager。
   */
  async rollback(
    sessionId: string,
    checkpointId?: string,
  ): Promise<EntityStore | null> {
    const checkpoint = checkpointId
      ? await this.get(sessionId, checkpointId)
      : await this.latest(sessionId);

    if (!checkpoint) return null;
    return structuredCloneSafe(checkpoint.entities);
  }

  /** 丢弃指定快照（节点成功提交后调用） */
  async discard(sessionId: string, checkpointId: string): Promise<void> {
    const index = (await this.redis.getJSON<string[]>(this.indexKey(sessionId))) ?? [];
    const next = index.filter((id) => id !== checkpointId);
    await this.redis.setJSON(this.indexKey(sessionId), next, CHECKPOINT_TTL);
    await this.redis.del(this.dataKey(sessionId, checkpointId));
  }

  /** 清理会话全部快照 */
  async clear(sessionId: string): Promise<void> {
    await this.redis.delByPrefix(`ckpt:${sessionId}:`);
  }
}

/** 安全的深拷贝，避免快照持有原始对象引用 */
function structuredCloneSafe<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

let instance: CheckpointManager | null = null;

export function getCheckpointManager(): CheckpointManager {
  if (!instance) instance = new CheckpointManager();
  return instance;
}
