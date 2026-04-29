/**
 * A2UI 树构建器
 * 将扁平组件列表构建为 VNode 树（从 root 递归展开）
 */

import type { ComponentDef, VNode } from './types.js';
import { getComponentType, getComponentProps } from './types.js';

const DEFAULT_MAX_DEPTH = 100;

export interface TreeBuilderOptions {
  maxDepth?: number;
  surfaceId?: string;
}

export class TreeBuilder {
  private components: Map<string, ComponentDef>;
  private options: Required<TreeBuilderOptions>;

  constructor(components: Map<string, ComponentDef>, options: TreeBuilderOptions = {}) {
    this.components = components;
    this.options = {
      maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
      surfaceId: options.surfaceId ?? 'default',
    };
  }

  /**
   * 从 rootId 递归构建 VNode 树
   */
  build(rootId: string): VNode | null {
    return this.buildNode(rootId, new Set(), 0);
  }

  private buildNode(id: string, visited: Set<string>, depth: number): VNode | null {
    // 循环引用检测
    if (visited.has(id)) {
      console.warn(`[A2UI] Circular reference detected at component: ${id}`);
      return null;
    }

    // 深度限制
    if (depth > this.options.maxDepth) {
      console.warn(`[A2UI] Max depth exceeded at component: ${id}`);
      return null;
    }

    // 查找组件
    const def = this.components.get(id);
    if (!def) {
      console.warn(`[A2UI] Component not found: ${id}`);
      return null;
    }

    const type = getComponentType(def);
    const props = getComponentProps(def) ?? {};

    if (!type) {
      console.warn(`[A2UI] Component type missing for: ${id}`);
      return null;
    }

    visited.add(id);

    const node: VNode = {
      id,
      type,
      props: { ...props },
      children: [],
      surfaceId: this.options.surfaceId,
      isMounted: false,
    };

    // 递归构建子组件
    const childIds = this.extractChildIds(props);
    for (const childId of childIds) {
      const childNode = this.buildNode(childId, new Set(visited), depth + 1);
      if (childNode) {
        childNode.parentId = id;
        node.children.push(childNode);
      }
    }

    return node;
  }

  /**
   * 从组件属性中提取子组件 ID 列表
   */
  private extractChildIds(props: Record<string, any>): string[] {
    const ids: string[] = [];

    // explicitList: { children: { explicitList: ['child1', 'child2'] } }
    if (props.children?.explicitList) {
      ids.push(...props.children.explicitList);
    }

    // Card 使用 child（单个子组件）
    if (props.child && typeof props.child === 'string') {
      ids.push(props.child);
    }

    // Tabs: { tabItems: [{ title: ..., child: 'id' }] }
    if (props.tabItems && Array.isArray(props.tabItems)) {
      for (const item of props.tabItems) {
        if (item.child && typeof item.child === 'string') {
          ids.push(item.child);
        }
      }
    }

    // Modal: { entryPointChild: 'id', contentChild: 'id' }
    if (props.entryPointChild && typeof props.entryPointChild === 'string') {
      ids.push(props.entryPointChild);
    }
    if (props.contentChild && typeof props.contentChild === 'string') {
      ids.push(props.contentChild);
    }

    return ids;
  }

  /**
   * 静态方法：快速构建树
   */
  static build(
    components: Map<string, ComponentDef>,
    rootId: string,
    options?: TreeBuilderOptions
  ): VNode | null {
    const builder = new TreeBuilder(components, options);
    return builder.build(rootId);
  }
}
