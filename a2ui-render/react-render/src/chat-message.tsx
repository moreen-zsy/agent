/**
 * A2UI 聊天消息渲染组件
 * 组合 A2UI Surface 渲染 + 文本内容渲染
 */

import type { ReactNode } from 'react';
import type { A2UIStore } from '@a2ui/core';
import { A2UIRenderer } from './renderer.js';

export interface A2UIChatMessageProps {
  /** 消息唯一标识 */
  messageId: string;
  /** 关联的 A2UI Surface ID（可选） */
  surfaceId?: string;
  /** 消息文本内容 */
  content?: string;
  /** A2UI Store 实例 */
  store: A2UIStore;
  /** 是否正在加载中 */
  isLoading?: boolean;
  /** 自定义文本渲染插槽（默认显示纯文本） */
  textRenderer?: (content: string) => ReactNode;
  /** 自定义 loading 渲染 */
  loadingRenderer?: () => ReactNode;
  /** 外层容器 className */
  className?: string;
}

/**
 * 单条聊天消息渲染器
 * 头部渲染 A2UI Surface（如果存在），下方渲染文本内容
 */
export function A2UIChatMessage({
  surfaceId,
  content,
  store,
  isLoading,
  textRenderer,
  loadingRenderer,
  className = '',
}: A2UIChatMessageProps) {
  return (
    <div className={`a2ui-chat-message ${className}`}>
      {/* A2UI Surface 渲染区域 */}
      {surfaceId && (
        <div className="a2ui-chat-message__surface">
          <A2UIRenderer surfaceId={surfaceId} store={store} />
        </div>
      )}

      {/* 文本内容区域 */}
      {content ? (
        <div className="a2ui-chat-message__text">
          {textRenderer ? textRenderer(content) : content}
        </div>
      ) : isLoading ? (
        <div className="a2ui-chat-message__loading">
          {loadingRenderer ? loadingRenderer() : '思考中...'}
        </div>
      ) : null}
    </div>
  );
}
