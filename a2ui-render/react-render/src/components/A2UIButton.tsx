/**
 * A2UI Button 组件 (v0.9)
 * variant: default | primary | borderless
 * action.event.context: Record<string, DynamicValue>
 */

import { type ReactNode } from 'react';
import type { A2UIComponentProps } from './types.js';

export interface ButtonProps extends A2UIComponentProps {
  child?: string;
  variant?: 'default' | 'primary' | 'borderless';
  action?: {
    event?: { name: string; context?: Record<string, any> };
    functionCall?: { call: string; args?: Record<string, any> };
  };
}

export function A2UIButton({ variant = 'default', action, children, _store, _surfaceId, _componentId }: ButtonProps) {
  const handleClick = () => {
    if (!_store || !_surfaceId || !_componentId) return;

    if (action?.functionCall) {
      console.log('[A2UI] functionCall:', action.functionCall);
    }

    if (action?.event) {
      // v0.9 context 已经是普通对象，值可能已解析
      const context = action.event.context ?? {};

      _store.sendUserAction({
        action: {
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
  let variantClass = 'bg-gray-200 text-gray-800 hover:bg-gray-300';
  if (variant === 'primary') {
    variantClass = 'bg-blue-600 text-white hover:bg-blue-700';
  } else if (variant === 'borderless') {
    variantClass = 'bg-transparent text-gray-700 hover:bg-gray-100';
  }

  return (
    <button className={`${baseClass} ${variantClass}`} onClick={handleClick}>
      {children}
    </button>
  );
}
