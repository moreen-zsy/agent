/**
 * A2UI Image 组件 (v0.9)
 * 支持 variant: icon | avatar | smallFeature | mediumFeature | largeFeature | header
 * 兼容旧版 usageHint
 */

import type { A2UIComponentProps } from './types.js';

export interface ImageProps extends A2UIComponentProps {
  url: string;
  fit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  variant?: 'icon' | 'avatar' | 'smallFeature' | 'mediumFeature' | 'largeFeature' | 'header';
  usageHint?: 'icon' | 'avatar' | 'smallFeature' | 'mediumFeature' | 'largeFeature' | 'header';
}

const FIT_MAP: Record<string, string> = {
  contain: 'object-contain',
  cover: 'object-cover',
  fill: 'object-fill',
  none: 'object-none',
  'scale-down': 'object-scale-down',
};

const VARIANT_MAP: Record<string, string> = {
  icon: 'w-6 h-6',
  avatar: 'w-10 h-10 rounded-full',
  smallFeature: 'w-24 h-24',
  mediumFeature: 'w-48 h-48',
  largeFeature: 'w-96 h-96',
  header: 'w-full h-48',
};

export function A2UIImage({ url, fit = 'cover', variant, usageHint }: ImageProps) {
  const fitClass = FIT_MAP[fit] || 'object-cover';
  const sizeKey = variant || usageHint || '';
  const sizeClass = VARIANT_MAP[sizeKey] || 'w-full h-auto';

  return <img src={url} alt="" className={`${fitClass} ${sizeClass} rounded-lg`} />;
}
