/**
 * A2UI CheckBox 组件
 */

import { useState, useEffect } from 'react';
import type { A2UIComponentProps } from './types.js';

export interface CheckBoxProps extends A2UIComponentProps {
  label: string;
  value: boolean;
}

export function A2UICheckBox({ label, value = false, _store, _surfaceId, _componentId, _rawProps }: CheckBoxProps) {
  const [checked, setChecked] = useState(value);

  useEffect(() => {
    setChecked(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.checked;
    setChecked(newValue);

    const rawValue = _rawProps?.value;
    if (_store && _surfaceId && _componentId && rawValue?.path) {
      _store.getDataStore().setValue(_surfaceId, rawValue.path, newValue);
      _store.sendUserAction({
        userAction: {
          name: 'checkbox_changed',
          surfaceId: _surfaceId,
          sourceComponentId: _componentId,
          timestamp: new Date().toISOString(),
          context: { field: 'value', value: newValue },
        },
      });
    }
  };

  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={handleChange}
        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}
