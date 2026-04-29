/**
 * A2UI React 渲染器
 * 将 A2UI VNode 树渲染为 React DOM
 */

import { useMemo, type ReactNode } from 'react';
import type { A2UIStore, VNode } from '@a2ui/core';
import { useA2UI } from './hooks/useA2UI.js';
import { useCatalog } from './hooks/useCatalog.js';
import { VNodeRenderer } from './VNodeRenderer.js';

export interface A2UIRendererProps {
  surfaceId: string;
  store: A2UIStore;
}

/**
 * A2UI Surface 渲染器
 * 接收 surfaceId 和 store，自动构建并渲染 VNode 树
 */
export function A2UIRenderer({ surfaceId, store }: A2UIRendererProps): ReactNode {
  const surface = useA2UI(store, surfaceId);

  if (!surface || !surface.isReady || !surface.rootId) {
    return null;
  }

  return (
    <VNodeRenderer
      store={store}
      surfaceId={surfaceId}
      catalogId={surface.catalogId}
      vNode={null}
      rootId={surface.rootId}
    />
  );
}

export { VNodeRenderer };
