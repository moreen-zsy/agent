/**
 * A2UI Tabs 组件
 */

import { useState, type ReactNode } from 'react';

export interface TabItem {
  title: string;
  child: string; // 子组件 ID
}

export interface TabsProps {
  tabItems: TabItem[];
  children?: ReactNode;
}

export function A2UITabs({ tabItems, children }: TabsProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  // tabItems 中的 child 是组件 ID，由 TreeBuilder 解析为 children
  // 这里的 children 是已渲染的子组件数组
  const childArray = Array.isArray(children) ? children : [children];

  return (
    <div className="flex flex-col">
      <div className="flex border-b border-gray-200">
        {tabItems.map((item, index) => (
          <button
            key={index}
            onClick={() => setActiveIndex(index)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              index === activeIndex
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {item.title}
          </button>
        ))}
      </div>
      <div className="p-4">
        {childArray[activeIndex]}
      </div>
    </div>
  );
}
