/**
 * 通用 Chat 面板组件 (v0.9 + AGUI 中间件)
 * 支持点餐和校园助手两种模式
 *
 * 使用 AGUI 协议作为传输层：
 * - HttpAgent.subscribe() 持久订阅事件流
 * - agent.addMessage() + agent.runAgent() 发送消息
 * - A2UIMiddleware 注入 schema/tool，渐进式解析 v0.9 tool call
 * - 订阅者回调处理 AGUI 事件
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { A2UIStore } from '@a2ui/core';
import { A2UIRenderer } from '@a2ui/react-render';
import { HttpAgent } from '@ag-ui/client';
import { A2UIMiddleware } from '@ag-ui/a2ui-middleware';
import { Send, X, MessageCircle } from 'lucide-react';

interface ChatPanelProps {
  appType: 'food' | 'campus';
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const AGENT_URL = 'http://localhost:3000/api/agent/stream';

// A2UI v0.9 inline catalog schema（简化版，供中间件注入）
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

export function ChatPanel({ appType }: ChatPanelProps) {
  // 暂存待发送的 UserAction，下次发消息时通过 forwardedProps 传递
  const pendingUserActionRef = useRef<Record<string, any> | null>(null);

  const [store] = useState(() => new A2UIStore({
    onUserAction: (action) => {
      // 暂存 UserAction，等待用户下次发送消息时一起传递
      pendingUserActionRef.current = action;
    },
  }));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 使用 useMemo 保持 Agent 实例稳定
  const agent = useMemo(() => {
    const httpAgent = new HttpAgent({
      url: AGENT_URL,
    });

    // 附加 A2UIMiddleware：注入 v0.9 schema 和 render_a2ui tool
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

  // 注册持久订阅，处理 AGUI 事件流
  useEffect(() => {
    const unsubscribe = agent.subscribe({
      onRunStartedEvent: () => {
        setIsLoading(true);
      },
      onRunFinishedEvent: () => {
        setIsLoading(false);
      },
      onRunErrorEvent: ({ event }) => {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `错误: ${(event as any).message}` },
        ]);
        setIsLoading(false);
      },
      onTextMessageStartEvent: () => {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: '' },
        ]);
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
              if (msg) store.processMessage(msg);
            }
          }
        }
      },
    });

    return () => {
      unsubscribe.unsubscribe();
    };
  }, [agent, store]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    // 将用户消息添加到 Agent 的对话历史中
    agent.addMessage({
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
    });

    // 通过 forwardedProps 传递 appType 和 pending UserAction
    const forwardedProps: Record<string, any> = {
      appType,
    };
    if (pendingUserActionRef.current) {
      forwardedProps.a2uiAction = pendingUserActionRef.current;
    }

    // 发送后清空 pending UserAction
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
    <>
      {/* 浮动按钮 */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 right-4 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 transition-colors z-50"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Chat 面板 */}
      {isOpen && (
        <div className="fixed inset-x-0 bottom-0 top-0 bg-white flex flex-col z-50 md:inset-auto md:right-4 md:bottom-4 md:top-auto md:w-96 md:h-[600px] md:rounded-xl md:shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-blue-600 text-white rounded-t-xl">
            <span className="font-medium">{appType === 'food' ? '智能点餐助手' : '校园智能助手'}</span>
            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-blue-700 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages + A2UI 渲染 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* A2UI 渲染区域 */}
            <A2UIRenderer surfaceId="chat-surface" store={store} />

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-500">
                  思考中...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
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
      )}
    </>
  );
}
