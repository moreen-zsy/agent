/**
 * A2UI CheckBox 组件
 */

import { useState, useEffect } from 'react';
import type { A2UIComponentProps } from './types.js';

export interface CheckBoxProps extends A2UIComponentProps {
  label: string;
  value: boolean;
}

export function A2UICheckBox({ label, value = false }: CheckBoxProps) {
  const [checked, setChecked] = useState(value);

  useEffect(() => {
    setChecked(value);
  }, [value]);

  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => setChecked(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}
