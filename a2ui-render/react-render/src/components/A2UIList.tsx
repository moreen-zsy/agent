/**
 * A2UI List 组件
 * 支持 explicitList（静态）和 template（动态列表）
 */

import type { ReactNode } from 'react';
import type { A2UIStore } from '@a2ui/core';
import { TreeBuilder } from '@a2ui/core';
import type { VNode } from '@a2ui/core';

export interface ListProps {
  children?: ReactNode;
  direction?: 'vertical' | 'horizontal';
  alignment?: 'start' | 'center' | 'end' | 'stretch';
  _store?: A2UIStore;
  _surfaceId?: string;
  _componentId?: string;
}

const DIR_CLASS: Record<string, string> = {
  vertical: 'flex-col',
  horizontal: 'flex-row',
};

const ALIGN_MAP: Record<string, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

export function A2UIList({
  children,
  direction = 'vertical',
  alignment = 'stretch',
}: ListProps) {
  const dirClass = DIR_CLASS[direction] || 'flex-col';
  const alignClass = ALIGN_MAP[alignment] || 'items-stretch';

  return (
    <div className={`flex ${dirClass} ${alignClass} gap-2`}>
      {children}
    </div>
  );
}

/**
 * 动态列表渲染辅助函数
 * 由 TreeBuilder 在构建 VNode 树时调用
 */
export function buildTemplateChildren(
  store: A2UIStore,
  surfaceId: string,
  dataBinding: string,
  componentId: string
): VNode[] {
  const data = store.getDataStore().getValue(surfaceId, dataBinding);
  if (!Array.isArray(data)) return [];

  const components = store.getComponents(surfaceId);
  const template = components.get(componentId);
  if (!template) return [];

  return data.map((_item: any, index: number) => {
    const id = `${componentId}-${index}`;
    const vnode = TreeBuilder.build(
      new Map([[id, { ...template, id }], ...components]),
      id,
      { surfaceId }
    );
    return vnode;
  }).filter((n): n is VNode => n !== null);
}
