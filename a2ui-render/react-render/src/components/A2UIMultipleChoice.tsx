/**
 * A2UI MultipleChoice 组件
 */

import { useState, useEffect } from 'react';

export interface MultipleChoiceProps {
  selections: string[];
  options: string[];
  maxAllowedSelections?: number;
  variant?: 'checkbox' | 'chips';
  filterable?: boolean;
}

export function A2UIMultipleChoice({
  selections = [],
  options = [],
  maxAllowedSelections,
  variant = 'checkbox',
}: MultipleChoiceProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(selections));

  useEffect(() => {
    setSelected(new Set(selections));
  }, [selections]);

  const toggle = (option: string) => {
    const next = new Set(selected);
    if (next.has(option)) {
      next.delete(option);
    } else if (!maxAllowedSelections || next.size < maxAllowedSelections) {
      next.add(option);
    }
    setSelected(next);
  };

  if (variant === 'chips') {
    return (
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => toggle(option)}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${
              selected.has(option)
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {options.map((option) => (
        <label key={option} className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={selected.has(option)}
            onChange={() => toggle(option)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">{option}</span>
        </label>
      ))}
    </div>
  );
}
