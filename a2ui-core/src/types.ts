/**
 * A2UI Core - 核心类型定义
 * 定义 A2UI 协议的消息格式、组件定义和状态管理类型
 */

// ============================================================
// 基础组件类型
// ============================================================

export type ComponentType =
  | 'Text'
  | 'Button'
  | 'Column'
  | 'Row'
  | 'Image'
  | 'Input'
  | 'List'
  | 'Card'
  | 'Chart';

export interface ComponentProps {
  // 通用属性
  style?: Record<string, any>;

  // Text
  text?: string;
  usageHint?: 'h1' | 'h2' | 'h3' | 'body' | 'caption';

  // Button
  label?: string;
  onPress?: ActionDef;

  // Image
  source?: string;
  width?: number;
  height?: number;

  // Input
  placeholder?: string;
  value?: string;
  onChange?: ActionDef;

  // Column / Row / List
  children?: string[];
  spacing?: 'small' | 'medium' | 'large';
  alignment?: 'start' | 'center' | 'end' | 'stretch';

  // List
  dataBinding?: string;
  componentId?: string;
}

export interface ComponentDef {
  id: string;
  type: ComponentType;
  props: ComponentProps;
}

// ============================================================
// Action 定义
// ============================================================

export interface ActionDef {
  actionType: 'updateDataModel' | 'sendTextToAgent' | 'custom';
  key?: string;
  payload?: string;
}

// ============================================================
// A2UI 消息类型
// ============================================================

export type A2UIMessage =
  | { createSurface: { surfaceId: string; version: string } }
  | { surfaceUpdate: { surfaceId: string; components: ComponentDef[] } }
  | { dataModelUpdate: { surfaceId: string; dataModel: DataModel } }
  | { beginRendering: { surfaceId: string; root: string } }
  | { deleteSurface: { surfaceId: string } };

export interface DataModel {
  [key: string]: any;
}

// ============================================================
// 解析结果
// ============================================================

export type ParseResultType =
  | 'createSurface'
  | 'surfaceUpdate'
  | 'dataModelUpdate'
  | 'beginRendering'
  | 'deleteSurface'
  | 'error';

export interface ParseResult {
  type: ParseResultType;
  message?: A2UIMessage;
  error?: string;
}

// ============================================================
// VNode（渲染器使用的树形节点）
// ============================================================

export interface VNode {
  id: string;
  type: string;
  props: Record<string, any>;
  children: VNode[];
  parentId?: string;
  surfaceId: string;
  isMounted: boolean;
}

// ============================================================
// Surface 状态
// ============================================================

export interface SurfaceState {
  surfaceId: string;
  version: string;
  components: Map<string, ComponentDef>;
  rootId?: string;
  isReady: boolean;
  dataModel: DataModel;
}

// ============================================================
// Store 状态
// ============================================================

export interface ComponentRelations {
  parentToChildren: Map<string, string[]>;
  childToParent: Map<string, string>;
  roots: Set<string>;
}

export interface StoreState {
  componentMap: Map<string, ComponentDef>;
  hydrateNodeMap: Map<string, VNode>;
  relations: ComponentRelations;
  surfaces: Map<string, SurfaceState>;
  dataBindings: Map<string, string>;
  listeners: Set<() => void>;
}
