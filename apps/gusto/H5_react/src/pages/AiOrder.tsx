import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { A2UIStore, AgentConversation, SurfaceMessageBinder } from '@a2ui/core';
import { A2UIRenderer } from '@a2ui/react-render';
import { HttpAgent } from '@ag-ui/client';
import { A2UIMiddleware } from '@ag-ui/a2ui-middleware';
import {
  Send,
  Sparkles,
  Loader2,
  Search,
  Smile,
  Flame,
  ChefHat,
  Star,
  UtensilsCrossed,
  Wine,
  User,
  X,
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api';
import type { Dish } from '@/types';
import gsap from 'gsap';
import { Streamdown } from 'streamdown';
import 'streamdown/styles.css';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  id: string;
  surfaceId?: string;
}

const AGENT_URL = 'http://localhost:3000/api/agent/stream';

const A2UI_CATALOG_SCHEMA = {
  catalogId: 'https://a2ui.org/specification/v0_9/basic_catalog.json',
  components: {
    Text: { description: '文本组件' },
    Image: { description: '图片组件' },
    Icon: { description: '图标组件' },
    Button: { description: '按钮组件，支持 action 事件' },
    TextField: { description: '文本输入框' },
    CheckBox: { description: '复选框' },
    ChoicePicker: { description: '选择器' },
    Slider: { description: '滑块' },
    Row: { description: '水平布局' },
    Column: { description: '垂直布局' },
    List: { description: '列表' },
    Card: { description: '卡片容器' },
    Tabs: { description: '标签页' },
    Modal: { description: '模态框' },
    Divider: { description: '分隔线' },
    Spacer: { description: '占位空间' },
    Switch: { description: '开关' },
    Chip: { description: '标签芯片' },
    Carousel: { description: '轮播图' },
  },
};

const QUICK_ACTIONS = [
  { icon: Flame, label: '招牌推荐', prompt: '推荐几道你们的招牌菜' },
  { icon: ChefHat, label: '厨师精选', prompt: '今天厨师有什么推荐' },
  { icon: Star, label: '热门菜品', prompt: '看看最受欢迎的热销菜' },
  { icon: UtensilsCrossed, label: '搭配建议', prompt: '帮我搭配一套完整的晚餐' },
  { icon: Wine, label: '酒水搭配', prompt: '推荐适合配餐的酒水' },
];

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

function DishModal({ dish, onClose }: { dish: Dish; onClose: () => void }) {
  const { addToCart } = useCart();
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  useEffect(() => {
    if (!modalRef.current) return;
    gsap.fromTo(
      modalRef.current,
      { opacity: 0, scale: 0.9, filter: 'blur(10px)' },
      { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.4, ease: 'power2.out' }
    );
  }, []);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div
        ref={modalRef}
        className="relative bg-[#111] rounded-3xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col md:flex-row shadow-2xl border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/80 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Image */}
        <div className="w-full md:w-1/2 aspect-square md:aspect-auto flex-shrink-0">
          <img
            src={dish.image}
            alt={dish.name}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Info */}
        <div className="flex-1 p-8 overflow-y-auto">
          {dish.tags && dish.tags[0] && (
            <span className="text-brand-orange text-xs uppercase tracking-[0.2em] font-display">
              {dish.tags[0]}
            </span>
          )}
          <h2 className="text-white font-display text-3xl font-bold mt-2 tracking-tight">
            {dish.name}
          </h2>
          <p className="text-brand-orange font-display text-2xl font-bold mt-4">
            ¥{dish.price}
          </p>
          <p className="font-serif text-white/50 text-sm mt-6 leading-relaxed">
            {dish.fullDescription || dish.description}
          </p>

          {dish.ingredients && (
            <div className="mt-6">
              <h4 className="text-white/70 font-display text-xs uppercase tracking-wider mb-3">主要配料</h4>
              <div className="flex flex-wrap gap-2">
                {dish.ingredients.map(ing => (
                  <span
                    key={ing}
                    className="px-3 py-1.5 bg-white/5 text-white/50 text-xs font-display rounded-lg border border-white/5"
                  >
                    {ing}
                  </span>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => {
              addToCart(dish);
              onClose();
            }}
            className="w-full mt-8 py-4 bg-brand-orange text-white font-display font-semibold text-sm uppercase tracking-widest rounded-xl hover:shadow-glow transition-all active:scale-[0.98]"
          >
            加入购物车
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AiOrder() {
  const { addToCart } = useCart();
  const { token } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [menuDishes, setMenuDishes] = useState<Dish[]>([]);
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const emptyStateRef = useRef<HTMLDivElement>(null);

  // Refs for bridging A2UI Store <-> React Context
  const addToCartRef = useRef(addToCart);
  const menuDishesRef = useRef<Dish[]>([]);
  const pendingUserActionRef = useRef<Record<string, any> | null>(null);

  useEffect(() => {
    addToCartRef.current = addToCart;
  }, [addToCart]);

  useEffect(() => {
    menuDishesRef.current = menuDishes;
  }, [menuDishes]);

  // Load menu data from backend
  useEffect(() => {
    api.food.menu
      .get()
      .then((result) => {
        if (result.data) {
          const dishes = result.data.map((d: unknown) => {
            const item = d as Record<string, unknown>;
            return {
              id: String(item.id),
              name: String(item.name),
              description: String(item.description),
              price: parseFloat(String(item.price)),
              image: item.image ? String(item.image) : '',
              category: String(item.category) as Dish['category'],
              tags: Array.isArray(item.tags) ? item.tags.map(String) : undefined,
              ingredients: Array.isArray(item.ingredients)
                ? item.ingredients.map(String)
                : undefined,
              fullDescription: item.fullDescription
                ? String(item.fullDescription)
                : undefined,
            };
          });
          setMenuDishes(dishes);
        }
      })
      .catch(() => {
        // Fallback: if API fails, we still have empty menu
      });
  }, []);

  // GSAP animations
  useEffect(() => {
    if (!headerRef.current) return;
    gsap.fromTo(
      headerRef.current.querySelectorAll('.header-reveal'),
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.8, stagger: 0.1, ease: 'power2.out' }
    );
  }, []);

  useEffect(() => {
    if (emptyStateRef.current && messages.length === 0) {
      gsap.fromTo(
        emptyStateRef.current.querySelectorAll('.empty-reveal'),
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, ease: 'power2.out', delay: 0.2 }
      );
    }
  }, [messages.length]);

  // ========== @a2ui/core 层 ==========
  const [store] = useState(() => {
    return new A2UIStore({
      onUserAction: (action) => {
        const a = (action as any).action;
        if (a?.name === 'add_to_cart') {
          const dishId = a.context?.dishId;
          const dish = menuDishesRef.current.find((d) => d.id === dishId);
          if (dish) {
            addToCartRef.current(dish);
          }
        }
        if (a?.name === 'view_dish_detail') {
          const dishId = a.context?.dishId;
          const dish = menuDishesRef.current.find((d) => d.id === dishId);
          if (dish) {
            setSelectedDish(dish);
          }
        }
        pendingUserActionRef.current = action as any;
      },
    });
  });
  const [conversation] = useState(() => new AgentConversation());
  const [binder] = useState(() => new SurfaceMessageBinder());

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
    if (messages.length > 0) {
      scrollToBottom();
    }
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
      appType: 'food',
      conversationHistory: conversation.getHistory(),
    };
    if (pendingUserActionRef.current) {
      forwardedProps.a2uiAction = pendingUserActionRef.current;
    }

    // Build lightweight menu context for the LLM
    const menuContext = menuDishesRef.current.map((d) => ({
      id: d.id,
      name: d.name,
      price: d.price,
      category: d.category,
      description: d.description,
      tags: d.tags,
    }));

    try {
      await agent.runAgent({
        forwardedProps,
        context: [
          {
            value: JSON.stringify(menuContext),
            description: '当前餐厅菜单数据（包含菜品ID、名称、价格、分类、描述和标签）',
          },
          {
            value:
              '你是 Gusto 高端餐厅的智能点餐助手。帮用户推荐菜品、回答菜品相关问题。' +
              '当用户想点餐或看菜品时，使用 render_a2ui 工具生成精美的菜品展示卡片。' +
              '卡片结构建议：Column 包含 Image(菜品图)、Text(名称，usageHint=h3)、Text(价格)、Text(描述，usageHint=caption)、Button(加入购物车，variant=primary)。' +
              'Button 的 action 必须设置为: { event: { name: "add_to_cart", context: { dishId: "菜品ID" } } }。' +
              '图片路径使用菜单中菜品对应的 image 字段。' +
              '如果用户已登录，可以帮他完成下单；如果未登录，提示用户先登录。',
            description: '角色指令与工具使用说明',
          },
        ],
      });
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `错误: ${(err as Error).message}`, id: `err-${Date.now()}` },
      ]);
      setIsLoading(false);
    }

    pendingUserActionRef.current = null;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
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

  const hasMessages = messages.length > 0;

  return (
    <div className="relative z-10 min-h-screen bg-[#0A0A0A]">
      {/* Header */}
      <div
        ref={headerRef}
        className={`px-6 lg:px-12 transition-all duration-500 ${hasMessages ? 'py-4' : 'py-10 lg:py-14'}`}
      >
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            <div className={hasMessages ? 'opacity-0 h-0 overflow-hidden' : ''}>
              <div className="header-reveal flex items-center gap-2 text-brand-orange text-xs uppercase tracking-[0.3em] font-display">
                <Sparkles className="w-4 h-4" />
                AI Powered
              </div>
              <h1 className="header-reveal text-white font-display text-4xl lg:text-5xl font-bold mt-3 tracking-tight">
                AI 智能<span className="text-brand-orange">点餐</span>
              </h1>
              <p className="header-reveal font-serif text-white/40 text-sm mt-3 max-w-lg">
                用自然语言描述你的口味偏好，AI 助手为你精准推荐菜品，一键加入购物车。
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`px-6 lg:px-12 ${hasMessages ? 'pb-40' : ''}`}>
        <div className="max-w-5xl mx-auto">
          {!hasMessages ? (
            /* Empty State */
            <div
              ref={emptyStateRef}
              className="flex flex-col items-center justify-center"
              style={{ minHeight: 'calc(100vh - 340px)' }}
            >
              {/* AI Avatar */}
              <div className="empty-reveal w-16 h-16 rounded-full bg-[#1a1a1a] border border-white/10 flex items-center justify-center mb-6 overflow-hidden">
                <img src="/厨师.svg" alt="AI Chef" className="w-14 h-14 object-contain invert" />
              </div>

              {/* Title */}
              <h2 className="empty-reveal text-white text-2xl lg:text-3xl font-display font-medium tracking-tight mb-10">
                今天想吃点什么？
              </h2>

              {/* Big Input Box */}
              <div className="empty-reveal w-full max-w-2xl">
                <div className="relative bg-[#111] rounded-2xl border border-white/10 p-4 focus-within:border-brand-orange/40 transition-colors">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="描述你想吃什么，例如：推荐一份招牌主菜..."
                    disabled={isLoading}
                    rows={1}
                    className="w-full bg-transparent text-white font-display text-base placeholder:text-white/25 focus:outline-none resize-none min-h-[28px] max-h-[160px] pr-12 pb-8"
                  />

                  {/* Bottom toolbar */}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                    <div className="flex items-center gap-2">
                      <button className="p-2 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors">
                        <Search className="w-4 h-4" />
                      </button>
                      <button className="p-2 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors">
                        <Smile className="w-4 h-4" />
                      </button>
                    </div>
                    <button
                      onClick={() => sendMessage(input)}
                      disabled={isLoading || !input.trim()}
                      className="w-9 h-9 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-brand-orange transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.label}
                      onClick={() => sendMessage(action.prompt)}
                      disabled={isLoading}
                      className="empty-reveal flex items-center gap-2 px-4 py-2.5 bg-[#111] border border-white/10 rounded-full text-white/60 text-sm hover:border-white/20 hover:text-white transition-all disabled:opacity-40"
                    >
                      <action.icon className="w-4 h-4 text-brand-orange/70" />
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Chat State */
            <div className="space-y-6 pt-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-3`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-[#1a1a1a] border border-white/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <img src="/厨师.svg" alt="AI" className="w-6 h-6 object-contain invert" />
                    </div>
                  )}
                  <div className={`max-w-[85%] lg:max-w-[75%] space-y-3`}>
                    {msg.role === 'user' ? (
                      <div className="bg-brand-orange text-white rounded-2xl rounded-tr-sm px-5 py-3.5 text-sm">
                        <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                      </div>
                    ) : (
                      <>
                        {/* Text content */}
                        {msg.content ? (
                          <div className="bg-white/5 text-white/80 rounded-2xl rounded-tl-sm px-5 py-3.5 border border-white/5 text-sm leading-relaxed">
                            <Streamdown>{msg.content}</Streamdown>
                          </div>
                        ) : isLoading && !msg.surfaceId ? (
                          <div className="bg-white/5 rounded-2xl rounded-tl-sm px-5 py-3.5 border border-white/5 flex items-center gap-2">
                            <Loader2 className="w-4 h-4 text-brand-orange animate-spin" />
                            <span className="text-white/40 text-sm">AI 思考中...</span>
                          </div>
                        ) : null}
                        {/* A2UI Surface */}
                        {msg.surfaceId && (
                          <div className="dark rounded-xl overflow-hidden">
                            <A2UIRenderer surfaceId={msg.surfaceId} store={store} />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-brand-orange flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>
              ))}

              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex justify-start">
                  <div className="bg-white/5 rounded-2xl rounded-tl-sm px-5 py-3.5 border border-white/5 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-brand-orange animate-spin" />
                    <span className="text-white/40 text-sm">AI 思考中...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Input (chat state only) */}
      {hasMessages && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#0A0A0A]/90 backdrop-blur-xl border-t border-white/5 z-50">
          <div className="max-w-5xl mx-auto px-6 lg:px-12 py-4">
            <div className="relative bg-[#111] rounded-2xl border border-white/10 p-4 focus-within:border-brand-orange/40 transition-colors">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="继续对话..."
                disabled={isLoading}
                rows={1}
                className="w-full bg-transparent text-white font-display text-base placeholder:text-white/25 focus:outline-none resize-none min-h-[24px] max-h-[120px] pr-12 pb-8"
              />
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                <div className="flex items-center gap-2">
                  <button className="p-2 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors">
                    <Search className="w-4 h-4" />
                  </button>
                  <button className="p-2 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors">
                    <Smile className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={() => sendMessage(input)}
                  disabled={isLoading || !input.trim()}
                  className="w-9 h-9 bg-brand-orange text-white rounded-full flex items-center justify-center hover:bg-brand-orange/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dish Detail Modal */}
      {selectedDish && (
        <DishModal dish={selectedDish} onClose={() => setSelectedDish(null)} />
      )}
    </div>
  );
}
