/**
 * A2UI Button 组件
 */

import { type ReactNode } from 'react';
import type { A2UIComponentProps } from './types.js';

export interface ButtonProps extends A2UIComponentProps {
  child?: string; // 子组件 ID（由 TreeBuilder 处理，这里直接使用 children）
  primary?: boolean;
  action?: {
    event?: { name: string; context?: any[] };
    functionCall?: { call: string; args?: Record<string, any> };
  };
}

export function A2UIButton({ primary, action, children, _store, _surfaceId, _componentId }: ButtonProps) {
  const handleClick = () => {
    if (!_store || !_surfaceId || !_componentId) return;

    if (action?.functionCall) {
      // 本地函数调用（由应用层处理）
      console.log('[A2UI] functionCall:', action.functionCall);
    }

    if (action?.event) {
      // 构造 userAction 并发送
      const context: Record<string, any> = {};
      if (action.event.context) {
        for (const item of action.event.context) {
          if (item.key && item.value) {
            context[item.key] = _store.getDataStore().resolveBoundValue(_surfaceId, item.value);
          }
        }
      }

      _store.sendUserAction({
        userAction: {
          name: action.event.name,
          surfaceId: _surfaceId,
          sourceComponentId: _componentId,
          timestamp: new Date().toISOString(),
          context,
        },
      });
    }
  };

  const baseClass = 'px-4 py-2 rounded font-medium transition-colors';
  const variantClass = primary
    ? 'bg-blue-600 text-white hover:bg-blue-700'
    : 'bg-gray-200 text-gray-800 hover:bg-gray-300';

  return (
    <button className={`${baseClass} ${variantClass}`} onClick={handleClick}>
      {children}
    </button>
  );
}
