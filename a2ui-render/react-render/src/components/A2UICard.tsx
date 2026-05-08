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
    <div className="relative w-[200px] h-[200px] rounded-xl border border-white/10 bg-[#1a1a1a] shadow-lg overflow-hidden dark:border-white/10 dark:bg-[#1a1a1a] [&_img]:w-full [&_img]:h-full [&_img]:object-cover [&_img]:rounded-none [&_button]:absolute [&_button]:top-2 [&_button]:right-2 [&_button]:z-10 [&_button]:text-xs [&_button]:px-2 [&_button]:py-1 [&_button]:rounded-md">
      {children}
    </div>
  );
}
