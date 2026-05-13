/**
 * Agent 实时测试面板 — 重构版
 * 核心逻辑抽离到 @a2ui/core (AgentConversation, SurfaceMessageBinder)
 * 和 @a2ui/react-render (A2UIChatMessage)
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { A2UIStore, AgentConversation, SurfaceMessageBinder } from '@a2ui/core';
import { A2UIRenderer } from '@a2ui/react-render';
import { HttpAgent } from '@ag-ui/client';
import { A2UIMiddleware } from '@ag-ui/a2ui-middleware';
import { useAuth } from '../context/AuthContext.js';
import { LoginModal } from './LoginModal.js';
import { Send, Bot, User, LogIn, LogOut } from 'lucide-react';
import { Streamdown } from 'streamdown';
import 'streamdown/styles.css';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  id: string;
  surfaceId?: string;
}

const AGENT_URL = 'http://localhost:3000/api/agent/stream';

// 辅助函数：找到最后一条 user 消息之后的第一条 assistant 消息的索引
function findAssistantAfterLastUser(prev: ChatMessage[]): number {
  let lastUserIdx = -1;
  for (let i = prev.length - 1; i >= 0; i--) {
    if (prev[i].role === 'user') {
      lastUserIdx = i;
      break;
    }
  }
  for (let i = lastUserIdx + 1; i < prev.length; i++) {
    if (prev[i].role === 'assistant') {
      return i;
    }
  }
  return -1;
}

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

export function AgentTest() {
  const pendingUserActionRef = useRef<Record<string, any> | null>(null);
  const { token, user, isLoggedIn, login, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  // ========== @a2ui/core 层 ==========
  const [store] = useState(() => new A2UIStore({
    onUserAction: (action) => {
      pendingUserActionRef.current = action;
    },
  }));
  const [conversation] = useState(() => new AgentConversation());
  const [binder] = useState(() => new SurfaceMessageBinder());

  // ========== UI 状态 ==========
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [appType, setAppType] = useState<'food' | 'campus'>('food');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ========== 临时状态（订阅事件处理） ==========
  const currentMsgIdRef = useRef<string>('');
  const currentToolCallRef = useRef<{ id: string; name: string; args: string } | null>(null);
  const toolCallNamesRef = useRef<Map<string, string>>(new Map());

  // ========== HttpAgent ==========
  const agent = useMemo(() => {
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const httpAgent = new HttpAgent({
      url: AGENT_URL,
      headers,
      initialMessages: [],
    });
    // 服务端直接发送 ACTIVITY_SNAPSHOT，不再需要 A2UIMiddleware 拦截 render_a2ui
    const middleware = new A2UIMiddleware({
      schema: A2UI_CATALOG_SCHEMA,
      injectA2UITool: false,
    });
    httpAgent.use(middleware);
    return httpAgent;
  }, [token]);

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
          // 优先用 currentMsgIdRef 定位当前消息
          if (currentMsgIdRef.current) {
            const idx = prev.findIndex((m) => m.id === currentMsgIdRef.current);
            if (idx !== -1) {
              const updated = [...prev];
              updated[idx] = { ...updated[idx], content: updated[idx].content + delta };
              return updated;
            }
          }
          // Fallback：找到最后一条 user 后的第一条 assistant
          const existingIdx = findAssistantAfterLastUser(prev);
          if (existingIdx !== -1) {
            const updated = [...prev];
            updated[existingIdx] = { ...updated[existingIdx], content: updated[existingIdx].content + delta };
            return updated;
          }
          // 兜底：创建新消息
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

        // 获取当前消息 ID（如果 TEXT_MESSAGE_START 未触发则创建占位）
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
          updated[idx] = { ...updated[idx], surfaceId: uniqueSurfaceId };
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
    <div className="flex h-full bg-gray-50">
      {/* 单面板：对话区域 */}
      <div className="flex-1 flex flex-col">
        {/* 顶部控制栏 */}
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
            {isLoggedIn ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">{user?.name}</span>
                <button
                  onClick={logout}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-3 h-3" />
                  退出
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowLogin(true)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
              >
                <LogIn className="w-3 h-3" />
                登录
              </button>
            )}
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
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex items-start gap-2 max-w-[90%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'user' ? 'bg-blue-600' : 'bg-green-600'
                }`}>
                  {msg.role === 'user' ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-white" />
                  )}
                </div>
                {msg.role === 'user' ? (
                  <div className="rounded-lg px-3 py-2 text-sm bg-blue-600 text-white">
                    {msg.content}
                  </div>
                ) : (
                  <div className="space-y-3 min-w-[200px]">
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
                    {/* A2UI Surface 在下方（避免完成后推动上方文本） */}
                    {msg.surfaceId && (
                      <div className="rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm">
                        <A2UIRenderer surfaceId={msg.surfaceId} store={store} />
                      </div>
                    )}
                  </div>
                )}
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

      <LoginModal
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
        onLogin={login}
      />
    </div>
  );
}
