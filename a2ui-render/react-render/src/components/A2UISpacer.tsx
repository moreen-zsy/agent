/**
 * A2UI Spacer 组件
 * 占位组件，用于调整布局间距
 */

import type { A2UIComponentProps } from './types.js';

export interface SpacerProps extends A2UIComponentProps {
  minLength?: number | { path: string };
}

export function A2UISpacer({ minLength = 8 }: SpacerProps) {
  const length = typeof minLength === 'number' ? minLength : 8;
  return <div style={{ minWidth: length, minHeight: length, flex: '1 1 auto' }} />;
}
