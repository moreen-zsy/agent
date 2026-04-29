/**
 * useA2UI Hook
 * 连接 A2UI Store 与 React 状态
 * 使用 useSyncExternalStore 避免 tearing，兼容 React 18+ 并发模式
 */

import { useSyncExternalStore, useMemo } from 'react';
import type { A2UIStore, SurfaceState } from '@a2ui/core';

export function useA2UI(store: A2UIStore, surfaceId: string): SurfaceState | undefined {
  const version = useSyncExternalStore(
    (callback) => store.subscribe(callback),
    () => store.getSnapshot(),
    () => store.getSnapshot()
  );

  return useMemo(() => store.getSurface(surfaceId), [store, surfaceId, version]);
}

/**
 * 使用 Store 的 dataStore 解析 BoundValue
 */
export function useResolvedValue(
  store: A2UIStore,
  surfaceId: string,
  value: any
): any {
  const version = useSyncExternalStore(
    (callback) => store.subscribe(callback),
    () => store.getSnapshot(),
    () => store.getSnapshot()
  );

  return useMemo(() => {
    if (value && typeof value === 'object' && ('path' in value || 'literalString' in value)) {
      return store.getDataStore().resolveBoundValue(surfaceId, value);
    }
    return value;
  }, [store, surfaceId, value, version]);
}
