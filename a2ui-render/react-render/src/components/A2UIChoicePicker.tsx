/**
 * A2UI ChoicePicker 组件 (v0.9)
 * MultipleChoice → ChoicePicker，新 props:
 * - variant: multipleSelection | mutuallyExclusive
 * - options: { label, value }[]
 * - value: string[] (selected values)
 * - displayStyle: checkbox | chips
 * - filterable: boolean
 */

import { useState, useEffect } from 'react';
import type { A2UIStore } from '@a2ui/core';

export interface ChoicePickerProps {
  label?: string;
  variant?: 'multipleSelection' | 'mutuallyExclusive';
  options: { label: string; value: string }[];
  value: string[];
  displayStyle?: 'checkbox' | 'chips';
  filterable?: boolean;
  _store?: A2UIStore;
  _surfaceId?: string;
  _componentId?: string;
  _rawProps?: Record<string, any>;
}

export function A2UIChoicePicker({
  label,
  variant = 'mutuallyExclusive',
  options = [],
  value: propValue = [],
  displayStyle = 'checkbox',
  filterable,
  _store,
  _surfaceId,
  _componentId,
  _rawProps,
}: ChoicePickerProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(propValue));
  const [filter, setFilter] = useState('');

  useEffect(() => {
    setSelected(new Set(propValue));
  }, [propValue]);

  const filteredOptions = filterable && filter
    ? options.filter((o) => o.label.toLowerCase().includes(filter.toLowerCase()))
    : options;

  const toggle = (optionValue: string) => {
    let next: Set<string>;
    if (variant === 'mutuallyExclusive') {
      next = new Set(selected.has(optionValue) ? [] : [optionValue]);
    } else {
      next = new Set(selected);
      if (next.has(optionValue)) {
        next.delete(optionValue);
      } else {
        next.add(optionValue);
      }
    }
    setSelected(next);

    const rawValue = _rawProps?.value;
    if (_store && _surfaceId && _componentId && rawValue?.path) {
      const newArray = Array.from(next);
      _store.getDataStore().setValue(_surfaceId, rawValue.path, newArray);
      _store.sendUserAction({
        action: {
          name: 'choicePicker_changed',
          surfaceId: _surfaceId,
          sourceComponentId: _componentId,
          timestamp: new Date().toISOString(),
          context: { field: 'value', value: newArray },
        },
      });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {label && <span className="text-sm font-medium text-gray-700">{label}</span>}
      {filterable && (
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search..."
          className="rounded border border-gray-300 px-3 py-1 text-sm focus:border-blue-500 focus:outline-none"
        />
      )}
      {displayStyle === 'chips' ? (
        <div className="flex flex-wrap gap-2">
          {filteredOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => toggle(option.value)}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                selected.has(option.value)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredOptions.map((option) => (
            <label key={option.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type={variant === 'mutuallyExclusive' ? 'radio' : 'checkbox'}
                checked={selected.has(option.value)}
                onChange={() => toggle(option.value)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                name={variant === 'mutuallyExclusive' ? _componentId : undefined}
              />
              <span className="text-sm text-gray-700">{option.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
