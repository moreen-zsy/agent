/**
 * A2UI Column 组件（垂直布局）(v0.9)
 * mainAxisAlignment/crossAxisAlignment → justify/align
 */

import type { ReactNode } from 'react';

export interface ColumnProps {
  children?: ReactNode;
  justify?: 'start' | 'center' | 'end' | 'spaceBetween' | 'spaceAround' | 'spaceEvenly' | 'stretch';
  align?: 'start' | 'center' | 'end' | 'stretch';
}

const JUSTIFY_MAP: Record<string, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  spaceBetween: 'justify-between',
  spaceAround: 'justify-around',
  spaceEvenly: 'justify-evenly',
  stretch: 'justify-stretch',
};

const ALIGN_MAP: Record<string, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

export function A2UIColumn({ children, justify = 'start', align = 'stretch' }: ColumnProps) {
  const justifyClass = JUSTIFY_MAP[justify] || 'justify-start';
  const alignClass = ALIGN_MAP[align] || 'items-stretch';
  return (
    <div className={`flex flex-col ${justifyClass} ${alignClass} gap-2`}>
      {children}
    </div>
  );
}
