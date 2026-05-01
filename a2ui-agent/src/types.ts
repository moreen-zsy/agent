/**
 * A2UI Agent 内部类型
 * 基于 AGUI 协议规范
 */

import type { Message, Tool } from '@ag-ui/core';

export type AppType = 'food' | 'campus';

export interface AgentInput {
  /** AGUI 标准消息格式 */
  messages: Message[];
  appType: AppType;
  catalogId?: string;
  forwardedProps?: Record<string, any>;
  threadId?: string;
  /** 中间件注入的上下文（如 A2UI schema） */
  context?: Record<string, any>;
  /** 中间件注入的工具（如 render_a2ui） */
  tools?: Record<string, Tool>;
}
