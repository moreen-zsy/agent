/**
 * A2UI Chip 组件
 * 标签芯片组件
 */

import type { A2UIComponentProps } from './types.js';

export interface ChipProps extends A2UIComponentProps {
  text?: string;
  selected?: boolean;
}

export function A2UIChip({ text = '', selected = false }: ChipProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium transition-colors ${
        selected
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-700'
      }`}
    >
      {text}
    </span>
  );
}
