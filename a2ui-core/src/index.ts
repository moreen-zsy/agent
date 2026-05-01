/**
 * @a2ui/core
 * A2UI 核心 SDK - 协议解析、状态管理、树构建
 * 严格对齐 A2UI v0.9 标准协议
 */

export * from './types.js';
export { A2UIParser } from './parser.js';
export { A2UIBuffer } from './buffer.js';
export { TreeBuilder } from './tree-builder.js';
export { A2UIStore } from './store.js';
export { DataModelStore } from './data-model.js';

// Zod Catalog 系统
export {
  defineCatalog,
  validateComponent,
  validateComponents,
  standardCatalogV09,
  type A2UICatalog,
  type CatalogComponentDef,
  type ValidationResult,
  type InferComponentProps,
  type InferComponentNames,
} from './catalog.js';

// 状态管理抽象层（框架无关）
export {
  createZustandNotifier,
  createAdapterNotifier,
  createZustandStoreAdapter,
  createMemoryNotifier,
  type A2UIStoreNotifier,
  type StoreAdapterConfig,
} from './state-store.js';
