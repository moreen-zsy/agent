/**
 * A2UI Image 组件
 */

import type { A2UIComponentProps } from './types.js';

export interface ImageProps extends A2UIComponentProps {
  url: string;
  fit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  usageHint?: 'icon' | 'avatar' | 'smallFeature' | 'mediumFeature' | 'largeFeature' | 'header';
}

const FIT_MAP: Record<string, string> = {
  contain: 'object-contain',
  cover: 'object-cover',
  fill: 'object-fill',
  none: 'object-none',
  'scale-down': 'object-scale-down',
};

export function A2UIImage({ url, fit = 'cover', usageHint }: ImageProps) {
  const fitClass = FIT_MAP[fit] || 'object-cover';

  let sizeClass = '';
  switch (usageHint) {
    case 'icon':
      sizeClass = 'w-6 h-6';
      break;
    case 'avatar':
      sizeClass = 'w-10 h-10 rounded-full';
      break;
    case 'smallFeature':
      sizeClass = 'w-24 h-24';
      break;
    case 'mediumFeature':
      sizeClass = 'w-48 h-48';
      break;
    case 'largeFeature':
      sizeClass = 'w-96 h-96';
      break;
    case 'header':
      sizeClass = 'w-full h-48';
      break;
    default:
      sizeClass = 'w-full h-auto';
  }

  return <img src={url} alt="" className={`${fitClass} ${sizeClass}`} />;
}
