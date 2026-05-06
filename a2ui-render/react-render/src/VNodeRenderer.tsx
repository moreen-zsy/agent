/**
 * VNode 递归渲染器 (v0.9)
 * 将 VNode 树递归渲染为 React DOM
 * DynamicValue 解析：字面量透传、{path} 查数据模型、{call} 透传给组件
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

  // 解析 props 中的 DynamicValue
  const resolvedProps = useResolvedProps(store, surfaceId, node.props);

  // 递归渲染子组件（支持 template 动态列表）
  const children = useMemo(() => {
    const staticChildren = node.children.map((child) => (
      <VNodeNode
        key={child.id}
        store={store}
        surfaceId={surfaceId}
        catalogId={catalogId}
        node={child}
      />
    ));

    // 动态 template 列表（v0.9: children 为 { componentId, path }）
    const childList = node.props.children;
    if (childList && typeof childList === 'object' && !Array.isArray(childList) && childList.componentId && childList.path) {
      const data = store.getDataStore().getValue(surfaceId, childList.path);
      const components = store.getComponents(surfaceId);
      const templateDef = components.get(childList.componentId);

      if (Array.isArray(data) && templateDef) {
        const dynamicChildren = data.map((_: any, index: number) => {
          const id = `${childList.componentId}-${index}`;
          const itemNode = TreeBuilder.build(
            new Map([[id, { ...templateDef, id }], ...components]),
            id,
            { surfaceId }
          );
          if (!itemNode) return null;
          return (
            <VNodeNode
              key={id}
              store={store}
              surfaceId={surfaceId}
              catalogId={catalogId}
              node={itemNode}
            />
          );
        });
        return [...staticChildren, ...dynamicChildren];
      }
    }

    return staticChildren;
  }, [node, store, surfaceId, catalogId]);

  return (
    <A2UIElementErrorBoundary
      componentType={node.type}
      componentId={node.id}
    >
      <Component
        {...resolvedProps}
        _rawProps={node.props}
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
 * 解析 props 对象中的所有 DynamicValue
 * - 字面量（string/number/boolean/array）：直接透传
 * - {path}：从数据模型中查找
 * - {call, args, returnType}：FunctionCall，透传给组件自行处理
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
      // 跳过特殊键，由组件自行处理
      if (key === 'children' || key === 'action' || key === 'tabs' || key === 'checks') {
        result[key] = value;
        continue;
      }

      // 检测是否是 DynamicValue 对象
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // FunctionCall: { call, ... }
        if ('call' in value) {
          result[key] = value; // 透传给组件
          continue;
        }
        // DataBinding: { path }
        if ('path' in value) {
          result[key] = dataStore.getValue(surfaceId, value.path);
          continue;
        }
      }

      // 字面量直接透传
      result[key] = value;
    }
    return result;
  }, [props, dataStore, surfaceId, version]);
}
