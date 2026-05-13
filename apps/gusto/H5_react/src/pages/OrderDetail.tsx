import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router';
import {
  ArrowLeft, Package, Loader2, MapPin, Phone, User, FileText
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api';
import type { OrderWithHistory } from '@/types';
import OrderStepper from '@/components/OrderStepper';

const statusLabels: Record<string, string> = {
  pending: '待确认',
  confirmed: '已接单',
  preparing: '制作中',
  ready: '待配送',
  delivering: '配送中',
  delivered: '已送达',
  cancelled: '已取消',
};

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<OrderWithHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!token || !id) return;
    setLoading(true);
    setError(null);

    api.food.orders.getById(id, token)
      .then((result) => {
        if (result.data) {
          setData(result.data);
        } else {
          setError(result.error?.message || '加载失败');
        }
        setLoading(false);
      })
      .catch(() => {
        setError('网络错误');
        setLoading(false);
      });
  }, [token, id]);

  const handleCancel = async () => {
    if (!token || !id || !data) return;
    if (!confirm('确定要取消此订单吗？')) return;

    setCancelling(true);
    try {
      const result = await api.food.orders.cancel(id, token);
      if (result.data) {
        // Refresh order data
        const refreshed = await api.food.orders.getById(id, token);
        if (refreshed.data) setData(refreshed.data);
      }
    } catch {
      alert('取消失败');
    } finally {
      setCancelling(false);
    }
  };

  const order = data?.order;

  return (
    <div className="relative z-10 min-h-screen pt-20">
      <div className="px-6 lg:px-12 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => navigate('/orders')}
              className="text-white/50 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-white font-display text-2xl font-bold tracking-tight">
              订单详情
            </h1>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-brand-orange animate-spin" />
              <p className="text-white/30 font-display text-sm mt-4">加载中...</p>
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <p className="text-white/30 font-display text-lg">{error}</p>
              <button
                onClick={() => navigate('/orders')}
                className="mt-4 text-brand-orange text-sm font-display hover:underline"
              >
                返回订单列表
              </button>
            </div>
          ) : !order ? (
            <div className="text-center py-20 text-white/30">
              <Package className="w-16 h-16 mx-auto mb-4" />
              <p className="font-display text-lg">订单不存在</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Status Stepper */}
              <div className="bg-[#111] rounded-2xl border border-white/5 p-5">
                <h2 className="text-white/50 font-display text-xs uppercase tracking-wider mb-4">
                  订单状态
                </h2>
                <OrderStepper
                  currentStatus={order.status}
                  history={data?.history || []}
                />
              </div>

              {/* Order Info */}
              <div className="bg-[#111] rounded-2xl border border-white/5 p-5 space-y-4">
                <h2 className="text-white/50 font-display text-xs uppercase tracking-wider">
                  订单信息
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-white/30 text-xs">订单号</p>
                    <p className="text-white text-sm font-display mt-0.5">{order.orderNo}</p>
                  </div>
                  <div>
                    <p className="text-white/30 text-xs">下单时间</p>
                    <p className="text-white text-sm font-display mt-0.5">
                      {order.createdAt
                        ? new Date(order.createdAt).toLocaleString('zh-CN')
                        : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-white/30 text-xs">订单状态</p>
                    <p className={`text-sm font-display font-medium mt-0.5 ${
                      order.status === 'cancelled' ? 'text-red-400' : 'text-brand-orange'
                    }`}>
                      {statusLabels[order.status] || order.status}
                    </p>
                  </div>
                  <div>
                    <p className="text-white/30 text-xs">支付方式</p>
                    <p className="text-white text-sm font-display mt-0.5">
                      {order.paymentMethod === 'wechat' ? '微信支付'
                        : order.paymentMethod === 'alipay' ? '支付宝'
                        : order.paymentMethod || '未支付'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Delivery Info */}
              {order.address && (
                <div className="bg-[#111] rounded-2xl border border-white/5 p-5 space-y-4">
                  <h2 className="text-white/50 font-display text-xs uppercase tracking-wider">
                    配送信息
                  </h2>
                  <div className="space-y-3">
                    {order.contactName && (
                      <div className="flex items-center gap-3">
                        <User className="w-4 h-4 text-white/20 flex-shrink-0" />
                        <span className="text-white text-sm">{order.contactName}</span>
                      </div>
                    )}
                    {order.phone && (
                      <div className="flex items-center gap-3">
                        <Phone className="w-4 h-4 text-white/20 flex-shrink-0" />
                        <span className="text-white text-sm">{order.phone}</span>
                      </div>
                    )}
                    {order.address && (
                      <div className="flex items-start gap-3">
                        <MapPin className="w-4 h-4 text-white/20 flex-shrink-0 mt-0.5" />
                        <span className="text-white text-sm">{order.address}</span>
                      </div>
                    )}
                    {order.note && (
                      <div className="flex items-start gap-3">
                        <FileText className="w-4 h-4 text-white/20 flex-shrink-0 mt-0.5" />
                        <span className="text-white/50 text-sm">备注：{order.note}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Items */}
              <div className="bg-[#111] rounded-2xl border border-white/5 p-5 space-y-4">
                <h2 className="text-white/50 font-display text-xs uppercase tracking-wider">
                  商品清单
                </h2>
                <div className="space-y-3">
                  {order.items?.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                          <Package className="w-5 h-5 text-white/20" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-display">{item.name}</p>
                        <p className="text-white/30 text-xs mt-0.5">
                          ¥{item.price} x {item.quantity}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-white text-sm font-display">
                          ¥{(item.price * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-white/5 pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">商品总额</span>
                    <span className="text-white font-display">¥{order.total}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">配送费</span>
                    <span className="text-white font-display">¥0</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-white/5">
                    <span className="text-white font-display">实付款</span>
                    <span className="text-brand-orange font-display text-xl font-bold">
                      ¥{order.total}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              {order.status !== 'cancelled' && order.status !== 'delivered' && (
                <div className="flex gap-3">
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="flex-1 py-3.5 border border-white/10 text-white/60 rounded-xl font-display text-sm uppercase tracking-wider hover:bg-white/5 transition-all disabled:opacity-50"
                  >
                    {cancelling ? '取消中...' : '取消订单'}
                  </button>
                </div>
              )}

              {order.status === 'delivered' && (
                <div className="flex gap-3">
                  <Link
                    to="/order"
                    className="flex-1 py-3.5 bg-brand-orange text-white text-center rounded-xl font-display text-sm uppercase tracking-wider hover:shadow-glow transition-all"
                  >
                    再来一单
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
