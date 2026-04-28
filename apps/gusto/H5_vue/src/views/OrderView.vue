<template>
  <div class="relative z-10 min-h-screen pt-20">
    <!-- Header -->
    <div ref="headerRef" class="px-8 lg:px-12 py-12 lg:py-16">
      <div class="max-w-7xl mx-auto">
        <span class="header-reveal text-brand-orange text-xs uppercase tracking-[0.35em] font-display font-medium">
          Order Now
        </span>
        <h1 class="header-reveal text-white font-display text-4xl lg:text-6xl font-bold mt-4 tracking-tight">
          甄选<span class="text-brand-orange">美味</span>
        </h1>
        <p class="header-reveal font-serif text-white/40 text-sm mt-4 max-w-lg">
          浏览我们的精选菜单，将心仪的美食加入购物车，开启一段味蕾之旅。
        </p>

        <!-- Search -->
        <div class="header-reveal mt-10 flex flex-col sm:flex-row gap-4">
          <div class="relative flex-1 max-w-md">
            <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索菜品..."
              class="w-full pl-11 pr-10 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-display text-sm placeholder:text-white/30 focus:outline-none focus:border-brand-orange/50 transition-colors"
            />
            <button
              v-if="searchQuery"
              @click="searchQuery = ''"
              class="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Category Tabs -->
        <div class="header-reveal mt-6 flex gap-2 overflow-x-auto pb-2">
          <button
            v-for="cat in categories"
            :key="cat.id"
            @click="activeCategory = cat.id"
            :class="[
              'flex items-center gap-2 px-5 py-2.5 rounded-full font-display text-xs uppercase tracking-wider whitespace-nowrap transition-all flex-shrink-0',
              activeCategory === cat.id
                ? 'bg-brand-orange text-white shadow-glow'
                : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
            ]"
          >
            <component :is="getIcon(cat.icon)" class="w-4 h-4" />
            {{ cat.name }}
          </button>
        </div>
      </div>
    </div>

    <!-- Dish Grid -->
    <div class="px-8 lg:px-12 pb-24">
      <div class="max-w-7xl mx-auto">
        <div v-if="filteredDishes.length === 0" class="text-center py-20">
          <p class="text-white/30 font-display text-lg">没有找到匹配的菜品</p>
          <button @click="activeCategory = 'all'; searchQuery = ''" class="mt-4 text-brand-orange text-sm font-display hover:underline">
            查看全部菜品
          </button>
        </div>

        <div ref="gridRef" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          <div
            v-for="(dish, index) in filteredDishes"
            :key="dish.id"
            class="dish-card-wrapper"
          >
            <DishCard :dish="dish" :index="index" @click="selectedDish = dish" />
          </div>
        </div>
      </div>
    </div>

    <!-- Dish Modal -->
    <DishModal v-if="selectedDish" :dish="selectedDish" @close="selectedDish = null" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Search, X, Star, Leaf, ChefHat, CakeSlice, Wine, LayoutGrid } from 'lucide-vue-next';
import { dishes, categories } from '@/data/dishes';
import type { Dish } from '@/types';
import DishCard from '@/components/DishCard.vue';
import DishModal from '@/components/DishModal.vue';
import gsap from 'gsap';

const headerRef = ref<HTMLElement | null>(null);
const gridRef = ref<HTMLElement | null>(null);
const activeCategory = ref('all');
const searchQuery = ref('');
const selectedDish = ref<Dish | null>(null);

const iconMap: Record<string, any> = {
  LayoutGrid, Star, Leaf, ChefHat, CakeSlice, Wine,
};
function getIcon(name: string) {
  return iconMap[name] || LayoutGrid;
}

const filteredDishes = computed(() =>
  dishes.filter(dish => {
    const matchCategory = activeCategory.value === 'all' || dish.category === activeCategory.value;
    const matchSearch = !searchQuery.value ||
      dish.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      dish.description.toLowerCase().includes(searchQuery.value.toLowerCase());
    return matchCategory && matchSearch;
  })
);

onMounted(() => {
  window.scrollTo(0, 0);
  if (headerRef.value) {
    gsap.fromTo(
      headerRef.value.querySelectorAll('.header-reveal'),
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.8, stagger: 0.1, ease: 'power2.out' }
    );
  }
});
</script>
