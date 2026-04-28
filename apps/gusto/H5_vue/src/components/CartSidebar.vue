<template>
  <div>
    <!-- Backdrop -->
    <div
      v-if="cart.isOpen"
      class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
      @click="cart.closeCart()"
    />

    <!-- Sidebar -->
    <div
      :class="[
        'fixed top-0 right-0 h-full w-full max-w-md bg-[#0F0F0F] border-l border-white/5 z-[70] transition-transform duration-500 ease-out flex flex-col',
        cart.isOpen ? 'translate-x-0' : 'translate-x-full'
      ]"
    >
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-white/5">
        <div class="flex items-center gap-3">
          <ShoppingBag class="w-5 h-5 text-brand-orange" />
          <h2 class="text-white font-display text-xl font-semibold tracking-tight">您的订单</h2>
        </div>
        <button @click="cart.closeCart()" class="p-2 text-white/50 hover:text-white transition-colors">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Items -->
      <div class="flex-1 overflow-y-auto p-6">
        <div v-if="cart.items.length === 0" class="flex flex-col items-center justify-center h-full text-white/30">
          <ShoppingBag class="w-16 h-16 mb-4" />
          <p class="font-display text-lg">购物车为空</p>
          <p class="font-serif text-sm mt-2">快去挑选心仪的美食吧</p>
        </div>

        <div v-else class="space-y-4">
          <div
            v-for="(item, index) in cart.items"
            :key="item.dish.id"
            class="flex gap-4 bg-white/5 rounded-xl p-4 animate-blur-in"
            :style="{ animationDelay: `${index * 80}ms` }"
          >
            <img :src="item.dish.image" :alt="item.dish.name" class="w-20 h-20 object-cover rounded-lg flex-shrink-0" />
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-2">
                <h3 class="text-white font-display font-medium text-sm truncate">{{ item.dish.name }}</h3>
                <button
                  @click="cart.removeFromCart(item.dish.id)"
                  class="p-1 text-white/30 hover:text-red-400 transition-colors flex-shrink-0"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
              <p class="text-white/40 text-xs mt-1 line-clamp-1 font-serif">{{ item.dish.description }}</p>
              <div class="flex items-center justify-between mt-3">
                <div class="flex items-center gap-2">
                  <button
                    @click="cart.updateQuantity(item.dish.id, item.quantity - 1)"
                    class="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-brand-orange hover:text-white transition-all"
                  >
                    <Minus class="w-3 h-3" />
                  </button>
                  <span class="text-white font-display text-sm w-6 text-center">{{ item.quantity }}</span>
                  <button
                    @click="cart.updateQuantity(item.dish.id, item.quantity + 1)"
                    class="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-brand-orange hover:text-white transition-all"
                  >
                    <Plus class="w-3 h-3" />
                  </button>
                </div>
                <span class="text-brand-orange font-display font-semibold">¥{{ item.dish.price * item.quantity }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div v-if="cart.items.length > 0" class="p-6 border-t border-white/5 space-y-4">
        <div class="flex items-center justify-between">
          <span class="text-white/50 font-display text-sm">共 {{ cart.totalItems }} 件商品</span>
          <button @click="cart.clearCart()" class="text-white/30 hover:text-red-400 text-xs font-display transition-colors">
            清空购物车
          </button>
        </div>
        <div class="flex items-center justify-between py-3 border-t border-white/5">
          <span class="text-white/70 font-display">合计</span>
          <span class="text-white font-display text-2xl font-bold">¥{{ cart.totalPrice }}</span>
        </div>
        <button
          @click="submitOrder"
          class="w-full py-4 bg-brand-orange text-white font-display font-semibold text-sm uppercase tracking-widest rounded-xl hover:bg-brand-orange/90 transition-all hover:shadow-glow active:scale-[0.98]"
        >
          确认下单
        </button>
        <p class="text-white/30 text-xs text-center font-serif">预计制作时间 20-30 分钟</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { watch, onUnmounted } from 'vue';
import { ShoppingBag, X, Plus, Minus, Trash2 } from 'lucide-vue-next';
import { useCartStore } from '@/stores/cart';

const cart = useCartStore();

function submitOrder() {
  alert('订单已提交！感谢您的订购。');
  cart.clearCart();
  cart.closeCart();
}

// Escape key
const handleKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape') cart.closeCart();
};
watch(() => cart.isOpen, (open) => {
  if (open) {
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
  } else {
    document.removeEventListener('keydown', handleKey);
    document.body.style.overflow = '';
  }
});
onUnmounted(() => {
  document.removeEventListener('keydown', handleKey);
  document.body.style.overflow = '';
});
</script>

<style scoped>
@keyframes blurIn {
  from { opacity: 0; filter: blur(8px); transform: translateY(20px) scaleY(1.2); }
  to { opacity: 1; filter: blur(0); transform: translateY(0) scaleY(1); }
}
.animate-blur-in {
  animation: blurIn 0.8s ease-out forwards;
}
</style>
