import type { ParseResult } from '@a2ui/core';

interface MessageLogProps {
  messages: ParseResult[];
}

export function MessageLog({ messages }: MessageLogProps) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 p-4 bg-gray-50 flex items-center justify-center text-gray-400 text-sm">
        暂无消息，请在上方输入 JSONL
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 py-2 border-b border-gray-200 bg-gray-100 text-xs font-medium text-gray-600 flex justify-between">
        <span>消息日志</span>
        <span>{messages.length} 条</span>
      </div>
      <div className="flex-1 overflow-auto p-2 space-y-1">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`px-3 py-2 rounded text-xs font-mono ${
              msg.type === 'error'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-white border border-gray-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  msg.type === 'error'
                    ? 'bg-red-100 text-red-700'
                    : msg.type === 'createSurface'
                      ? 'bg-green-100 text-green-700'
                      : msg.type === 'updateDataModel'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                }`}
              >
                {msg.type}
              </span>
              {msg.error && <span className="text-red-500">{msg.error}</span>}
            </div>
            {msg.message && (
              <pre className="text-[10px] text-gray-500 overflow-x-auto">
                {JSON.stringify(msg.message).slice(0, 200)}
                {JSON.stringify(msg.message).length > 200 ? '...' : ''}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
