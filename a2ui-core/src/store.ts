/**
 * A2UI 状态管理
 * 纯 JS 实现，不依赖 React，框架无关
 *
 * 内部使用 zustand/vanilla 管理订阅/通知，
 * 支持通过适配器接入外部状态管理库。
 */

import type {
  A2UIMessage,
  SurfaceState,
  ClientToServerMessage,
  ComponentDef,
  DataModel,
} from './types.js';
import { A2UIBuffer } from './buffer.js';
import {
  createZustandNotifier,
  createAdapterNotifier,
  type A2UIStoreNotifier,
  type StoreAdapterConfig,
} from './state-store.js';

export interface A2UIStoreOptions {
  /** 用户 action 回调 */
  onUserAction?: (action: ClientToServerMessage) => void;
  /** 外部状态管理适配器（可选，用于接入 Redux/Zustand/XState 等） */
  adapter?: StoreAdapterConfig;
}

/**
 * A2UI Store - 核心状态管理
 *
 * 管理多 Surface 的组件树和数据模型，
 * 处理 A2UI v0.8 协议消息的入站/出站。
 *
 * 默认使用 zustand/vanilla 管理订阅，
 * 可通过 adapter 选项接入外部状态管理库。
 */
export class A2UIStore {
  private buffer = new A2UIBuffer();
  private notifier: A2UIStoreNotifier;
  private options: A2UIStoreOptions;

  constructor(options: A2UIStoreOptions = {}) {
    this.options = options;

    // 使用适配器或默认的 zustand 实现
    this.notifier = options.adapter
      ? createAdapterNotifier(options.adapter)
      : createZustandNotifier();
  }

  // ============================================================
  // 消息处理
  // ============================================================

  /**
   * 处理一条 A2UI 消息
   */
  processMessage(message: A2UIMessage): void {
    this.buffer.push(message);
    this.notifier.notify();
  }

  /**
   * 处理多条 A2UI 消息（批量）
   */
  processMessages(messages: A2UIMessage[]): void {
    for (const msg of messages) {
      this.buffer.push(msg);
    }
    this.notifier.notify();
  }

  // ============================================================
  // Surface 查询
  // ============================================================

  /**
   * 获取指定 surface 的状态
   */
  getSurface(surfaceId: string): SurfaceState | undefined {
    return this.buffer.getSurfaceState(surfaceId);
  }

  /**
   * 获取所有 surface ID
   */
  getSurfaceIds(): string[] {
    return this.buffer.getSurfaceIds();
  }

  /**
   * 判断 surface 是否准备好渲染
   */
  isReady(surfaceId: string): boolean {
    return this.buffer.isReady(surfaceId);
  }

  /**
   * 获取指定 surface 的组件 Map
   */
  getComponents(surfaceId: string): Map<string, ComponentDef> {
    return this.buffer.getComponentMap(surfaceId);
  }

  /**
   * 获取指定 surface 的数据模型
   */
  getDataModel(surfaceId: string): DataModel {
    return this.buffer.getDataModel(surfaceId);
  }

  /**
   * 获取数据模型存储（用于绑定解析）
   */
  getDataStore() {
    return this.buffer.getDataStore();
  }

  /**
   * 获取指定 surface 的根组件 ID
   */
  getRootId(surfaceId: string): string | undefined {
    return this.buffer.getRootId(surfaceId);
  }

  // ============================================================
  // 用户交互
  // ============================================================

  /**
   * 发送用户操作（调用 onUserAction 回调）
   */
  sendUserAction(action: ClientToServerMessage): void {
    this.options.onUserAction?.(action);
  }

  // ============================================================
  // 订阅（框架无关）
  // ============================================================

  /**
   * 订阅状态变化
   * 返回取消订阅函数
   *
   * @example
   * ```typescript
   * // React
   * const version = useSyncExternalStore(
   *   store.subscribe,
   *   store.getSnapshot,
   *   store.getSnapshot
   * );
   * ```
   */
  subscribe(listener: () => void): () => void {
    return this.notifier.subscribe(listener);
  }

  /**
   * 获取当前版本快照（用于 React useSyncExternalStore）
   */
  getSnapshot(): number {
    return this.notifier.getSnapshot();
  }

  // ============================================================
  // 生命周期
  // ============================================================

  /**
   * 清空指定 surface
   */
  clearSurface(surfaceId: string): void {
    this.buffer.clear(surfaceId);
    this.notifier.notify();
  }

  /**
   * 清空所有 surface
   */
  clearAll(): void {
    this.buffer.clearAll();
    this.notifier.notify();
  }
}
