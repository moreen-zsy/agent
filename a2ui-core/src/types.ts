/**
 * A2UI Core - 核心类型定义 (v0.8)
 * 严格对齐 specification/v0_8/ 标准协议
 */

// ============================================================
// 基础类型
// ============================================================

/** BoundValue: 组件属性值，支持字面量、数据绑定或初始化简写 */
export type BoundValue =
  | { literalString: string }
  | { literalNumber: number }
  | { literalBoolean: boolean }
  | { path: string }
  | { literalString: string; path: string }
  | { literalNumber: number; path: string }
  | { literalBoolean: boolean; path: string };

/** 提取 BoundValue 中的字面量值 */
export type LiteralValue =
  | { literalString: string }
  | { literalNumber: number }
  | { literalBoolean: boolean };

// ============================================================
// 容器子元素定义
// ============================================================

/** explicitList: 静态子元素 ID 列表 */
export interface ExplicitListChildren {
  explicitList: string[];
}

/** template: 动态列表模板，从数据绑定生成子元素 */
export interface TemplateChildren {
  template: {
    dataBinding: string;
    componentId: string;
  };
}

/** 容器子元素定义，必须且只能包含 explicitList 或 template */
export type ChildrenDef = ExplicitListChildren | TemplateChildren;

// ============================================================
// Action 定义
// ============================================================

/** action.context 中的单个条目 */
export interface ActionContextItem {
  key: string;
  value: BoundValue;
}

/** event: 派遣给代理的事件 */
export interface EventAction {
  event: {
    name: string;
    context?: ActionContextItem[];
  };
}

/** functionCall: 在渲染器上执行的本地函数 */
export interface FunctionCallAction {
  functionCall: {
    call: string;
    args?: Record<string, any>;
  };
}

/** Action 定义：event 或 functionCall */
export type ActionDef = EventAction | FunctionCallAction;

// ============================================================
// 组件定义
// ============================================================

/**
 * 组件定义
 * - id: 唯一标识
 * - weight: 在 Row/Column 中的相对权重（可选）
 * - component: 单键对象，键是组件类型名，值是该组件的属性
 */
export interface ComponentDef {
  id: string;
  weight?: number;
  component: Record<string, Record<string, any>>;
}

/** 提取组件的类型名（如 "Text"、"Button"） */
export function getComponentType(def: ComponentDef): string | undefined {
  return Object.keys(def.component)[0];
}

/** 提取组件的属性对象 */
export function getComponentProps(def: ComponentDef): Record<string, any> | undefined {
  const type = getComponentType(def);
  return type ? def.component[type] : undefined;
}

// ============================================================
// 服务端 → 客户端消息
// ============================================================

/** surfaceUpdate: 更新组件 */
export interface SurfaceUpdateMessage {
  surfaceUpdate: {
    surfaceId: string;
    components: ComponentDef[];
  };
}

/** dataModelUpdate: 更新数据模型 */
export interface DataModelUpdateMessage {
  dataModelUpdate: {
    surfaceId: string;
    path?: string;
    contents: DataEntry[];
  };
}

/** beginRendering: 开始渲染 */
export interface BeginRenderingMessage {
  beginRendering: {
    surfaceId: string;
    root: string;
    catalogId?: string;
    styles?: Record<string, any>;
  };
}

/** deleteSurface: 删除 Surface */
export interface DeleteSurfaceMessage {
  deleteSurface: {
    surfaceId: string;
  };
}

/** 服务端 → 客户端消息联合类型（必须且只能包含一个键） */
export type A2UIMessage =
  | SurfaceUpdateMessage
  | DataModelUpdateMessage
  | BeginRenderingMessage
  | DeleteSurfaceMessage;

// ============================================================
// 数据模型
// ============================================================

/** 数据条目（邻接列表格式） */
export interface DataEntry {
  key: string;
  valueString?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueMap?: DataEntry[];
}

/** 数据模型（普通 JSON 对象） */
export interface DataModel {
  [key: string]: any;
}

// ============================================================
// 客户端 → 服务端消息
// ============================================================

/** userAction: 用户交互事件 */
export interface UserAction {
  userAction: {
    name: string;
    surfaceId: string;
    sourceComponentId: string;
    timestamp: string; // ISO 8601
    context: Record<string, any>;
  };
}

/** error: 客户端错误报告 */
export interface ClientError {
  error: {
    code?: string;
    surfaceId?: string;
    message?: string;
    [key: string]: any;
  };
}

/** 客户端 → 服务端消息联合类型 */
export type ClientToServerMessage = UserAction | ClientError;

// ============================================================
// A2A DataPart 包装
// ============================================================

/** A2UI 在 A2A 协议中的 DataPart 编码 */
export interface A2ADataPart {
  data: Record<string, any>;
  kind: 'data';
  metadata: {
    mimeType: 'application/json+a2ui';
  };
}

// ============================================================
// Catalog 定义
// ============================================================

/** Catalog 组件属性定义（JSON Schema 子集） */
export interface CatalogComponentSchema {
  type: string;
  description?: string;
  properties?: Record<string, any>;
  required?: string[];
  additionalProperties?: boolean;
}

/** Catalog 定义文档 */
export interface CatalogDefinition {
  catalogId: string;
  components?: Record<string, CatalogComponentSchema>;
  functions?: any[];
  theme?: Record<string, any>;
}

// ============================================================
// 解析结果
// ============================================================

export type ParseResultType =
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
  components: Map<string, ComponentDef>;
  rootId?: string;
  isReady: boolean;
  dataModel: DataModel;
  catalogId?: string;
  styles?: Record<string, any>;
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
  surfaces: Map<string, SurfaceState>;
  catalogs: Map<string, CatalogDefinition>;
  listeners: Set<() => void>;
}
