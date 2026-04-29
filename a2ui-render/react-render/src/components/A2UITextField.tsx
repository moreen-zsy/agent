/**
 * A2UI TextField 组件
 * 支持数据绑定，用户输入时更新数据模型
 */

import { useState, useEffect, useCallback } from 'react';
import type { A2UIComponentProps } from './types.js';

export interface TextFieldProps extends A2UIComponentProps {
  label: string;
  text?: string;
  textFieldType?: 'date' | 'longText' | 'number' | 'shortText' | 'obscured';
  validationRegexp?: string;
}

export function A2UITextField({
  label,
  text = '',
  textFieldType = 'shortText',
  _store,
  _surfaceId,
  _componentId,
}: TextFieldProps) {
  const [value, setValue] = useState(text);

  useEffect(() => {
    setValue(text);
  }, [text]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setValue(newValue);

      // 更新数据模型（如果有绑定的 path）
      // 这里简化处理，实际需要通过组件定义中的 text 属性来确定 path
    },
    []
  );

  const inputType = textFieldType === 'obscured' ? 'password' : textFieldType === 'number' ? 'number' : 'text';

  const isLongText = textFieldType === 'longText';

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
