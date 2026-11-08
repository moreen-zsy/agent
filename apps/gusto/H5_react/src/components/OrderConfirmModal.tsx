import { useEffect, useRef, useState } from 'react';
import { X, Plus, Minus, MapPin, FileText, Loader2, ShoppingBag, ChevronRight } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router';
import { api, mapAddress } from '@/api';
import { toast } from 'sonner';
import type { UserAddress } from '@/types';

interface OrderConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onNavigateAway?: () => void;
}

export default function OrderConfirmModal({ open, onClose, onNavigateAway }: OrderConfirmModalProps) {
  const { items, totalPrice, updateQuantity, removeFromCart, clearCart } = useCart();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const modalRef = useRef<HTMLDivElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [contactName, setContactName] = useState(user?.name || '');
  const [note, setNote] = useState('');
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [showAddressSelect, setShowAddressSelect] = useState(false);

  // Load saved addresses
  useEffect(() => {
    if (!token || !open) return;
    api.food.addresses.get(token)
      .then((list) => {
        const mapped = list.map(mapAddress);
        setAddresses(mapped);
        const defaultAddr = mapped.find((a) => a.isDefault);
        if (defaultAddr) {
          setAddress(defaultAddr.address);
          setPhone(defaultAddr.phone || user?.phone || '');
          setContactName(defaultAddr.contactName || user?.name || '');
        }
      })
      .catch(() => { /* 静默失败，不影响手动填写 */ });
  }, [token, open, user]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, onClose, submitting]);

  const handleSelectAddress = (addr: UserAddress) => {
    setAddress(addr.address);
    setPhone(addr.phone || '');
    setContactName(addr.contactName || '');
    setShowAddressSelect(false);
  };

  const handleSubmit = async () => {
    if (!token) {
      toast.error('请先登录');
      return;
    }
    if (items.length === 0) {
      toast.error('购物车为空');
      return;
    }
    if (!address.trim()) {
      toast.error('请填写收货地址');
      return;
    }

    setSubmitting(true);
    try {
      const orderItems = items.map((item) => ({
        dishId: item.dish.id,
        name: item.dish.name,
        quantity: item.quantity,
        price: item.dish.price,
        image: item.dish.image,
      }));

      const result = await api.food.order.post(
        {
          items: orderItems,
          address: address.trim(),
          phone: phone.trim() || undefined,
          contactName: contactName.trim() || undefined,
          note: note.trim() || undefined,
        },
        token
      );

      toast.success('订单已提交！');
      clearCart();
      onClose();
      navigate(`/orders/${result.order.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '网络错误，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={submitting ? undefined : onClose} />

      <div
        ref={modalRef}
        className="relative bg-[#111] rounded-3xl overflow-hidden max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-white/10"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-5 h-5 text-brand-orange" />
            <h2 className="text-white font-display text-lg font-semibold tracking-tight">确认订单</h2>
          </div>
          <button onClick={submitting ? undefined : onClose} className="p-2 text-white/50 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Items */}
          <div className="space-y-3">
            <h3 className="text-white/50 font-display text-xs uppercase tracking-wider">商品清单</h3>
            {items.map((item) => (
              <div key={item.dish.id} className="flex gap-3 bg-white/5 rounded-xl p-3">
                <img src={item.dish.image} alt={item.dish.name} className="w-14 h-14 object-cover rounded-lg flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-white text-sm font-display">{item.dish.name}</h4>
                    <button
                      onClick={() => removeFromCart(item.dish.id)}
                      className="p-1 text-white/30 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.dish.id, item.quantity - 1)}
                        className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-brand-orange hover:text-white transition-all"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-white font-display text-sm w-5 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.dish.id, item.quantity + 1)}
                        className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-brand-orange hover:text-white transition-all"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="text-brand-orange font-display text-sm font-medium">¥{item.dish.price * item.quantity}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Address */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-white/50 font-display text-xs uppercase tracking-wider">收货地址</h3>
              {addresses.length > 0 && (
                <button
                  onClick={() => setShowAddressSelect(!showAddressSelect)}
                  className="text-brand-orange text-xs font-display hover:underline"
                >
                  {showAddressSelect ? '收起' : '选择地址'}
                </button>
              )}
            </div>

            {showAddressSelect && addresses.length > 0 && (
              <div className="space-y-2">
                {addresses.map((addr) => (
                  <button
                    key={addr.id}
                    onClick={() => handleSelectAddress(addr)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      address === addr.address
                        ? 'border-brand-orange bg-brand-orange/10'
                        : 'border-white/5 bg-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-white text-sm">{addr.address}</span>
                      {addr.isDefault && (
                        <span className="text-[10px] bg-brand-orange/20 text-brand-orange px-2 py-0.5 rounded-full">默认</span>
                      )}
                    </div>
                    {addr.contactName && <span className="text-white/40 text-xs">{addr.contactName}</span>}
                    {addr.phone && <span className="text-white/40 text-xs ml-2">{addr.phone}</span>}
                  </button>
                ))}
              </div>
            )}

            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input
                type="text"
                placeholder="收货地址"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-display text-sm placeholder:text-white/30 focus:outline-none focus:border-brand-orange/50 transition-colors"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="联系人"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-display text-sm placeholder:text-white/30 focus:outline-none focus:border-brand-orange/50 transition-colors"
              />
              <input
                type="tel"
                placeholder="手机号"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-display text-sm placeholder:text-white/30 focus:outline-none focus:border-brand-orange/50 transition-colors"
              />
            </div>

            {/* Link to address management */}
            <button
              onClick={() => {
                onClose();
                onNavigateAway?.();
                navigate('/profile/addresses');
              }}
              className="flex items-center gap-2 text-white/30 hover:text-brand-orange text-xs font-display transition-colors"
            >
              <MapPin className="w-3 h-3" />
              管理收货地址
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {/* Note */}
          <div className="space-y-3">
            <h3 className="text-white/50 font-display text-xs uppercase tracking-wider">备注</h3>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input
                type="text"
                placeholder="如：不要辣、少盐等"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-display text-sm placeholder:text-white/30 focus:outline-none focus:border-brand-orange/50 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/5 space-y-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-white/50 font-display text-sm">共 {items.reduce((s, i) => s + i.quantity, 0)} 件商品</span>
            <span className="text-white font-display text-2xl font-bold">¥{totalPrice}</span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-4 bg-brand-orange text-white font-display font-semibold text-sm uppercase tracking-widest rounded-xl hover:bg-brand-orange/90 transition-all hover:shadow-glow active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                提交中...
              </>
            ) : (
              '确认下单'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
