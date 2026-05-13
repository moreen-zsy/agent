/**
 * A2UI OrderCard 组件
 * 展示订单卡片，与 GUSTO 订单列表页样式一致
 */

import type { A2UIComponentProps } from './types.js';
import { Package } from 'lucide-react';

export interface OrderItemData {
  dishId: string;
  name: string;
  quantity: number;
  price: number;
  image?: string;
}

export interface OrderCardData {
  id: string;
  orderNo: string;
  status: string;
  items: OrderItemData[];
  total: number | string;
  createdAt: string;
}

export interface OrderCardProps extends A2UIComponentProps {
  order?: OrderCardData;
}

const statusLabels: Record<string, string> = {
  pending: '待确认',
  confirmed: '已确认',
  preparing: '制作中',
  ready: '待取餐',
  delivering: '配送中',
  delivered: '已完成',
  cancelled: '已取消',
};

const statusColors: Record<string, string> = {
  pending: 'text-yellow-400',
  confirmed: 'text-blue-400',
  preparing: 'text-brand-orange',
  ready: 'text-green-400',
  delivering: 'text-purple-400',
  delivered: 'text-white/50',
  cancelled: 'text-red-400',
};

export function A2UIOrderCard({ order, _store, _surfaceId, _componentId }: OrderCardProps) {
  if (!order) {
    return (
      <div className="w-full bg-[#111] rounded-2xl border border-white/5 p-6 text-center">
        <p className="text-white/30 text-sm">订单数据加载中...</p>
      </div>
    );
  }

  const firstItem = order.items?.[0];
  const totalItems = order.items?.reduce((s, i) => s + (i.quantity || 0), 0) || 0;
  const total = typeof order.total === 'string' ? parseFloat(order.total) : (order.total || 0);

  const handleClick = () => {
    if (!_store || !_surfaceId || !_componentId) return;
    _store.sendUserAction({
      action: {
        name: 'view_order_detail',
        surfaceId: _surfaceId,
        sourceComponentId: _componentId,
        timestamp: new Date().toISOString(),
        context: { orderId: order.id },
      },
    });
  };

  const statusClass = statusColors[order.status] || 'text-white/50';
  const statusLabel = statusLabels[order.status] || order.status;

  return (
    <div
      onClick={handleClick}
      className="w-full bg-[#111] rounded-2xl border border-white/5 overflow-hidden cursor-pointer hover:border-brand-orange/20 transition-all active:scale-[0.98]"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-xs font-display">订单号</span>
          <span className="text-white text-sm font-display font-medium">{order.orderNo}</span>
        </div>
        <span className={`text-xs font-display ${statusClass}`}>{statusLabel}</span>
      </div>

      {/* Items */}
      <div className="flex items-center gap-4 px-5 py-4">
        {firstItem?.image ? (
          <img
            src={firstItem.image}
            alt={firstItem.name}
            className="w-14 h-14 object-cover rounded-xl flex-shrink-0"
          />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
            <Package className="w-6 h-6 text-white/20" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-display truncate">{firstItem?.name || '未知商品'}</p>
          <p className="text-white/30 text-xs mt-1">
            {totalItems > 1 ? `等 ${totalItems} 件商品` : `x${firstItem?.quantity || 1}`}
          </p>
        </div>
        <span className="text-white font-display font-semibold flex-shrink-0">
          ¥{total.toFixed(2)}
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-white/5">
        <span className="text-white/30 text-xs">
          {order.createdAt ? new Date(order.createdAt).toLocaleDateString('zh-CN') : ''}
        </span>
        <span className="text-brand-orange text-xs font-display">查看详情 →</span>
      </div>
    </div>
  );
}
