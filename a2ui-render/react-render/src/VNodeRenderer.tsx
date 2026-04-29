/**
 * VNode 递归渲染器
 * 将 VNode 树递归渲染为 React DOM
 */

import { type ReactNode, memo, useMemo, useSyncExternalStore } from 'react';
import type { A2UIStore, VNode } from '@a2ui/core';
import { TreeBuilder } from '@a2ui/core';
import { useCatalog } from './hooks/useCatalog.js';
import { A2UIElementErrorBoundary } from './components/A2UIElementErrorBoundary.js';

export interface VNodeRendererProps {
  store: A2UIStore;
  surfaceId: string;
  catalogId?: string;
  vNode: VNode | null;
  rootId?: string;
}

/**
 * A2UI VNode 树渲染器
 * 从 store 构建 VNode 树并递归渲染为 React 组件
 */
export function VNodeRenderer({
  store,
  surfaceId,
  catalogId,
  vNode,
  rootId,
}: VNodeRendererProps): ReactNode {
  const version = useSyncExternalStore(
    (callback) => store.subscribe(callback),
    () => store.getSnapshot(),
    () => store.getSnapshot()
  );

  const node = useMemo(() => {
    if (vNode) return vNode;
    if (!rootId) return null;
    const components = store.getComponents(surfaceId);
    return TreeBuilder.build(components, rootId, { surfaceId });
  }, [vNode, rootId, store, surfaceId, version]);

  if (!node) return null;

  return (
    <VNodeNode
      store={store}
      surfaceId={surfaceId}
      catalogId={catalogId}
      node={node}
    />
  );
}

interface VNodeNodeProps {
  store: A2UIStore;
  surfaceId: string;
  catalogId?: string;
  node: VNode;
}

/**
 * 单个 VNode 渲染（memoized）
 * 避免无关状态变化时重复渲染
 */
const VNodeNode = memo(function VNodeNode({
  store,
  surfaceId,
  catalogId,
  node,
}: VNodeNodeProps): ReactNode {
  const Component = useCatalog(catalogId, node.type);

  if (!Component) {
    console.warn(`[A2UI] Unknown component type: ${node.type}`);
    return null;
  }

  // 解析 props 中的 BoundValue
  const resolvedProps = useResolvedProps(store, surfaceId, node.props);

  // 递归渲染子组件
  const children = node.children.map((child) => (
    <VNodeNode
      key={child.id}
      store={store}
      surfaceId={surfaceId}
      catalogId={catalogId}
      node={child}
    />
  ));

  return (
    <A2UIElementErrorBoundary
      componentType={node.type}
      componentId={node.id}
    >
      <Component
        {...resolvedProps}
        _store={store}
        _surfaceId={surfaceId}
        _componentId={node.id}
      >
        {children}
      </Component>
    </A2UIElementErrorBoundary>
  );
});

/**
 * 解析 props 对象中的所有 BoundValue
 * 订阅 store 版本号，确保数据模型更新时重新解析
 */
function useResolvedProps(
  store: A2UIStore,
  surfaceId: string,
  props: Record<string, any>
): Record<string, any> {
  const version = useSyncExternalStore(
    (callback) => store.subscribe(callback),
    () => store.getSnapshot(),
    () => store.getSnapshot()
  );
  const dataStore = store.getDataStore();

  return useMemo(() => {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(props)) {
      if (value && typeof value === 'object') {
        // 检测是否是 BoundValue（有 path 或 literal*）
        if (
          'path' in value ||
          'literalString' in value ||
          'literalNumber' in value ||
          'literalBoolean' in value
        ) {
          result[key] = dataStore.resolveBoundValue(surfaceId, value as any);
          continue;
        }
        // children: explicitList / template 不需要解析
        if (key === 'children' || key === 'action') {
          result[key] = value;
          continue;
        }
      }
      result[key] = value;
    }
    return result;
  }, [props, dataStore, surfaceId, version]);
}
