/**
 * A2UI 状态管理抽象层
 *
 * 设计原则：
 * - a2ui-core 是框架无关的，不依赖任何前端框架
 * - 内部使用 zustand/vanilla 作为默认实现
 * - 通过适配器模式支持接入外部状态管理库（Redux / Zustand / XState / 自定义）
 *
 * 实际数据（组件、数据模型）仍由 A2UIBuffer 管理，
 * 本层只负责订阅/通知机制。
 */

import { createStore } from 'zustand/vanilla';

// ============================================================
// 抽象接口 - 框架无关
// ============================================================

/**
 * A2UI Store 通知器接口
 * 定义了 a2ui-core 对状态管理的最小要求
 */
export interface A2UIStoreNotifier {
  /** 订阅状态变化，返回取消订阅函数 */
  subscribe(listener: () => void): () => void;
  /**
   * 获取当前快照（用于 React useSyncExternalStore）
   * 返回一个单调递增的版本号
   */
  getSnapshot(): number;
  /** 触发通知 */
  notify(): void;
}

// ============================================================
// 适配器配置
// ============================================================

/**
 * 外部 Store 适配器配置
 * 接入 Redux / Zustand / XState / Jotai 等外部状态管理库
 *
 * @example
 * ```typescript
 * // Redux 适配
 * const store = new A2UIStore({
 *   adapter: {
 *     subscribe: (listener) => reduxStore.subscribe(listener),
 *     notify: () => reduxStore.dispatch({ type: 'A2UI_STATE_CHANGED' }),
 *     getSnapshot: () => reduxStore.getState().a2uiVersion,
 *   }
 * });
 * ```
 */
export interface StoreAdapterConfig {
  /** 订阅状态变化 */
  subscribe: (listener: () => void) => () => void;
  /** 触发通知（a2ui-core 在数据变化时调用） */
  notify: () => void;
  /** 获取当前版本快照 */
  getSnapshot: () => number;
}

// ============================================================
// Zustand 默认实现
// ============================================================

/**
 * 使用 zustand/vanilla 创建默认通知器
 *
 * 这是 a2ui-core 的默认实现，无需任何外部依赖即可工作。
 * zustand/vanilla 是框架无关的，不依赖 React。
 */
export function createZustandNotifier(): A2UIStoreNotifier {
  const store = createStore<{ version: number }>(() => ({
    version: 0,
  }));

  return {
    subscribe(listener) {
      return store.subscribe(() => listener());
    },
    getSnapshot() {
      return store.getState().version;
    },
    notify() {
      store.setState((state) => ({ version: state.version + 1 }));
    },
  };
}

// ============================================================
// 适配器实现
// ============================================================

/**
 * 从适配器配置创建通知器
 */
export function createAdapterNotifier(config: StoreAdapterConfig): A2UIStoreNotifier {
  return {
    subscribe: config.subscribe,
    getSnapshot: config.getSnapshot,
    notify: config.notify,
  };
}

// ============================================================
// Zustand Store 适配器（用于接入外部 Zustand Store）
// ============================================================

/**
 * 外部 Zustand Store 的引用形状
 */
interface ExternalZustandStore<T> {
  getState: () => T;
  setState: (updater: (state: T) => T) => void;
  subscribe: (listener: () => void) => () => void;
}

/**
 * 从外部 Zustand Store 创建适配器
 *
 * @example
 * ```typescript
 * import { create } from 'zustand';
 *
 * const externalStore = create<{ a2uiVersion: number }>((set) => ({
 *   a2uiVersion: 0,
 * }));
 *
 * const store = new A2UIStore({
 *   adapter: createZustandStoreAdapter(externalStore, (s) => s.a2uiVersion),
 * });
 * ```
 */
export function createZustandStoreAdapter<T>(
  externalStore: ExternalZustandStore<T>,
  selectVersion: (state: T) => number
): StoreAdapterConfig {
  return {
    subscribe: (listener) => externalStore.subscribe(listener),
    getSnapshot: () => selectVersion(externalStore.getState()),
    notify: () => {
      externalStore.setState((state) => state);
    },
  };
}

// ============================================================
// 简单内存实现（无依赖，用于测试或极简场景）
// ============================================================

/**
 * 创建简单的内存通知器（无外部依赖）
 * 适用于测试环境或不需要复杂状态管理的场景
 */
export function createMemoryNotifier(): A2UIStoreNotifier {
  const listeners = new Set<() => void>();
  let version = 0;

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      return version;
    },
    notify() {
      version++;
      for (const listener of listeners) {
        listener();
      }
    },
  };
}
