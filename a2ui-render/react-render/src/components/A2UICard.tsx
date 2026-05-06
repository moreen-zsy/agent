/**
 * A2UI Card 组件
 * Card 只有一个 child（单个子组件引用）
 */

import type { ReactNode } from 'react';

export interface CardProps {
  children?: ReactNode;
}

export function A2UICard({ children }: CardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#111]">
      {children}
    </div>
  );
}
