/**
 * Agent 实时测试面板 — 逐步排查版
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { A2UIStore } from '@a2ui/core';
import { A2UIRenderer } from '@a2ui/react-render';
import { HttpAgent } from '@ag-ui/client';
import { A2UIMiddleware } from '@ag-ui/a2ui-middleware';
import { Send, Bot, User } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const AGENT_URL = 'http://localhost:3000/api/agent/stream';

const A2UI_CATALOG_SCHEMA = {
  catalogId: 'https://a2ui.org/specification/v0_9/basic_catalog.json',
  components: {
    Text: { description: '文本组件' },
    Image: { description: '图片组件' },
    Icon: { description: '图标组件' },
    Button: { description: '按钮组件' },
    TextField: { description: '文本输入框' },
    CheckBox: { description: '复选框' },
    ChoicePicker: { description: '选择器' },
    Slider: { description: '滑块' },
    Row: { description: '水平布局' },
    Column: { description: '垂直布局' },
    List: { description: '列表' },
    Card: { description: '卡片' },
    Tabs: { description: '标签页' },
    Modal: { description: '模态框' },
    Divider: { description: '分隔线' },
    Spacer: { description: '占位空间' },
    Switch: { description: '开关' },
    Chip: { description: '标签芯片' },
  },
};

export function AgentTest() {
  const pendingUserActionRef = useRef<Record<string, any> | null>(null);

  const [store] = useState(() => new A2UIStore({
    onUserAction: (action) => {
      console.log('[AgentTest] Action:', action);
      pendingUserActionRef.current = action;
    },
  }));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [appType, setAppType] = useState<'food' | 'campus'>('food');
  const [surfaceId, setSurfaceId] = useState<string>('chat-surface');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const agent = useMemo(() => {
    const httpAgent = new HttpAgent({ url: AGENT_URL });
    const middleware = new A2UIMiddleware({
      schema: A2UI_CATALOG_SCHEMA,
      injectA2UITool: true,
      a2uiToolNames: ['render_a2ui'],
    });
    httpAgent.use(middleware);
    return httpAgent;
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const unsubscribe = agent.subscribe({
      onRunStartedEvent: () => setIsLoading(true),
      onRunFinishedEvent: () => setIsLoading(false),
      onRunErrorEvent: ({ event }) => {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `错误: ${(event as any).message}` },
        ]);
        setIsLoading(false);
      },
      onTextMessageStartEvent: () => {
        setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
      },
      onTextMessageContentEvent: ({ event }) => {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, content: last.content + (event as any).delta }];
          }
          return [...prev, { role: 'assistant', content: (event as any).delta }];
        });
      },
      onActivitySnapshotEvent: ({ event }) => {
        const activityType = (event as any).activityType;
        if (activityType === 'a2ui-surface') {
          const operations = (event as any).content?.a2ui_operations;
          if (Array.isArray(operations)) {
            for (const msg of operations) {
              if (!msg) continue;
              store.processMessage(msg);
              if ('createSurface' in msg) {
                setSurfaceId(msg.createSurface.surfaceId);
              }
            }
          }
        }
      },
    });

    return () => { unsubscribe.unsubscribe(); };
  }, [agent, store]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');

    agent.addMessage({
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
    });

    const forwardedProps: Record<string, any> = { appType };
    if (pendingUserActionRef.current) {
      forwardedProps.a2uiAction = pendingUserActionRef.current;
    }
    pendingUserActionRef.current = null;

    try {
      await agent.runAgent({ forwardedProps });
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `错误: ${(err as Error).message}` },
      ]);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full bg-gray-50">
      {/* 左侧：对话面板 */}
      <div className="w-1/2 flex flex-col border-r border-gray-200 bg-white">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-600" />
            <h1 className="text-lg font-semibold text-gray-800">Agent 实时测试</h1>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={appType}
              onChange={(e) => setAppType(e.target.value as 'food' | 'campus')}
              className="text-sm border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:border-blue-500"
            >
              <option value="food">点餐模式</option>
              <option value="campus">校园模式</option>
            </select>
          </div>
        </div>

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Bot className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">输入消息开始测试 Agent 流式响应</p>
              <p className="text-xs mt-1 opacity-60">当前模型: kimi-latest</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex items-start gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'user' ? 'bg-blue-600' : 'bg-green-600'
                }`}>
                  {msg.role === 'user' ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-white" />
                  )}
                </div>
                <div className={`rounded-lg px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {msg.content || (msg.role === 'assistant' && isLoading && i === messages.length - 1 ? '思考中...' : '')}
                </div>
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex justify-start">
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-500">
                  思考中...
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入框 */}
        <div className="border-t p-3 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
            placeholder="输入消息..."
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 text-white rounded-lg px-3 py-2 hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 右侧：A2UI 渲染预览 */}
      <div className="w-1/2 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">A2UI 渲染预览</h2>
          <p className="text-xs text-gray-500 mt-0.5">Agent 返回的 v0.9 组件将在这里实时渲染</p>
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
