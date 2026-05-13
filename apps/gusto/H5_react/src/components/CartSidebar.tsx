import { X, Plus, Minus, Trash2, ShoppingBag } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useEffect, useRef, useState } from 'react';
import OrderConfirmModal from './OrderConfirmModal';

export default function CartSidebar() {
  const { items, isOpen, closeCart, totalPrice, updateQuantity, removeFromCart, clearCart } = useCart();
  const { user } = useAuth();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCart();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, closeCart]);

  const handleOpenConfirm = () => {
    if (!user) {
      closeCart();
      // Let parent handle login modal via auth context
      return;
    }
    setConfirmOpen(true);
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
          onClick={closeCart}
        />
      )}

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-[#0F0F0F] border-l border-white/5 z-[70] transition-transform duration-500 ease-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-5 h-5 text-brand-orange" />
            <h2 className="text-white font-display text-xl font-semibold tracking-tight">
              您的订单
            </h2>
          </div>
          <button
            onClick={closeCart}
            className="p-2 text-white/50 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-6">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-white/30">
              <ShoppingBag className="w-16 h-16 mb-4" />
              <p className="font-display text-lg">购物车为空</p>
              <p className="font-serif text-sm mt-2">快去挑选心仪的美食吧</p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item, index) => (
                <div
                  key={item.dish.id}
                  className="flex gap-4 bg-white/5 rounded-xl p-4 animate-blur-in"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <img
                    src={item.dish.image}
                    alt={item.dish.name}
                    className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-white font-display font-medium text-sm truncate">
                        {item.dish.name}
                      </h3>
                      <button
                        onClick={() => removeFromCart(item.dish.id)}
                        className="p-1 text-white/30 hover:text-red-400 transition-colors flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-white/40 text-xs mt-1 line-clamp-1 font-serif">
                      {item.dish.description}
                    </p>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.dish.id, item.quantity - 1)}
                          className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-brand-orange hover:text-white transition-all"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-white font-display text-sm w-6 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.dish.id, item.quantity + 1)}
                          className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-brand-orange hover:text-white transition-all"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-brand-orange font-display font-semibold">
                        ¥{item.dish.price * item.quantity}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-6 border-t border-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-white/50 font-display text-sm">共 {items.reduce((s, i) => s + i.quantity, 0)} 件商品</span>
              <button
                onClick={clearCart}
                className="text-white/30 hover:text-red-400 text-xs font-display transition-colors"
              >
                清空购物车
              </button>
            </div>
            <div className="flex items-center justify-between py-3 border-t border-white/5">
              <span className="text-white/70 font-display">合计</span>
              <span className="text-white font-display text-2xl font-bold">
                ¥{totalPrice}
              </span>
            </div>
            <button
              onClick={handleOpenConfirm}
              className="w-full py-4 bg-brand-orange text-white font-display font-semibold text-sm uppercase tracking-widest rounded-xl hover:bg-brand-orange/90 transition-all hover:shadow-glow active:scale-[0.98] flex items-center justify-center gap-2"
            >
              确认下单
            </button>
            <p className="text-white/30 text-xs text-center font-serif">
              预计制作时间 20-30 分钟
            </p>
          </div>
        )}
      </div>

      {/* Order Confirm Modal */}
      <OrderConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onNavigateAway={closeCart}
      />
    </>
  );
}
