<template>
  <div
    ref="cardRef"
    class="group relative bg-[#111] rounded-2xl overflow-hidden border border-white/5 hover:border-brand-orange/30 transition-all duration-500"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- Image -->
    <div class="relative aspect-[3/2] overflow-hidden">
      <img
        :src="dish.image"
        :alt="dish.name"
        class="w-full h-full object-cover transition-all duration-700"
        :class="isHovered ? 'scale-110 brightness-100' : 'scale-100 brightness-90'"
      />
      <div class="absolute inset-0 bg-gradient-to-t from-[#111] via-transparent to-transparent" />

      <!-- Hover overlay -->
      <div
        class="absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity duration-300"
        :class="isHovered ? 'opacity-100' : 'opacity-0'"
        @click.stop
      >
        <div v-if="quantity === 0" class="flex items-center gap-2 bg-brand-orange text-white px-6 py-3 rounded-full font-display text-sm uppercase tracking-wider hover:shadow-glow transition-all transform hover:scale-105 cursor-pointer" @click="cart.addToCart(dish)">
          <Plus class="w-4 h-4" />
          加入购物车
        </div>
        <div v-else class="flex items-center gap-3 bg-[#0A0A0A]/90 backdrop-blur-sm rounded-full px-4 py-2">
          <button @click="cart.updateQuantity(dish.id, quantity - 1)" class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-brand-orange transition-all">
            <Minus class="w-3 h-3" />
          </button>
          <span class="text-white font-display font-semibold w-6 text-center">{{ quantity }}</span>
          <button @click="cart.addToCart(dish)" class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-brand-orange transition-all">
            <Plus class="w-3 h-3" />
          </button>
        </div>
      </div>

      <!-- Tags -->
      <div v-if="dish.tags?.length" class="absolute top-3 left-3 flex gap-1.5">
        <span
          v-for="tag in dish.tags.slice(0, 2)"
          :key="tag"
          class="px-2.5 py-1 bg-brand-orange/90 text-white text-[10px] font-display uppercase tracking-wider rounded-full"
        >
          {{ tag }}
        </span>
      </div>
    </div>

    <!-- Info -->
    <div class="p-5">
      <div class="flex items-start justify-between gap-3">
        <div class="flex-1 min-w-0">
          <h3 class="text-white font-display font-semibold text-base group-hover:text-brand-orange transition-colors">{{ dish.name }}</h3>
          <p class="text-white/40 font-serif text-xs mt-1.5 line-clamp-2 leading-relaxed">{{ dish.description }}</p>
        </div>
        <span class="text-brand-orange font-display font-bold text-xl flex-shrink-0">¥{{ dish.price }}</span>
      </div>
      <div v-if="dish.ingredients" class="flex flex-wrap gap-1.5 mt-3">
        <span
          v-for="ing in dish.ingredients.slice(0, 3)"
          :key="ing"
          class="px-2 py-0.5 bg-white/5 text-white/30 text-[10px] font-display rounded-md"
        >
          {{ ing }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Plus, Minus } from 'lucide-vue-next';
import type { Dish } from '@/types';
import { useCartStore } from '@/stores/cart';
import gsap from 'gsap';

const props = defineProps<{ dish: Dish; index: number }>();
const cart = useCartStore();
const isHovered = ref(false);
const cardRef = ref<HTMLElement | null>(null);

const quantity = computed(() => {
  const item = cart.items.find(i => i.dish.id === props.dish.id);
  return item?.quantity || 0;
});

onMounted(() => {
  if (cardRef.value) {
    gsap.fromTo(cardRef.value, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.6, delay: props.index * 0.05, ease: 'power2.out' });
  }
});
</script>
