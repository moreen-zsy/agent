import { useState, useCallback, useRef } from 'react';
import { A2UIStore, A2UIParser } from '@a2ui/core';
import { A2UIRenderer } from '@a2ui/react-render';
import { JSONLInput } from './components/JSONLInput.js';
import { MessageLog } from './components/MessageLog.js';
import type { ParseResult } from '@a2ui/core';

const DEFAULT_STREAM = `{"surfaceUpdate": {"surfaceId": "main", "components": [{"id": "root", "component": {"Column": {"children": {"explicitList": ["profile_card"]}}}}]}}
{"surfaceUpdate": {"surfaceId": "main", "components": [{"id": "profile_card", "component": {"Card": {"child": "card_content"}}}]}}
{"surfaceUpdate": {"surfaceId": "main", "components": [{"id": "card_content", "component": {"Column": {"children": {"explicitList": ["header_row", "bio_text"]}}}}]}}
{"surfaceUpdate": {"surfaceId": "main", "components": [{"id": "header_row", "component": {"Row": {"alignment": "center", "children": {"explicitList": ["avatar", "name_column"]}}}}]}}
{"surfaceUpdate": {"surfaceId": "main", "components": [{"id": "avatar", "component": {"Image": {"url": {"literalString": "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"}, "usageHint": "avatar"}}}]}}
{"surfaceUpdate": {"surfaceId": "main", "components": [{"id": "name_column", "component": {"Column": {"alignment": "start", "children": {"explicitList": ["name_text", "handle_text"]}}}}]}}
{"surfaceUpdate": {"surfaceId": "main", "components": [{"id": "name_text", "component": {"Text": {"usageHint": "h3", "text": {"literalString": "A2A Fan"}}}}]}}
{"surfaceUpdate": {"surfaceId": "main", "components": [{"id": "handle_text", "component": {"Text": {"text": {"literalString": "@a2a_fan"}}}}]}}
{"surfaceUpdate": {"surfaceId": "main", "components": [{"id": "bio_text", "component": {"Text": {"text": {"literalString": "Building beautiful apps from a single codebase."}}}}]}}
{"dataModelUpdate": {"surfaceId": "main", "contents": []}}
{"beginRendering": {"surfaceId": "main", "root": "root"}}`;

export default function App() {
  const [store] = useState(() => new A2UIStore({
    onUserAction: (action) => {
      console.log('[Playground] UserAction:', action);
      alert(`UserAction: ${JSON.stringify(action, null, 2)}`);
    },
  }));
  const [messages, setMessages] = useState<ParseResult[]>([]);
  const [surfaceId, setSurfaceId] = useState<string>('main');
  const parserRef = useRef(new A2UIParser());

  const handleStream = useCallback((jsonl: string) => {
    const parser = parserRef.current;
    const results = parser.parseChunk(jsonl + '\n');
    const flush = parser.flush();
    if (flush) results.push(flush);

    setMessages((prev) => [...prev, ...results]);

    for (const result of results) {
      if (result.message) {
        store.processMessage(result.message);
        if ('beginRendering' in result.message) {
          setSurfaceId(result.message.beginRendering.surfaceId);
        }
      }
    }
  }, [store]);

  const handleReset = useCallback(() => {
    parserRef.current.reset();
    store.clearAll();
    setMessages([]);
  }, [store]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 左侧：输入面板 */}
      <div className="w-1/2 flex flex-col border-r border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-800">A2UI Playground v0.8</h1>
          <button
            onClick={handleReset}
            className="px-3 py-1 text-sm rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
          >
            重置
          </button>
        </div>
        <JSONLInput
          defaultValue={DEFAULT_STREAM}
          onStream={handleStream}
        />
        <MessageLog messages={messages} />
      </div>

      {/* 右侧：预览面板 */}
      <div className="w-1/2 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200 bg-white">
          <h2 className="text-lg font-semibold text-gray-800">预览</h2>
        </div>
        <div className="flex-1 p-6 overflow-auto">
          <div className="max-w-md mx-auto">
            <A2UIRenderer surfaceId={surfaceId} store={store} />
          </div>
        </div>
      </div>
    </div>
  );
}
