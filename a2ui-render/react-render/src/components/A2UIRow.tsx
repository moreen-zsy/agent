/**
 * A2UI Row 组件（水平布局）(v0.9)
 * mainAxisAlignment/crossAxisAlignment → justify/align
 */

import type { ReactNode } from 'react';

export interface RowProps {
  children?: ReactNode;
  justify?: 'center' | 'end' | 'spaceAround' | 'spaceBetween' | 'spaceEvenly' | 'start' | 'stretch';
  align?: 'start' | 'center' | 'end' | 'stretch';
}

const JUSTIFY_MAP: Record<string, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  spaceAround: 'justify-around',
  spaceBetween: 'justify-between',
  spaceEvenly: 'justify-evenly',
  stretch: 'justify-stretch',
};

const ALIGN_MAP: Record<string, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

export function A2UIRow({ children, justify = 'start', align = 'center' }: RowProps) {
  const justifyClass = JUSTIFY_MAP[justify] || 'justify-start';
  const alignClass = ALIGN_MAP[align] || 'items-center';
  return (
    <div className={`flex flex-row ${justifyClass} ${alignClass} gap-2`}>
      {children}
    </div>
  );
}
