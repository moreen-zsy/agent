import { useState, useCallback, useRef } from 'react';
import { A2UIStore, A2UIParser } from '@a2ui/core';
import { A2UIRenderer } from '@a2ui/react-render';
import { JSONLInput } from './components/JSONLInput.js';
import { MessageLog } from './components/MessageLog.js';
import type { ParseResult } from '@a2ui/core';

const DEFAULT_STREAM = `{"version": "v0.9", "createSurface": {"surfaceId": "main", "theme": "light", "sendDataModel": true}}
{"version": "v0.9", "updateComponents": {"surfaceId": "main", "components": [{"id": "root", "component": "Column", "children": ["profile_card"]}]}}
{"version": "v0.9", "updateComponents": {"surfaceId": "main", "components": [{"id": "profile_card", "component": "Card", "child": "card_content"}]}}
{"version": "v0.9", "updateComponents": {"surfaceId": "main", "components": [{"id": "card_content", "component": "Column", "children": ["header_row", "bio_text"]}]}}
{"version": "v0.9", "updateComponents": {"surfaceId": "main", "components": [{"id": "header_row", "component": "Row", "justify": "center", "children": ["avatar", "name_column"]}]}}
{"version": "v0.9", "updateComponents": {"surfaceId": "main", "components": [{"id": "avatar", "component": "Image", "url": "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix", "usageHint": "avatar"}]}}
{"version": "v0.9", "updateComponents": {"surfaceId": "main", "components": [{"id": "name_column", "component": "Column", "justify": "start", "children": ["name_text", "handle_text"]}]}}
{"version": "v0.9", "updateComponents": {"surfaceId": "main", "components": [{"id": "name_text", "component": "Text", "text": "A2A Fan"}]}}
{"version": "v0.9", "updateComponents": {"surfaceId": "main", "components": [{"id": "handle_text", "component": "Text", "text": "@a2a_fan"}]}}
{"version": "v0.9", "updateComponents": {"surfaceId": "main", "components": [{"id": "bio_text", "component": "Text", "text": "Building beautiful apps from a single codebase."}]}}
{"version": "v0.9", "updateDataModel": {"surfaceId": "main", "path": "/user", "value": {"name": "A2A Fan", "handle": "@a2a_fan"}}}`;

export default function App() {
  const [store] = useState(() => new A2UIStore({
    onUserAction: (action) => {
      console.log('[Playground] Action:', action);
      alert(`Action: ${JSON.stringify(action, null, 2)}`);
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
        if ('createSurface' in result.message) {
          setSurfaceId(result.message.createSurface.surfaceId);
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
          <h1 className="text-lg font-semibold text-gray-800">A2UI Playground v0.9</h1>
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
