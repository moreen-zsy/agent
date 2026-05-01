/**
 * A2UI Tabs 组件 (v0.9)
 * tabItems → tabs
 */

import { useState, type ReactNode } from 'react';
import type { A2UIStore } from '@a2ui/core';

export interface TabItem {
  title: string;
  child: string;
}

export interface TabsProps {
  tabs: TabItem[];
  children?: ReactNode;
  _store?: A2UIStore;
  _surfaceId?: string;
  _componentId?: string;
  _rawProps?: Record<string, any>;
}

export function A2UITabs({ tabs, children, _store, _surfaceId, _componentId }: TabsProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const childArray = Array.isArray(children) ? children : [children];

  const handleSelect = (index: number) => {
    setActiveIndex(index);

    if (_store && _surfaceId && _componentId) {
      _store.sendUserAction({
        action: {
          name: 'tab_selected',
          surfaceId: _surfaceId,
          sourceComponentId: _componentId,
          timestamp: new Date().toISOString(),
          context: { selectedIndex: index, title: tabs[index]?.title },
        },
      });
    }
  };

  return (
    <div className="flex flex-col">
      <div className="flex border-b border-gray-200">
        {tabs.map((item, index) => (
          <button
            key={index}
            onClick={() => handleSelect(index)}
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
