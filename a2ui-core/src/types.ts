/**
 * A2UI Core - 核心类型定义 (v0.9)
 * 严格对齐 specification/v0_9/ 标准协议
 */

// ============================================================
// DynamicValue - v0.9 统一值类型
// ============================================================

/** 数据绑定：引用数据模型中的值 */
export interface DataBinding {
  path: string;
}

/** 函数调用：在客户端执行本地函数 */
export interface FunctionCall {
  call: string;
  args?: Record<string, any>;
  returnType?: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'any' | 'void';
}

/** DynamicValue: 可以是字面量、数据绑定或函数调用 */
export type DynamicValue<T = any> = T | DataBinding | FunctionCall;

/** DynamicString: 字符串类型的 DynamicValue */
export type DynamicString = string | DataBinding | (FunctionCall & { returnType?: 'string' });

/** DynamicNumber: 数字类型的 DynamicValue */
export type DynamicNumber = number | DataBinding | (FunctionCall & { returnType?: 'number' });

/** DynamicBoolean: 布尔类型的 DynamicValue */
export type DynamicBoolean = boolean | DataBinding | (FunctionCall & { returnType?: 'boolean' });

/** DynamicStringList: 字符串数组类型的 DynamicValue */
export type DynamicStringList = string[] | DataBinding | (FunctionCall & { returnType?: 'array' });

// ============================================================
// ChildList - v0.9 子元素定义
// ============================================================

/** 显式子元素列表：静态 ID 数组 */
export type ExplicitChildList = string[];

/** 模板子元素：从数据模型动态生成 */
export interface TemplateChildList {
  componentId: string;
  path: string;
}

/** ChildList: 显式列表或模板 */
export type ChildList = ExplicitChildList | TemplateChildList;

// ============================================================
// Action 定义
// ============================================================

/** event: 派遣给服务器的事件 */
export interface EventAction {
  event: {
    name: string;
    context?: Record<string, DynamicValue>;
  };
}

/** functionCall: 在客户端执行的本地函数 */
export interface FunctionCallAction {
  functionCall: FunctionCall;
}

/** Action 定义：event 或 functionCall */
export type ActionDef = EventAction | FunctionCallAction;

// ============================================================
// CheckRule - 输入校验规则
// ============================================================

export interface CheckRule {
  condition: DynamicBoolean;
  message: string;
}

// ============================================================
// 组件定义 (v0.9 扁平格式)
// ============================================================

/**
 * 组件定义（v0.9 扁平格式）
 * - id: 唯一标识
 * - component: 组件类型名字符串
 * - 其他属性直接作为顶层键
 */
export interface ComponentDef {
  id: string;
  component: string;
  [key: string]: any;
}

// ============================================================
// 服务端 → 客户端消息 (v0.9)
// ============================================================

/** createSurface: 创建 Surface */
export interface CreateSurfaceMessage {
  version: 'v0.9';
  createSurface: {
    surfaceId: string;
    catalogId: string;
    theme?: Record<string, any>;
    sendDataModel?: boolean;
  };
}

/** updateComponents: 更新组件 */
export interface UpdateComponentsMessage {
  version: 'v0.9';
  updateComponents: {
    surfaceId: string;
    components: ComponentDef[];
  };
}

/** updateDataModel: 更新数据模型 */
export interface UpdateDataModelMessage {
  version: 'v0.9';
  updateDataModel: {
    surfaceId: string;
    path?: string;
    value?: any;
    data?: any;
  };
}

/** deleteSurface: 删除 Surface */
export interface DeleteSurfaceMessage {
  version: 'v0.9';
  deleteSurface: {
    surfaceId: string;
  };
}

/** 服务端 → 客户端消息联合类型 */
export type A2UIMessage =
  | CreateSurfaceMessage
  | UpdateComponentsMessage
  | UpdateDataModelMessage
  | DeleteSurfaceMessage;

// ============================================================
// 数据模型
// ============================================================

/** 数据模型（普通 JSON 对象） */
export interface DataModel {
  [key: string]: any;
}

// ============================================================
// 客户端 → 服务端消息 (v0.9)
// ============================================================

/** action: 用户交互事件 */
export interface ActionMessage {
  version: 'v0.9';
  action: {
    name: string;
    surfaceId: string;
    sourceComponentId: string;
    timestamp: string; // ISO 8601
    context: Record<string, any>;
  };
}

/** error: 客户端错误报告 */
export interface ClientErrorMessage {
  version: 'v0.9';
  error: {
    code: string;
    surfaceId: string;
    message: string;
    path?: string;
    [key: string]: any;
  };
}

/** 客户端 → 服务端消息联合类型 */
export type ClientToServerMessage = ActionMessage | ClientErrorMessage;

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
  | 'createSurface'
  | 'updateComponents'
  | 'updateDataModel'
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
  isReady: boolean;
  dataModel: DataModel;
  catalogId?: string;
  theme?: Record<string, any>;
  sendDataModel?: boolean;
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
