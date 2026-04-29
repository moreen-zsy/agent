/**
 * A2UI React 组件通用类型
 */

import type { ReactNode } from 'react';
import type { A2UIStore } from '@a2ui/core';

/** 所有 A2UI 组件都接收的内部属性 */
export interface A2UIComponentProps {
  /** @internal Store 实例 */
  _store?: A2UIStore;
  /** @internal Surface ID */
  _surfaceId?: string;
  /** @internal 组件 ID */
  _componentId?: string;
  /** 子组件 */
  children?: ReactNode;
}

/** 组件 action 回调 */
export interface ActionProps {
  action?: {
    event?: { name: string; context?: any[] };
    functionCall?: { call: string; args?: Record<string, any> };
  };
}
