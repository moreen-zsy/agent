/**
 * A2UI OrderDetail 组件
 * 展示单个订单的完整详情（不含时间线，用信息卡片形式）
 */

import type { A2UIComponentProps } from './types.js';
import { Package, Phone, MapPin, FileText, User } from 'lucide-react';

export interface OrderDetailItem {
  name: string;
  quantity: number;
  price: number | string;
  image?: string;
}

export interface OrderDetailData {
  id: string;
  orderNo: string;
  status: string;
  total: number | string;
  createdAt: string;
  items: OrderDetailItem[];
  address?: string;
  phone?: string;
  contactName?: string;
  note?: string;
  paymentMethod?: string;
}

export interface OrderDetailProps extends A2UIComponentProps {
  order?: OrderDetailData;
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

export function A2UIOrderDetail({ order }: OrderDetailProps) {
  if (!order) {
    return (
      <div className="w-full bg-[#111] rounded-2xl border border-white/5 p-6 text-center">
        <p className="text-white/30 text-sm">订单数据加载中...</p>
      </div>
    );
  }

  const total = typeof order.total === 'string' ? parseFloat(order.total) : (order.total || 0);
  const statusLabel = statusLabels[order.status] || order.status;
  const statusClass = statusColors[order.status] || 'text-white/50';

  return (
    <div className="w-full bg-[#111] rounded-2xl border border-white/5 overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5"
      >
        <div className="flex items-center justify-between"
        >
          <div className="flex items-center gap-2"
          >
            <span className="text-white/40 text-xs font-display"
            >订单号</span
            >
            <span className="text-white text-sm font-display font-medium"
            >{order.orderNo}</span
            >
          </div
          >
          <span className={`text-xs font-display ${statusClass}`}
          >{statusLabel}</span
          >
        </div
        >
      </div
      >

      {/* Items */}
      <div className="px-5 py-4 space-y-3"
      >
        {order.items?.map((item, idx) => (
          <div key={idx} className="flex items-center gap-3"
          >
            {item.image ? (
              <img
                src={item.image}
                alt={item.name}
                className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0"
              >
                <Package className="w-4 h-4 text-white/20" />
              </div>
            )}
            <div className="flex-1 min-w-0"
            >
              <p className="text-white text-sm font-display truncate"
              >{item.name}</p
              >
              <p className="text-white/30 text-xs mt-0.5"
              >¥{item.price} x {item.quantity}</p
              >
            </div
            >
            <span className="text-white text-sm font-display"
            >¥{(typeof item.price === 'string' ? parseFloat(item.price) : item.price) * item.quantity}</span
            >
          </div>
        ))}
      </div
      >

      {/* Divider */}
      <div className="border-t border-white/5 mx-5" />

      {/* Delivery Info */}
      {(order.address || order.phone || order.contactName) && (
        <div className="px-5 py-4 space-y-2"
        >
          {order.contactName && (
            <div className="flex items-center gap-2"
            >
              <User className="w-3.5 h-3.5 text-white/20" />
              <span className="text-white text-sm"
              >{order.contactName}</span
              >
            </div>
          )}
          {order.phone && (
            <div className="flex items-center gap-2"
            >
              <Phone className="w-3.5 h-3.5 text-white/20" />
              <span className="text-white text-sm"
              >{order.phone}</span
              >
            </div>
          )}
          {order.address && (
            <div className="flex items-start gap-2"
            >
              <MapPin className="w-3.5 h-3.5 text-white/20 flex-shrink-0 mt-0.5" />
              <span className="text-white text-sm"
              >{order.address}</span
              >
            </div>
          )}
          {order.note && (
            <div className="flex items-start gap-2"
            >
              <FileText className="w-3.5 h-3.5 text-white/20 flex-shrink-0 mt-0.5" />
              <span className="text-white/50 text-sm"
              >备注：{order.note}</span
              >
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/5 flex items-center justify-between"
      >
        <span className="text-white/40 text-xs"
        >
          {order.createdAt ? new Date(order.createdAt).toLocaleString('zh-CN') : ''}
        </span
        >
        <div className="flex items-center gap-2"
        >
          <span className="text-white/40 text-xs"
          >订单总计</span
          >
          <span className="text-brand-orange font-display font-bold text-lg"
          >¥{total.toFixed(2)}</span
          >
        </div
        >
      </div
      >
    </div>
  );
}
