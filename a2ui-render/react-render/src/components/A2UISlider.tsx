/**
 * A2UI Slider 组件
 */

import { useState, useEffect } from 'react';

export interface SliderProps {
  value: number;
  minValue?: number;
  maxValue?: number;
}

export function A2UISlider({ value = 0, minValue = 0, maxValue = 100 }: SliderProps) {
  const [current, setCurrent] = useState(value);

  useEffect(() => {
    setCurrent(value);
  }, [value]);

  return (
    <input
      type="range"
      min={minValue}
      max={maxValue}
      value={current}
      onChange={(e) => setCurrent(Number(e.target.value))}
      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
    />
  );
}
