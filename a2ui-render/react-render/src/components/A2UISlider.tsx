/**
 * A2UI Slider 组件 (v0.9)
 * minValue/maxValue → min/max
 */

import { useState, useEffect } from 'react';
import type { A2UIStore } from '@a2ui/core';

export interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  _store?: A2UIStore;
  _surfaceId?: string;
  _componentId?: string;
  _rawProps?: Record<string, any>;
}

export function A2UISlider({ value = 0, min = 0, max = 100, _store, _surfaceId, _componentId, _rawProps }: SliderProps) {
  const [current, setCurrent] = useState(value);

  useEffect(() => {
    setCurrent(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(e.target.value);
    setCurrent(newValue);

    const rawValue = _rawProps?.value;
    if (_store && _surfaceId && _componentId && rawValue?.path) {
      _store.getDataStore().setValue(_surfaceId, rawValue.path, newValue);
      _store.sendUserAction({
        action: {
          name: 'slider_changed',
          surfaceId: _surfaceId,
          sourceComponentId: _componentId,
          timestamp: new Date().toISOString(),
          context: { field: 'value', value: newValue },
        },
      });
    }
  };

  return (
    <input
      type="range"
      min={min}
      max={max}
      value={current}
      onChange={handleChange}
      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
    />
  );
}
