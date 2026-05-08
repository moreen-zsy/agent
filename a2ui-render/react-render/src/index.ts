/**
 * @a2ui/react
 * A2UI React 渲染器 - 将 A2UI v0.9 协议渲染为 React 组件
 */

// 从 core 重新导出类型和工具
export * from '@a2ui/core';

// React 渲染器
export { A2UIRenderer, VNodeRenderer } from './renderer.js';

// Hooks
export { useA2UI, useResolvedValue } from './hooks/useA2UI.js';
export { useCatalog } from './hooks/useCatalog.js';

// Catalog
export { standardCatalog, CatalogRegistry, defaultRegistry, STANDARD_CATALOG_ID } from './catalog/standard-catalog.js';

// 聊天消息渲染组件
export { A2UIChatMessage, type A2UIChatMessageProps } from './chat-message.js';

// 组件（可直接使用）
export * from './components/index.js';
