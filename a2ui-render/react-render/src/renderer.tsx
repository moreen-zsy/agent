/**
 * A2UI React 渲染器 (v0.9)
 * 将 A2UI VNode 树渲染为 React DOM
 */

import { type ReactNode } from 'react';
import type { A2UIStore } from '@a2ui/core';
import { useA2UI } from './hooks/useA2UI.js';
import { VNodeRenderer } from './VNodeRenderer.js';

export interface A2UIRendererProps {
  surfaceId: string;
  store: A2UIStore;
}

/**
 * A2UI Surface 渲染器
 * 接收 surfaceId 和 store，自动构建并渲染 VNode 树
 * v0.9: 从 components 中查找 id === 'root' 的组件作为根
 */
export function A2UIRenderer({ surfaceId, store }: A2UIRendererProps): ReactNode {
  const surface = useA2UI(store, surfaceId);

  if (!surface || !surface.isReady) {
    return null;
  }

  // v0.9: 查找 id === 'root' 的组件
  const rootId = store.getRootId(surfaceId);
  if (!rootId) {
    return null;
  }

  return (
    <VNodeRenderer
      store={store}
      surfaceId={surfaceId}
      catalogId={surface.catalogId}
      vNode={null}
      rootId={rootId}
    />
  );
}

export { VNodeRenderer };
