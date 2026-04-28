<template>
  <div class="relative z-10">
    <!-- Hero Section -->
    <section
      ref="heroRef"
      id="hero"
      class="relative w-full min-h-screen flex flex-col lg:flex-row"
    >
      <!-- Left: Text Content -->
      <div class="w-full lg:w-[42%] flex flex-col justify-center px-8 md:px-12 lg:px-16 py-24 lg:py-0 relative z-20">
        <span class="hero-reveal text-brand-orange text-xs uppercase tracking-[0.35em] font-display font-medium">
          Modern Dining Since 2026
        </span>

        <h1 class="hero-reveal text-white font-display text-5xl md:text-6xl lg:text-7xl font-bold leading-[0.95] tracking-tight mt-6">
          探索<br><span class="text-brand-orange">味蕾</span><br>新边界
        </h1>

        <p class="hero-reveal font-serif text-white/35 text-sm mt-8 max-w-sm leading-relaxed">
          在炙味，每一道菜品都是一次味蕾的旅行。<br class="hidden md:block">
          我们用匠心与创意，重新定义现代餐饮美学。
        </p>

        <!-- Feature tags — pure typography -->
        <div class="hero-reveal flex flex-wrap gap-x-6 gap-y-2 mt-8">
          <span
            v-for="(tag, i) in ['新鲜直采', '匠心烹饪', '极速送达']"
            :key="tag"
            class="text-white/25 font-display text-[11px] uppercase tracking-[0.2em] flex items-center gap-2"
          >
            <span
              class="inline-block w-1 h-1 rounded-full"
              :style="{ backgroundColor: i === 1 ? '#F2C14E' : '#FF6B35' }"
            />
            {{ tag }}
          </span>
        </div>

        <!-- CTAs -->
        <div class="hero-reveal flex items-center gap-4 mt-10">
          <router-link
            to="/order"
            class="inline-flex items-center gap-2.5 bg-brand-orange text-white px-7 py-3.5 rounded-full font-display text-sm uppercase tracking-wider hover:shadow-glow transition-all hover:gap-3.5 active:scale-[0.97]"
          >
            开始点餐
            <ArrowRight class="w-4 h-4" />
          </router-link>
          <router-link
            to="/order"
            class="inline-flex items-center gap-2 text-white/40 hover:text-white font-display text-xs uppercase tracking-wider transition-colors group"
          >
            浏览菜单
            <ArrowUpRight class="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </router-link>
        </div>

        <!-- Stats -->
        <div class="hero-reveal flex gap-10 mt-14 pt-8 border-t border-white/5">
          <div v-for="stat in stats" :key="stat.label">
            <span class="text-white font-display text-2xl font-bold tracking-tight">{{ stat.num }}</span>
            <p class="text-white/25 font-display text-[10px] uppercase tracking-widest mt-1">{{ stat.label }}</p>
          </div>
        </div>
      </div>

      <!-- Right: Asymmetric Dish Collage -->
      <div class="w-full lg:w-[58%] relative lg:absolute lg:right-0 lg:top-0 lg:bottom-0 overflow-hidden">
        <div class="w-full h-full p-2 lg:p-3 grid grid-cols-6 grid-rows-6 gap-1.5 lg:gap-2">
          <div
            v-for="(cell, idx) in collage"
            :key="idx"
            :class="[cell.span, 'relative overflow-hidden rounded-lg cursor-pointer']"
            @mouseenter="hoveredDish = idx"
            @mouseleave="hoveredDish = null"
            @click="$router.push('/order')"
          >
            <img
              :src="cell.image"
              :alt="cell.title || 'dish'"
              class="w-full h-full object-cover transition-all duration-700"
              :class="hoveredDish === idx ? 'scale-110 brightness-100' : 'scale-100 brightness-[0.7]'"
            />
            <div class="absolute inset-0" :class="cell.gradient" />
            <div v-if="cell.label || cell.title" class="absolute" :class="cell.textPos">
              <span v-if="cell.label" class="text-brand-orange text-[10px] uppercase tracking-[0.2em] font-display">
                {{ cell.label }}
              </span>
              <h3
                v-if="cell.title"
                class="text-white font-display font-semibold mt-0.5"
                :class="cell.titleSize || 'text-xs'"
              >
                {{ cell.title }}
              </h3>
              <p v-if="cell.price" class="text-white/40 font-display text-xs mt-0.5">¥{{ cell.price }}</p>
              <p v-if="cell.desc" class="text-white/40 font-serif text-xs mt-1">{{ cell.desc }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Philosophy Section -->
    <section ref="philRef" id="philosophy" class="w-full py-28 lg:py-36 px-8 lg:px-16">
      <div class="max-w-6xl mx-auto">
        <div class="reveal-item mb-20">
          <span class="text-brand-orange text-xs uppercase tracking-[0.35em] font-display font-medium">
            Our Philosophy
          </span>
          <h2 class="text-white font-display text-4xl lg:text-5xl font-bold mt-4 tracking-tight">
            我们的<span class="text-brand-orange">理念</span>
          </h2>
        </div>

        <div class="space-y-16">
          <div
            v-for="feature in features"
            :key="feature.num"
            class="reveal-item grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start group"
          >
            <div class="lg:col-span-2">
              <span class="text-white/10 font-display text-5xl font-bold tracking-tighter group-hover:text-brand-orange/20 transition-colors duration-500">
                {{ feature.num }}
              </span>
            </div>
            <div class="lg:col-span-5">
              <h3 class="text-white font-display text-2xl font-semibold tracking-tight group-hover:text-brand-orange transition-colors duration-300">
                {{ feature.title }}
              </h3>
            </div>
            <div class="lg:col-span-5">
              <p class="font-serif text-white/30 text-sm leading-[1.8]">{{ feature.description }}</p>
            </div>
            <div class="lg:col-span-12">
              <div class="h-px bg-white/5 mt-8 group-hover:bg-brand-orange/10 transition-colors duration-500" />
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Menu Showcase -->
    <section ref="menuRef" id="menu-showcase" class="w-full py-28 lg:py-36 px-8 lg:px-16">
      <div class="max-w-7xl mx-auto">
        <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-14">
          <div>
            <span class="text-brand-orange text-xs uppercase tracking-[0.35em] font-display font-medium">Menu</span>
            <h2 class="text-white font-display text-4xl lg:text-5xl font-bold mt-4 tracking-tight">
              精选<span class="text-brand-orange">菜单</span>
            </h2>
          </div>
          <div class="flex gap-2 flex-wrap">
            <button
              v-for="filter in filters"
              :key="filter.id"
              @click="activeFilter = filter.id"
              :class="[
                'px-5 py-2 rounded-full font-display text-xs uppercase tracking-wider transition-all',
                activeFilter === filter.id
                  ? 'bg-brand-orange text-white'
                  : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
              ]"
            >
              {{ filter.name }}
            </button>
          </div>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <router-link
            v-for="dish in filteredDishes"
            :key="dish.id"
            to="/order"
            class="menu-item group relative overflow-hidden rounded-xl cursor-pointer"
          >
            <div class="aspect-square overflow-hidden">
              <img
                :src="dish.image"
                :alt="dish.name"
                class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 brightness-75 group-hover:brightness-100"
                loading="lazy"
              />
            </div>
            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
            <div class="absolute bottom-0 left-0 right-0 p-4">
              <span v-if="dish.tags?.[0]" class="text-brand-orange text-[10px] uppercase tracking-[0.2em] font-display">
                {{ dish.tags[0] }}
              </span>
              <h3 class="text-white font-display font-semibold text-sm mt-1 group-hover:text-brand-orange transition-colors">
                {{ dish.name }}
              </h3>
              <p class="text-white/30 font-serif text-xs mt-1 line-clamp-1">{{ dish.description }}</p>
              <p class="text-brand-orange font-display font-bold text-sm mt-2">¥{{ dish.price }}</p>
            </div>
          </router-link>
        </div>

        <div class="mt-16 text-center">
          <router-link
            to="/order"
            class="inline-flex items-center gap-3 border border-white/15 text-white/70 px-8 py-4 rounded-full font-display text-sm uppercase tracking-wider hover:bg-brand-orange hover:border-brand-orange hover:text-white transition-all hover:shadow-glow"
          >
            查看完整菜单 <ArrowRight class="w-4 h-4" />
          </router-link>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="w-full py-16 px-8 lg:px-16 border-t border-white/[0.04]">
      <div class="max-w-7xl mx-auto">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div>
            <h3 class="text-white font-display font-bold text-2xl tracking-tight">GUSTO</h3>
            <p class="font-serif text-white/25 text-sm mt-4 leading-relaxed max-w-xs">
              现代臻选餐厅，以匠心与创新，为每一位食客呈现 unforgettable 的用餐体验。
            </p>
          </div>
          <div>
            <h4 class="text-white/50 font-display text-xs uppercase tracking-[0.2em] mb-4">快速链接</h4>
            <div class="space-y-2.5">
              <router-link to="/" class="block text-white/30 hover:text-brand-orange text-sm font-display transition-colors">首页</router-link>
              <router-link to="/order" class="block text-white/30 hover:text-brand-orange text-sm font-display transition-colors">甄选美味</router-link>
            </div>
          </div>
          <div>
            <h4 class="text-white/50 font-display text-xs uppercase tracking-[0.2em] mb-4">联系我们</h4>
            <p class="text-white/30 text-sm font-serif leading-relaxed">上海市静安区南京西路1266号</p>
            <p class="text-white/30 text-sm font-serif mt-2">预订热线: 021-8888-9999</p>
          </div>
        </div>
        <div class="mt-14 pt-8 border-t border-white/[0.04] text-center">
          <p class="text-white/15 text-xs font-display tracking-wider">© 2026 GUSTO. All rights reserved.</p>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ArrowRight, ArrowUpRight } from 'lucide-vue-next';
import { dishes } from '@/data/dishes';
import gsap from 'gsap';

const heroRef = ref<HTMLElement | null>(null);
const philRef = ref<HTMLElement | null>(null);
const menuRef = ref<HTMLElement | null>(null);
const hoveredDish = ref<number | null>(null);
const activeFilter = ref('all');

const stats = [
  { num: '50+', label: '精选菜品' },
  { num: '15', label: '年经验主厨' },
  { num: '20', label: '分钟送达' },
];

const filters = [
  { id: 'all', name: '全部' },
  { id: 'signature', name: '招牌' },
  { id: 'main', name: '主菜' },
  { id: 'dessert', name: '甜点' },
];

const filteredDishes = computed(() =>
  activeFilter.value === 'all' ? dishes : dishes.filter(d => d.category === activeFilter.value)
);

const showcaseDishes = dishes.slice(0, 6);

const collage = [
  { span: 'col-span-3 row-span-3', image: showcaseDishes[0].image, title: showcaseDishes[0].name, label: showcaseDishes[0].tags?.[0], price: showcaseDishes[0].price, gradient: 'bg-gradient-to-t from-black/70 via-transparent to-transparent', textPos: 'bottom-4 left-4 right-4', titleSize: 'text-base' },
  { span: 'col-span-2 row-span-2', image: showcaseDishes[1].image, title: showcaseDishes[1].name, gradient: 'bg-gradient-to-t from-black/60 to-transparent', textPos: 'bottom-3 left-3' },
  { span: 'col-span-1 row-span-2', image: showcaseDishes[2].image, title: showcaseDishes[2].name, gradient: 'bg-gradient-to-t from-black/60 to-transparent', textPos: 'bottom-2 left-2 right-2', titleSize: 'text-[10px] leading-tight' },
  { span: 'col-span-2 row-span-2', image: showcaseDishes[3].image, title: showcaseDishes[3].name, gradient: 'bg-gradient-to-t from-black/60 to-transparent', textPos: 'bottom-3 left-3' },
  { span: 'col-span-2 row-span-2', image: showcaseDishes[4].image, title: showcaseDishes[4].name, gradient: 'bg-gradient-to-t from-black/60 to-transparent', textPos: 'bottom-3 left-3' },
  { span: 'col-span-4 row-span-2', image: showcaseDishes[5].image, title: showcaseDishes[5].name, label: showcaseDishes[5].tags?.[0], desc: showcaseDishes[5].description, gradient: 'bg-gradient-to-r from-black/60 via-transparent to-transparent', textPos: 'bottom-4 left-4', titleSize: 'text-lg' },
  { span: 'col-span-2 row-span-2', image: '/dish-dessert.jpg', title: '熔岩巧克力', gradient: 'bg-gradient-to-t from-black/60 to-transparent', textPos: 'bottom-3 left-3' },
];

const features = [
  { num: '01', title: '新鲜直采', description: '每日清晨从合作农场空运直达，确保每一片叶子、每一块肉都保持最佳状态。我们坚持使用当季最优质的食材。' },
  { num: '02', title: '匠心烹饪', description: '拥有平均15年经验的专业厨师团队，以传统工艺融合现代创意，将每一道菜品都打造成艺术品。' },
  { num: '03', title: '极速送达', description: '从下单到上桌仅需20分钟，保温包装确保每一口都如刚出炉般热腾腾，美味不等待。' },
];

onMounted(() => {
  // Hero animations
  if (heroRef.value) {
    gsap.fromTo(
      heroRef.value.querySelectorAll('.hero-reveal'),
      { opacity: 0, y: 50 },
      { opacity: 1, y: 0, duration: 1, stagger: 0.1, ease: 'power3.out', delay: 0.2 }
    );
  }

  // Philosophy scroll reveal
  if (philRef.value) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            gsap.fromTo(
              entry.target.querySelectorAll('.reveal-item'),
              { opacity: 0, y: 40, filter: 'blur(8px)' },
              { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.8, stagger: 0.15, ease: 'power2.out' }
            );
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );
    observer.observe(philRef.value);
  }

  // Menu scroll reveal
  if (menuRef.value) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            gsap.fromTo(
              entry.target.querySelectorAll('.menu-item'),
              { opacity: 0, y: 50, scale: 0.95 },
              { opacity: 1, y: 0, scale: 1, duration: 0.7, stagger: 0.06, ease: 'power2.out' }
            );
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    observer.observe(menuRef.value);
  }
});
</script>
