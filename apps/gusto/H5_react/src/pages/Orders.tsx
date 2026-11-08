import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, Package, Loader2, ShoppingBag } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api, mapOrder } from '@/api';
import type { Order, OrderStatus } from '@/types';

const tabs: { id: OrderStatus | 'all' | 'active'; name: string }[] = [
  { id: 'all', name: '全部' },
  { id: 'active', name: '进行中' },
  { id: 'delivered', name: '已完成' },
  { id: 'cancelled', name: '已取消' },
];

const statusLabels: Record<string, string> = {
  pending: '待确认',
  confirmed: '已接单',
  preparing: '制作中',
  ready: '待配送',
  delivering: '配送中',
  delivered: '已送达',
  cancelled: '已取消',
};

const statusColors: Record<string, string> = {
  pending: 'text-yellow-400',
  confirmed: 'text-brand-orange',
  preparing: 'text-brand-orange',
  ready: 'text-brand-yellow',
  delivering: 'text-brand-orange',
  delivered: 'text-green-400',
  cancelled: 'text-red-400',
};

function OrderCard({ order }: { order: Order }) {
  const navigate = useNavigate();
  const firstItem = order.items?.[0];
  const totalItems = order.items?.reduce((s, i) => s + i.quantity, 0) ?? 0;

  return (
    <div
      onClick={() => navigate(`/orders/${order.id}`)}
      className="bg-[#111] rounded-2xl border border-white/5 overflow-hidden cursor-pointer hover:border-brand-orange/20 transition-all"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-xs font-display">订单号</span>
          <span className="text-white text-xs font-display font-medium">{order.orderNo}</span>
        </div>
        <span className={`text-xs font-display font-medium ${statusColors[order.status] || 'text-white/50'}`}>
          {statusLabels[order.status] || order.status}
        </span>
      </div>

      {/* Items preview */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-3">
          {firstItem?.image ? (
            <img src={firstItem.image} alt={firstItem.name} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5 text-white/20" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-display truncate">{firstItem?.name || '未知商品'}</p>
            {order.items && order.items.length > 1 && (
              <p className="text-white/30 text-xs mt-0.5">等 {totalItems} 件商品</p>
            )}
            {order.items?.length === 1 && (
              <p className="text-white/30 text-xs mt-0.5">x{firstItem?.quantity}</p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-white font-display font-semibold">¥{order.total}</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between">
        <span className="text-white/30 text-xs">
          {order.createdAt ? new Date(order.createdAt).toLocaleDateString('zh-CN') : ''}
        </span>
        <span className="text-brand-orange text-xs font-display">查看详情 →</span>
      </div>
    </div>
  );
}

export default function Orders() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<OrderStatus | 'all' | 'active'>('all');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const params: { status?: string } = {};
    if (activeTab === 'active') {
      // active means not delivered and not cancelled
      // We fetch all and filter client-side since API doesn't support multi-status
    } else if (activeTab !== 'all') {
      params.status = activeTab;
    }

    api.food.orders.get(token, params)
      .then((result) => {
        let data = result.data.map(mapOrder);
        if (activeTab === 'active') {
          data = data.filter((o) => !['delivered', 'cancelled'].includes(o.status));
        }
        setOrders(data);
        setLoading(false);
      })
      .catch(() => {
        setError('加载订单失败');
        setLoading(false);
      });
  }, [token, activeTab]);

  return (
    <div className="relative z-10 min-h-screen pt-20">
      {/* Header */}
      <div className="px-6 lg:px-12 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-white/50 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-white font-display text-2xl font-bold tracking-tight">我的订单</h1>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-6 overflow-x-auto pb-2 scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-full font-display text-xs uppercase tracking-wider whitespace-nowrap transition-all flex-shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-brand-orange text-white'
                    : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 lg:px-12 pb-24">
        <div className="max-w-3xl mx-auto space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-brand-orange animate-spin" />
              <p className="text-white/30 font-display text-sm mt-4">加载订单中...</p>
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <p className="text-white/30 font-display text-lg">{error}</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-white/30">
              <ShoppingBag className="w-16 h-16 mb-4" />
              <p className="font-display text-lg">暂无订单</p>
              <p className="font-serif text-sm mt-2">快去挑选心仪的美食吧</p>
              <Link
                to="/order"
                className="mt-6 inline-flex items-center gap-2 bg-brand-orange text-white px-6 py-3 rounded-full font-display text-sm uppercase tracking-wider hover:shadow-glow transition-all"
              >
                去点餐
              </Link>
            </div>
          ) : (
            orders.map((order) => <OrderCard key={order.id} order={order} />)
          )}
        </div>
      </div>
    </div>
  );
}
