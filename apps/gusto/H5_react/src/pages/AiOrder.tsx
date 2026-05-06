import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { A2UIStore } from '@a2ui/core';
import { A2UIRenderer } from '@a2ui/react-render';
import { HttpAgent } from '@ag-ui/client';
import { A2UIMiddleware } from '@ag-ui/a2ui-middleware';
import { Send, ShoppingBag, Sparkles, Loader2 } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api';
import type { Dish } from '@/types';
import gsap from 'gsap';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  id: string;
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
  },
};

export default function AiOrder() {
  const { addToCart, totalItems, openCart } = useCart();
  const { user, openLoginModal } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        '你好！我是 Gusto 智能点餐助手。告诉我你想吃什么，比如"推荐一份招牌主菜"或"来一份和牛汉堡加一杯红酒"，我会为你推荐合适的菜品。',
      id: 'welcome',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [menuDishes, setMenuDishes] = useState<Dish[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // GSAP header animation
  useEffect(() => {
    if (!headerRef.current) return;
    gsap.fromTo(
      headerRef.current.querySelectorAll('.header-reveal'),
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.8, stagger: 0.1, ease: 'power2.out' }
    );
  }, []);

  // A2UI Store with cart bridge
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
        pendingUserActionRef.current = action as any;
      },
    });
  });

  // HttpAgent with A2UIMiddleware
  const agent = useMemo(() => {
    const httpAgent = new HttpAgent({
      url: AGENT_URL,
    });
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

  // Subscribe to AGUI events
  useEffect(() => {
    const unsubscribe = agent.subscribe({
      onRunStartedEvent: () => setIsLoading(true),
      onRunFinishedEvent: () => setIsLoading(false),
      onRunErrorEvent: ({ event }) => {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `错误: ${(event as any).message}`,
            id: `err-${Date.now()}`,
          },
        ]);
        setIsLoading(false);
      },
      onTextMessageStartEvent: () => {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: '', id: `msg-${Date.now()}` },
        ]);
      },
      onTextMessageContentEvent: ({ event }) => {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return [
              ...prev.slice(0, -1),
              {
                ...last,
                content: last.content + (event as any).delta,
              },
            ];
          }
          return prev;
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

    return () => unsubscribe.unsubscribe();
  }, [agent, store]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      id: `user-${Date.now()}`,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    agent.addMessage({
      id: userMsg.id,
      role: 'user',
      content: text,
    });

    const forwardedProps: Record<string, any> = { appType: 'food' };
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
        {
          role: 'assistant',
          content: `错误: ${(err as Error).message}`,
          id: `err-${Date.now()}`,
        },
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

  return (
    <div className="relative z-10 min-h-screen pt-20 bg-[#0A0A0A]">
      {/* Header */}
      <div ref={headerRef} className="px-6 lg:px-12 py-10 lg:py-14">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
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

            {/* Cart quick access */}
            <button
              onClick={() => {
                if (!user) {
                  openLoginModal();
                  return;
                }
                openCart();
              }}
              className="header-reveal relative p-3 bg-white/5 rounded-xl border border-white/10 hover:border-brand-orange/30 transition-all"
            >
              <ShoppingBag className="w-6 h-6 text-white/70" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-brand-orange text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="px-6 lg:px-12 pb-32">
        <div className="max-w-5xl mx-auto">
          <div className="bg-[#111] rounded-2xl border border-white/5 overflow-hidden">
            {/* Messages */}
            <div className="h-[calc(100vh-380px)] min-h-[400px] overflow-y-auto p-6 space-y-6">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-5 py-3.5 text-sm ${
                      msg.role === 'user'
                        ? 'bg-brand-orange text-white'
                        : 'bg-white/5 text-white/80 border border-white/5'
                    }`}
                  >
                    <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                  </div>
                </div>
              ))}

              {/* A2UI Render Area */}
              <div className="dark">
                <A2UIRenderer surfaceId="chat-surface" store={store} />
              </div>

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white/5 rounded-2xl px-5 py-3.5 border border-white/5 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-brand-orange animate-spin" />
                    <span className="text-white/40 text-sm">AI 思考中...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-white/5 p-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="描述你想吃什么，例如：推荐一份招牌主菜..."
                    disabled={isLoading}
                    className="w-full pl-5 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white font-display text-sm placeholder:text-white/30 focus:outline-none focus:border-brand-orange/50 transition-colors disabled:opacity-50"
                  />
                </div>
                <button
                  onClick={() => sendMessage(input)}
                  disabled={isLoading || !input.trim()}
                  className="flex-shrink-0 w-12 h-12 bg-brand-orange text-white rounded-xl flex items-center justify-center hover:bg-brand-orange/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              <p className="text-white/20 text-xs mt-2 text-center font-display">
                AI 生成的推荐仅供参考，请以实际菜单为准
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
