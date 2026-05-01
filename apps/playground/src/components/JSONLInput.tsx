import { useState, useCallback } from 'react';

interface JSONLInputProps {
  defaultValue?: string;
  onStream: (jsonl: string) => void;
}

export function JSONLInput({ defaultValue = '', onStream }: JSONLInputProps) {
  const [value, setValue] = useState(defaultValue);
  const [isSimulating, setIsSimulating] = useState(false);

  const handleSubmit = useCallback(() => {
    onStream(value);
  }, [value, onStream]);

  const handleSimulate = useCallback(() => {
    setIsSimulating(true);
    const lines = value.split('\n').filter((l) => l.trim());
    let index = 0;

    const sendNext = () => {
      if (index >= lines.length) {
        setIsSimulating(false);
        return;
      }
      onStream(lines[index] + '\n');
      index++;
      setTimeout(sendNext, 300);
    };

    sendNext();
  }, [value, onStream]);

  return (
    <div className="flex flex-col gap-3 p-4 bg-white">
      <label className="text-sm font-medium text-gray-700">JSONL 输入</label>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="flex-1 min-h-[200px] p-3 rounded border border-gray-300 font-mono text-xs focus:border-blue-500 focus:outline-none resize-y"
        placeholder='{"version": "v0.9", "updateComponents": {"surfaceId": "main", "components": [...]}}'
        spellCheck={false}
      />
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={isSimulating}
          className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
        >
          直接解析
        </button>
        <button
          onClick={handleSimulate}
          disabled={isSimulating}
          className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
        >
          {isSimulating ? '模拟中...' : '流式模拟'}
        </button>
      </div>
    </div>
  );
}
