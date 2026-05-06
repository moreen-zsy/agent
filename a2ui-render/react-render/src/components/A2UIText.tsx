/**
 * A2UI Text 组件
 */

import type { A2UIComponentProps } from './types.js';

export interface TextProps extends A2UIComponentProps {
  text: string;
  usageHint?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'caption' | 'body';
}

const USAGE_HINT_MAP: Record<string, string> = {
  h1: 'text-3xl font-bold dark:text-white',
  h2: 'text-2xl font-bold dark:text-white',
  h3: 'text-xl font-semibold dark:text-white',
  h4: 'text-lg font-semibold dark:text-white',
  h5: 'text-base font-medium dark:text-white',
  caption: 'text-sm text-gray-500 dark:text-white/50',
  body: 'text-base dark:text-white/90',
};

export function A2UIText({ text, usageHint = 'body' }: TextProps) {
  const className = USAGE_HINT_MAP[usageHint] || USAGE_HINT_MAP.body;
  return <span className={className}>{text}</span>;
}
