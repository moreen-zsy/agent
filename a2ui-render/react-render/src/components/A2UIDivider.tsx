/**
 * A2UI Divider 组件
 */

export interface DividerProps {
  axis?: 'horizontal' | 'vertical';
}

export function A2UIDivider({ axis = 'horizontal' }: DividerProps) {
  if (axis === 'vertical') {
    return <div className="w-px h-full bg-gray-300" />;
  }
  return <div className="h-px w-full bg-gray-300" />;
}
