/**
 * A2UI Row 组件（水平布局）
 */

import type { ReactNode } from 'react';

export interface RowProps {
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

export function A2UIRow({ children, distribution = 'start', alignment = 'center' }: RowProps) {
  const distClass = DIST_MAP[distribution] || 'justify-start';
  const alignClass = ALIGN_MAP[alignment] || 'items-center';
  return (
    <div className={`flex flex-row ${distClass} ${alignClass} gap-2`}>
      {children}
    </div>
  );
}
