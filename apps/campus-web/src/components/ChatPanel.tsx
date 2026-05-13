/**
 * 通用 Chat 面板组件 (v0.9 + AGUI 中间件)
 * 支持点餐和校园助手两种模式
 *
 * 升级：消息级 A2UI + AgentConversation + SurfaceMessageBinder
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { A2UIStore, AgentConversation, SurfaceMessageBinder } from '@a2ui/core';
import { A2UIRenderer } from '@a2ui/react-render';
import { HttpAgent } from '@ag-ui/client';
import { A2UIMiddleware } from '@ag-ui/a2ui-middleware';
import { Send, X, MessageCircle } from 'lucide-react';
import { Streamdown } from 'streamdown';
import 'streamdown/styles.css';

interface ChatPanelProps {
  appType: 'food' | 'campus';
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  id: string;
  surfaceId?: string;
}

const AGENT_URL = 'http://localhost:3000/api/agent/stream';

// A2UI v0.9 inline catalog schema
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
    Carousel: { description: '轮播图' },
  },
};

function findAssistantAfterLastUser(prev: ChatMessage[]): number {
  let lastUserIdx = -1;
  for (let i = prev.length - 1; i >= 0; i--) {
    const m = prev[i];
    if (m && m.role === 'user') {
      lastUserIdx = i;
      break;
    }
  }
  for (let i = lastUserIdx + 1; i < prev.length; i++) {
    const m = prev[i];
    if (m && m.role === 'assistant') {
      return i;
    }
  }
  return -1;
}

export function ChatPanel({ appType }: ChatPanelProps) {
  const pendingUserActionRef = useRef<Record<string, any> | null>(null);

  // ========== @a2ui/core 层 ==========
  const [store] = useState(() => new A2UIStore({
    onUserAction: (action) => {
      pendingUserActionRef.current = action as any;
    },
  }));
  const [conversation] = useState(() => new AgentConversation());
  const [binder] = useState(() => new SurfaceMessageBinder());

  // ========== UI 状态 ==========
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ========== 临时状态（订阅事件处理） ==========
  const currentMsgIdRef = useRef<string>('');
  const currentToolCallRef = useRef<{ id: string; name: string; args: string } | null>(null);
  const toolCallNamesRef = useRef<Map<string, string>>(new Map());

  // ========== HttpAgent ==========
  const agent = useMemo(() => {
    const httpAgent = new HttpAgent({
      url: AGENT_URL,
      initialMessages: [],
    });
    const middleware = new A2UIMiddleware({
      schema: A2UI_CATALOG_SCHEMA,
      injectA2UITool: false,
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

  // ========== 订阅 AGUI 事件 ==========
  useEffect(() => {
    const unsubscribe = agent.subscribe({
      onRunStartedEvent: () => setIsLoading(true),
      onRunFinishedEvent: () => {
        currentMsgIdRef.current = '';
        currentToolCallRef.current = null;
        setIsLoading(false);
      },
      onRunErrorEvent: ({ event }) => {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `错误: ${(event as any).message}`, id: `err-${Date.now()}` },
        ]);
        setIsLoading(false);
      },
      onTextMessageStartEvent: () => {
        const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        currentMsgIdRef.current = msgId;
        setMessages((prev) => [...prev, { role: 'assistant', content: '', id: msgId }]);
      },
      onTextMessageContentEvent: ({ event }) => {
        const delta = (event as any).delta || '';
        conversation.addAssistantText(delta);

        setMessages((prev) => {
          if (currentMsgIdRef.current) {
            const idx = prev.findIndex((m) => m.id === currentMsgIdRef.current);
            if (idx !== -1) {
              const updated = [...prev];
              const msg = updated[idx]!;
              updated[idx] = { ...msg, content: msg.content + delta };
              return updated;
            }
          }
          const existingIdx = findAssistantAfterLastUser(prev);
          if (existingIdx !== -1) {
            const updated = [...prev];
            const msg = updated[existingIdx]!;
            updated[existingIdx] = { ...msg, content: msg.content + delta };
            return updated;
          }
          const msgId = `msg-${Date.now()}`;
          currentMsgIdRef.current = msgId;
          return [...prev, { role: 'assistant', content: delta, id: msgId }];
        });
      },
      onToolCallStartEvent: ({ event }) => {
        const tcId = (event as any).toolCallId;
        const tcName = (event as any).toolCallName;
        if (tcId && tcName) {
          currentToolCallRef.current = { id: tcId, name: tcName, args: '' };
          toolCallNamesRef.current.set(tcId, tcName);
        }
      },
      onToolCallArgsEvent: ({ event }) => {
        const tcId = (event as any).toolCallId;
        const delta = (event as any).delta || '';
        if (currentToolCallRef.current && currentToolCallRef.current.id === tcId) {
          currentToolCallRef.current.args += delta;
        }
      },
      onToolCallEndEvent: () => {
        const tc = currentToolCallRef.current;
        if (tc && tc.name !== 'render_a2ui' && tc.name !== 'generate_a2ui') {
          conversation.addToolCall(tc.id, tc.name, tc.args);
        }
        currentToolCallRef.current = null;
      },
      onToolCallResultEvent: ({ event }) => {
        const tcId = (event as any).toolCallId;
        const content = (event as any).content;
        const tcName = toolCallNamesRef.current.get(tcId);
        if (tcName === 'render_a2ui' || tcName === 'generate_a2ui') return;
        if (tcId) {
          conversation.addToolResult(tcId, typeof content === 'string' ? content : JSON.stringify(content));
        }
      },
      onActivitySnapshotEvent: ({ event }) => {
        const activityType = (event as any).activityType;
        if (activityType !== 'a2ui-surface') return;

        const operations = (event as any).content?.a2ui_operations;
        if (!Array.isArray(operations)) return;

        const createOp = operations.find((op: any) => op?.createSurface);
        const originalSurfaceId = createOp?.createSurface?.surfaceId;
        if (!originalSurfaceId) return;

        let msgId = currentMsgIdRef.current;
        if (!msgId) {
          msgId = `msg-${Date.now()}`;
          currentMsgIdRef.current = msgId;
          setMessages((prev) => [...prev, { role: 'assistant', content: '', id: msgId }]);
        }

        const uniqueSurfaceId = binder.bind(msgId, originalSurfaceId);
        const mappedOps = binder.mapOperations(operations, msgId);

        for (const op of mappedOps) {
          if (op) store.processMessage(op);
        }

        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === msgId);
          if (idx === -1) return prev;
          const updated = [...prev];
          const msg = updated[idx]!;
          updated[idx] = { ...msg, surfaceId: uniqueSurfaceId };
          return updated;
        });
      },
    });

    return () => { unsubscribe.unsubscribe(); };
  }, [agent, conversation, binder, store]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    conversation.addUserMessage(text);
    setMessages((prev) => [...prev, { role: 'user', content: text, id: `user-${Date.now()}` }]);
    setInput('');

    agent.addMessage({
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
    });

    const forwardedProps: Record<string, any> = {
      appType,
      conversationHistory: conversation.getHistoryForLLM(),
    };
    if (pendingUserActionRef.current) {
      forwardedProps.a2uiAction = pendingUserActionRef.current;
    }
    pendingUserActionRef.current = null;

    try {
      await agent.runAgent({ forwardedProps });
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `错误: ${(err as Error).message}`, id: `err-${Date.now()}` },
      ]);
      setIsLoading(false);
    }
  };

  // 组件卸载时清理所有 Surface
  useEffect(() => {
    return () => {
      for (const msg of messages) {
        if (msg.surfaceId) {
          store.clearSurface(msg.surfaceId);
        }
      }
    };
  }, []);

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

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] space-y-2 ${msg.role === 'user' ? '' : ''}`}>
                  {msg.role === 'user' ? (
                    <div className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm">
                      {msg.content}
                    </div>
                  ) : (
                    <>
                      {/* 文本内容在上方 */}
                      {msg.content ? (
                        <div className="bg-gray-100 text-gray-800 rounded-lg px-3 py-2 text-sm">
                          <Streamdown>{msg.content}</Streamdown>
                        </div>
                      ) : isLoading && !msg.surfaceId ? (
                        <div className="bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-500">
                          思考中...
                        </div>
                      ) : null}
                      {/* A2UI Surface 在下方 */}
                      {msg.surfaceId && (
                        <div className="rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm">
                          <A2UIRenderer surfaceId={msg.surfaceId} store={store} />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role === 'user' && (
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
