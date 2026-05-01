/**
 * A2UI Switch 组件
 * 开关切换组件
 */

import { useState, useEffect } from 'react';
import type { A2UIComponentProps } from './types.js';

export interface SwitchProps extends A2UIComponentProps {
  value?: boolean;
}

export function A2UISwitch({ value = false, _store, _surfaceId, _componentId, _rawProps }: SwitchProps) {
  const [isOn, setIsOn] = useState(value);

  useEffect(() => {
    setIsOn(value);
  }, [value]);

  const handleToggle = () => {
    const newValue = !isOn;
    setIsOn(newValue);

    const rawValue = _rawProps?.value;
    if (_store && _surfaceId && _componentId && rawValue?.path) {
      _store.getDataStore().setValue(_surfaceId, rawValue.path, newValue);
      _store.sendUserAction({
        userAction: {
          name: 'switch_changed',
          surfaceId: _surfaceId,
          sourceComponentId: _componentId,
          timestamp: new Date().toISOString(),
          context: { field: 'value', value: newValue },
        },
      });
    }
  };

  return (
    <button
      onClick={handleToggle}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        isOn ? 'bg-blue-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          isOn ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}
