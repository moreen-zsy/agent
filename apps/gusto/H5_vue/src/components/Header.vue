<template>
  <header
    :class="[
      'fixed top-0 left-0 right-0 z-50 transition-all duration-500',
      scrolled ? 'bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-white/5' : 'bg-transparent'
    ]"
  >
    <div class="w-full px-6 lg:px-12 h-20 flex items-center justify-between">
      <!-- Logo -->
      <router-link
        to="/"
        class="text-white font-display font-bold text-2xl tracking-tight hover:text-brand-orange transition-colors"
      >
        GUSTO
      </router-link>

      <!-- Desktop Nav -->
      <nav class="hidden md:flex items-center gap-10">
        <template v-if="isOrderPage">
          <router-link
            to="/"
            class="text-white/70 hover:text-white text-xs uppercase tracking-widest font-display transition-colors relative group"
          >
            首页
            <span class="absolute -bottom-1 left-0 w-0 h-0.5 bg-brand-orange transition-all duration-300 group-hover:w-full" />
          </router-link>
          <router-link
            to="/order"
            class="text-brand-orange text-xs uppercase tracking-widest font-display transition-colors relative"
          >
            甄选美味
            <span class="absolute -bottom-1 left-0 w-full h-0.5 bg-brand-orange" />
          </router-link>
        </template>
        <template v-else>
          <button
            v-for="item in navItems"
            :key="item.id"
            @click="scrollTo(item.id)"
            class="text-white/70 hover:text-white text-xs uppercase tracking-widest font-display transition-colors relative group"
          >
            {{ item.label }}
            <span class="absolute -bottom-1 left-0 w-0 h-0.5 bg-brand-orange transition-all duration-300 group-hover:w-full" />
          </button>
        </template>
      </nav>

      <!-- Right Actions -->
      <div class="flex items-center gap-4">
        <router-link
          to="/order"
          class="hidden md:block text-xs uppercase tracking-widest font-display bg-brand-orange text-white px-5 py-2.5 rounded-full hover:bg-brand-orange/90 transition-all hover:shadow-glow"
        >
          立即点餐
        </router-link>

        <button
          @click="cart.toggleCart()"
          class="relative p-2 text-white/70 hover:text-white transition-colors"
          aria-label="购物车"
        >
          <ShoppingBag class="w-5 h-5" />
          <span
            v-if="cart.totalItems > 0"
            class="absolute -top-0.5 -right-0.5 w-5 h-5 bg-brand-orange text-white text-[10px] font-bold rounded-full flex items-center justify-center"
          >
            {{ cart.totalItems }}
          </span>
        </button>

        <!-- Mobile menu button -->
        <button
          class="md:hidden p-2 text-white/70 hover:text-white"
          @click="mobileOpen = !mobileOpen"
        >
          <Menu v-if="!mobileOpen" class="w-5 h-5" />
          <X v-else class="w-5 h-5" />
        </button>
      </div>
    </div>
  </header>

  <!-- Mobile Menu -->
  <div
    v-if="mobileOpen"
    class="fixed inset-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl flex flex-col items-center justify-center gap-8 md:hidden"
  >
    <router-link to="/" @click="mobileOpen = false" class="text-white text-2xl font-display tracking-tight">
      首页
    </router-link>
    <router-link to="/order" @click="mobileOpen = false" class="text-white text-2xl font-display tracking-tight">
      甄选美味
    </router-link>
    <button
      @click="cart.toggleCart(); mobileOpen = false"
      class="text-brand-orange text-2xl font-display tracking-tight flex items-center gap-2"
    >
      购物车 {{ cart.totalItems > 0 ? `(${cart.totalItems})` : '' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { ShoppingBag, Menu, X } from 'lucide-vue-next';
import { useCartStore } from '@/stores/cart';

const cart = useCartStore();
const route = useRoute();
const scrolled = ref(false);
const mobileOpen = ref(false);

const isOrderPage = computed(() => route.path === '/order');

const navItems = [
  { id: 'hero', label: '首页' },
  { id: 'philosophy', label: '关于我们' },
  { id: 'menu-showcase', label: '精选菜单' },
];

function scrollTo(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

// Scroll listener
if (typeof window !== 'undefined') {
  const onScroll = () => { scrolled.value = window.scrollY > 50; };
  window.addEventListener('scroll', onScroll, { passive: true });
}
</script>
