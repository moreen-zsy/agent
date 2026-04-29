/**
 * A2UI Column 组件（垂直布局）
 */

import type { ReactNode } from 'react';

export interface ColumnProps {
  children?: ReactNode;
  distribution?: 'start' | 'center' | 'end' | 'spaceAround' | 'spaceBetween' | 'spaceEvenly';
  alignment?: 'start' | 'center' | 'end' | 'stretch';
}

const DIST_MAP: Record<string, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  spaceAround: 'justify-around',
  spaceBetween: 'justify-between',
  spaceEvenly: 'justify-evenly',
};

const ALIGN_MAP: Record<string, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

export function A2UIColumn({ children, distribution = 'start', alignment = 'stretch' }: ColumnProps) {
  const distClass = DIST_MAP[distribution] || 'justify-start';
  const alignClass = ALIGN_MAP[alignment] || 'items-stretch';
  return (
    <div className={`flex flex-col ${distClass} ${alignClass} gap-2`}>
      {children}
    </div>
  );
}
