/**
 * A2UI TextField 组件 (v0.9)
 * value 替代 text，variant 替代 textFieldType
 */

import { useState, useEffect, useCallback } from 'react';
import type { A2UIComponentProps } from './types.js';

export interface TextFieldProps extends A2UIComponentProps {
  label: string;
  value?: string;
  variant?: 'longText' | 'number' | 'shortText' | 'obscured';
  validationRegexp?: string;
}

export function A2UITextField({
  label,
  value: propValue = '',
  variant = 'shortText',
  _store,
  _surfaceId,
  _componentId,
  _rawProps,
}: TextFieldProps) {
  const [value, setValue] = useState(propValue);

  useEffect(() => {
    setValue(propValue);
  }, [propValue]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setValue(newValue);

      const rawValue = _rawProps?.value;
      if (_store && _surfaceId && _componentId && rawValue?.path) {
        _store.getDataStore().setValue(_surfaceId, rawValue.path, newValue);
        _store.sendUserAction({
          action: {
            name: 'textField_changed',
            surfaceId: _surfaceId,
            sourceComponentId: _componentId,
            timestamp: new Date().toISOString(),
            context: { field: 'value', value: newValue },
          },
        });
      }
    },
    [_store, _surfaceId, _componentId, _rawProps]
  );

  const inputType = variant === 'obscured' ? 'password' : variant === 'number' ? 'number' : 'text';
  const isLongText = variant === 'longText';

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {isLongText ? (
        <textarea
          value={value}
          onChange={handleChange}
          className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          rows={3}
        />
      ) : (
        <input
          type={inputType}
          value={value}
          onChange={handleChange}
          className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      )}
    </div>
  );
}
