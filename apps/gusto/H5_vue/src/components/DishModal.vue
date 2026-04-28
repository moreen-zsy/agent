<template>
  <div class="fixed inset-0 z-[80] flex items-center justify-center p-4" @click="emit('close')">
    <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" />
    <div
      ref="modalRef"
      class="relative bg-[#111] rounded-3xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col md:flex-row shadow-2xl border border-white/10"
      @click.stop
    >
      <!-- Close -->
      <button
        @click="emit('close')"
        class="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/80 transition-all"
      >
        <X class="w-5 h-5" />
      </button>

      <!-- Image -->
      <div class="w-full md:w-1/2 aspect-square md:aspect-auto flex-shrink-0">
        <img :src="dish.image" :alt="dish.name" class="w-full h-full object-cover" />
      </div>

      <!-- Info -->
      <div class="flex-1 p-8 overflow-y-auto">
        <span v-if="dish.tags?.[0]" class="text-brand-orange text-xs uppercase tracking-[0.2em] font-display">
          {{ dish.tags[0] }}
        </span>
        <h2 class="text-white font-display text-3xl font-bold mt-2 tracking-tight">{{ dish.name }}</h2>
        <p class="text-brand-orange font-display text-2xl font-bold mt-4">¥{{ dish.price }}</p>
        <p class="font-serif text-white/50 text-sm mt-6 leading-relaxed">
          {{ dish.fullDescription || dish.description }}
        </p>

        <div v-if="dish.ingredients" class="mt-6">
          <h4 class="text-white/70 font-display text-xs uppercase tracking-wider mb-3">主要配料</h4>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="ing in dish.ingredients"
              :key="ing"
              class="px-3 py-1.5 bg-white/5 text-white/50 text-xs font-display rounded-lg border border-white/5"
            >
              {{ ing }}
            </span>
          </div>
        </div>

        <button
          @click="cart.addToCart(dish); emit('close')"
          class="w-full mt-8 py-4 bg-brand-orange text-white font-display font-semibold text-sm uppercase tracking-widest rounded-xl hover:shadow-glow transition-all active:scale-[0.98]"
        >
          加入购物车
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { X } from 'lucide-vue-next';
import type { Dish } from '@/types';
import { useCartStore } from '@/stores/cart';
import gsap from 'gsap';

const props = defineProps<{ dish: Dish }>();
const emit = defineEmits<{ close: [] }>();

const cart = useCartStore();
const modalRef = ref<HTMLElement | null>(null);

onMounted(() => {
  if (modalRef.value) {
    gsap.fromTo(modalRef.value, { opacity: 0, scale: 0.9, filter: 'blur(10px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.4, ease: 'power2.out' });
  }
  document.addEventListener('keydown', onKey);
  document.body.style.overflow = 'hidden';
});

onUnmounted(() => {
  document.removeEventListener('keydown', onKey);
  document.body.style.overflow = '';
});

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close');
}
</script>
