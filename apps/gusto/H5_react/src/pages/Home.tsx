import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { dishes } from '@/data/dishes';
import gsap from 'gsap';

/* ─────────── Hero Section ─────────── */
function HeroSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [hoveredDish, setHoveredDish] = useState<number | null>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const els = sectionRef.current.querySelectorAll('.hero-reveal');
    gsap.fromTo(
      els,
      { opacity: 0, y: 50 },
      {
        opacity: 1,
        y: 0,
        duration: 1,
        stagger: 0.1,
        ease: 'power3.out',
        delay: 0.2,
      }
    );
  }, []);

  const showcaseDishes = dishes.slice(0, 6);

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="relative w-full min-h-screen flex flex-col lg:flex-row"
    >
      {/* Left: Text Content */}
      <div className="w-full lg:w-[42%] flex flex-col justify-center px-8 md:px-12 lg:px-16 py-24 lg:py-0 relative z-20">
        <span className="hero-reveal text-brand-orange text-xs uppercase tracking-[0.35em] font-display font-medium">
          Modern Dining Since 2026
        </span>

        <h1 className="hero-reveal text-white font-display text-5xl md:text-6xl lg:text-7xl font-bold leading-[0.95] tracking-tight mt-6">
          探索
          <br />
          <span className="text-brand-orange">味蕾</span>
          <br />
          新边界
        </h1>

        <p className="hero-reveal font-serif text-white/35 text-sm mt-8 max-w-sm leading-relaxed">
          在炙味，每一道菜品都是一次味蕾的旅行。
          <br className="hidden md:block" />
          我们用匠心与创意，重新定义现代餐饮美学。
        </p>

        {/* Three feature tags — pure typography, no cards */}
        <div className="hero-reveal flex flex-wrap gap-x-6 gap-y-2 mt-8">
          {['新鲜直采', '匠心烹饪', '极速送达'].map((tag, i) => (
            <span
              key={tag}
              className="text-white/25 font-display text-[11px] uppercase tracking-[0.2em] flex items-center gap-2"
            >
              <span
                className="inline-block w-1 h-1 rounded-full"
                style={{
                  backgroundColor: i === 0 ? '#FF6B35' : i === 1 ? '#F2C14E' : '#FF6B35',
                }}
              />
              {tag}
            </span>
          ))}
        </div>

        {/* CTA Buttons — clearly separated, no overlap */}
        <div className="hero-reveal flex items-center gap-4 mt-10">
          <Link
            to="/order"
            className="inline-flex items-center gap-2.5 bg-brand-orange text-white px-7 py-3.5 rounded-full font-display text-sm uppercase tracking-wider hover:shadow-glow transition-all hover:gap-3.5 active:scale-[0.97]"
          >
            开始点餐
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/order"
            className="inline-flex items-center gap-2 text-white/40 hover:text-white font-display text-xs uppercase tracking-wider transition-colors group"
          >
            浏览菜单
            <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </Link>
        </div>

        {/* Stats row */}
        <div className="hero-reveal flex gap-10 mt-14 pt-8 border-t border-white/5">
          {[
            { num: '50+', label: '精选菜品' },
            { num: '15', label: '年经验主厨' },
            { num: '20', label: '分钟送达' },
          ].map((stat) => (
            <div key={stat.label}>
              <span className="text-white font-display text-2xl font-bold tracking-tight">
                {stat.num}
              </span>
              <p className="text-white/25 font-display text-[10px] uppercase tracking-widest mt-1">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Asymmetric Dish Collage */}
      <div className="w-full lg:w-[58%] relative lg:absolute lg:right-0 lg:top-0 lg:bottom-0 overflow-hidden">
        <div className="w-full h-full p-2 lg:p-3 grid grid-cols-6 grid-rows-6 gap-1.5 lg:gap-2">
          {/* Large — Burger (top-left of collage) */}
          <div
            className="col-span-3 row-span-3 relative overflow-hidden rounded-lg cursor-pointer"
            onMouseEnter={() => setHoveredDish(0)}
            onMouseLeave={() => setHoveredDish(null)}
            onClick={() => window.location.href = '/order'}
          >
            <img
              src={showcaseDishes[0].image}
              alt={showcaseDishes[0].name}
              className={`w-full h-full object-cover transition-all duration-700 ${
                hoveredDish === 0 ? 'scale-110 brightness-100' : 'scale-100 brightness-[0.7]'
              }`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute bottom-4 left-4">
              <span className="text-brand-orange text-[10px] uppercase tracking-[0.2em] font-display">
                {showcaseDishes[0].tags?.[0]}
              </span>
              <h3 className="text-white font-display font-semibold text-base mt-0.5">
                {showcaseDishes[0].name}
              </h3>
              <p className="text-white/40 font-display text-xs mt-0.5">
                ¥{showcaseDishes[0].price}
              </p>
            </div>
          </div>

          {/* Medium — Bibimbap (top-mid) */}
          <div
            className="col-span-2 row-span-2 relative overflow-hidden rounded-lg cursor-pointer"
            onMouseEnter={() => setHoveredDish(1)}
            onMouseLeave={() => setHoveredDish(null)}
            onClick={() => window.location.href = '/order'}
          >
            <img
              src={showcaseDishes[1].image}
              alt={showcaseDishes[1].name}
              className={`w-full h-full object-cover transition-all duration-700 ${
                hoveredDish === 1 ? 'scale-110 brightness-100' : 'scale-100 brightness-[0.7]'
              }`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-3 left-3">
              <h3 className="text-white font-display text-xs font-semibold">
                {showcaseDishes[1].name}
              </h3>
            </div>
          </div>

          {/* Small — Steak (top-right) */}
          <div
            className="col-span-1 row-span-2 relative overflow-hidden rounded-lg cursor-pointer"
            onMouseEnter={() => setHoveredDish(2)}
            onMouseLeave={() => setHoveredDish(null)}
            onClick={() => window.location.href = '/order'}
          >
            <img
              src={showcaseDishes[2].image}
              alt={showcaseDishes[2].name}
              className={`w-full h-full object-cover transition-all duration-700 ${
                hoveredDish === 2 ? 'scale-110 brightness-100' : 'scale-100 brightness-[0.7]'
              }`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-2 left-2 right-2">
              <h3 className="text-white font-display text-[10px] font-semibold leading-tight">
                {showcaseDishes[2].name}
              </h3>
            </div>
          </div>

          {/* Small — Pasta (mid-right) */}
          <div
            className="col-span-2 row-span-2 relative overflow-hidden rounded-lg cursor-pointer"
            onMouseEnter={() => setHoveredDish(3)}
            onMouseLeave={() => setHoveredDish(null)}
            onClick={() => window.location.href = '/order'}
          >
            <img
              src={showcaseDishes[3].image}
              alt={showcaseDishes[3].name}
              className={`w-full h-full object-cover transition-all duration-700 ${
                hoveredDish === 3 ? 'scale-110 brightness-100' : 'scale-100 brightness-[0.7]'
              }`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-3 left-3">
              <h3 className="text-white font-display text-xs font-semibold">
                {showcaseDishes[3].name}
              </h3>
            </div>
          </div>

          {/* Medium — Salmon (mid-left) */}
          <div
            className="col-span-2 row-span-2 relative overflow-hidden rounded-lg cursor-pointer"
            onMouseEnter={() => setHoveredDish(4)}
            onMouseLeave={() => setHoveredDish(null)}
            onClick={() => window.location.href = '/order'}
          >
            <img
              src={showcaseDishes[4].image}
              alt={showcaseDishes[4].name}
              className={`w-full h-full object-cover transition-all duration-700 ${
                hoveredDish === 4 ? 'scale-110 brightness-100' : 'scale-100 brightness-[0.7]'
              }`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-3 left-3">
              <h3 className="text-white font-display text-xs font-semibold">
                {showcaseDishes[4].name}
              </h3>
            </div>
          </div>

          {/* Large — Chef / Featured (bottom spanning) */}
          <div
            className="col-span-4 row-span-2 relative overflow-hidden rounded-lg cursor-pointer"
            onMouseEnter={() => setHoveredDish(5)}
            onMouseLeave={() => setHoveredDish(null)}
            onClick={() => window.location.href = '/order'}
          >
            <img
              src={showcaseDishes[5].image}
              alt={showcaseDishes[5].name}
              className={`w-full h-full object-cover transition-all duration-700 ${
                hoveredDish === 5 ? 'scale-105 brightness-100' : 'scale-100 brightness-[0.7]'
              }`}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4">
              <span className="text-brand-yellow text-[10px] uppercase tracking-[0.2em] font-display">
                {showcaseDishes[5].tags?.[0]}
              </span>
              <h3 className="text-white font-display font-semibold text-lg mt-0.5">
                {showcaseDishes[5].name}
              </h3>
              <p className="text-white/40 font-serif text-xs mt-1">
                {showcaseDishes[5].description}
              </p>
            </div>
          </div>

          {/* Small — Dessert (bottom corner) */}
          <div
            className="col-span-2 row-span-2 relative overflow-hidden rounded-lg cursor-pointer"
            onMouseEnter={() => setHoveredDish(6)}
            onMouseLeave={() => setHoveredDish(null)}
            onClick={() => window.location.href = '/order'}
          >
            <img
              src="/dish-dessert.jpg"
              alt="甜点"
              className={`w-full h-full object-cover transition-all duration-700 ${
                hoveredDish === 6 ? 'scale-110 brightness-100' : 'scale-100 brightness-[0.7]'
              }`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-3 left-3">
              <h3 className="text-white font-display text-xs font-semibold">熔岩巧克力</h3>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────── Philosophy Section ─────────── */
function PhilosophySection() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const els = entry.target.querySelectorAll('.reveal-item');
            gsap.fromTo(
              els,
              { opacity: 0, y: 40, filter: 'blur(8px)' },
              {
                opacity: 1,
                y: 0,
                filter: 'blur(0px)',
                duration: 0.8,
                stagger: 0.15,
                ease: 'power2.out',
              }
            );
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );
    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const features = [
    {
      num: '01',
      title: '新鲜直采',
      description: '每日清晨从合作农场空运直达，确保每一片叶子、每一块肉都保持最佳状态。我们坚持使用当季最优质的食材。',
    },
    {
      num: '02',
      title: '匠心烹饪',
      description: '拥有平均15年经验的专业厨师团队，以传统工艺融合现代创意，将每一道菜品都打造成艺术品。',
    },
    {
      num: '03',
      title: '极速送达',
      description: '从下单到上桌仅需20分钟，保温包装确保每一口都如刚出炉般热腾腾，美味不等待。',
    },
  ];

  return (
    <section
      ref={sectionRef}
      id="philosophy"
      className="w-full py-28 lg:py-36 px-8 lg:px-16"
    >
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="reveal-item mb-20">
          <span className="text-brand-orange text-xs uppercase tracking-[0.35em] font-display font-medium">
            Our Philosophy
          </span>
          <h2 className="text-white font-display text-4xl lg:text-5xl font-bold mt-4 tracking-tight">
            我们的<span className="text-brand-orange">理念</span>
          </h2>
        </div>

        {/* Features — editorial layout, no cards */}
        <div className="space-y-16">
          {features.map((feature) => (
            <div
              key={feature.num}
              className="reveal-item grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start group"
            >
              {/* Number */}
              <div className="lg:col-span-2">
                <span className="text-white/10 font-display text-5xl font-bold tracking-tighter group-hover:text-brand-orange/20 transition-colors duration-500">
                  {feature.num}
                </span>
              </div>

              {/* Content */}
              <div className="lg:col-span-5">
                <h3 className="text-white font-display text-2xl font-semibold tracking-tight group-hover:text-brand-orange transition-colors duration-300">
                  {feature.title}
                </h3>
              </div>

              <div className="lg:col-span-5">
                <p className="font-serif text-white/30 text-sm leading-[1.8]">
                  {feature.description}
                </p>
              </div>

              {/* Divider line */}
              <div className="lg:col-span-12">
                <div className="h-px bg-white/5 mt-8 group-hover:bg-brand-orange/10 transition-colors duration-500" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────── Menu Showcase Section ─────────── */
function MenuShowcase() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [activeFilter, setActiveFilter] = useState('all');

  const filters = [
    { id: 'all', name: '全部' },
    { id: 'signature', name: '招牌' },
    { id: 'main', name: '主菜' },
    { id: 'dessert', name: '甜点' },
  ];

  const filteredDishes = activeFilter === 'all'
    ? dishes
    : dishes.filter(d => d.category === activeFilter);

  useEffect(() => {
    if (!sectionRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const els = entry.target.querySelectorAll('.menu-item');
            gsap.fromTo(
              els,
              { opacity: 0, y: 50, scale: 0.95 },
              {
                opacity: 1,
                y: 0,
                scale: 1,
                duration: 0.7,
                stagger: 0.06,
                ease: 'power2.out',
              }
            );
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [activeFilter]);

  return (
    <section
      ref={sectionRef}
      id="menu-showcase"
      className="w-full py-28 lg:py-36 px-8 lg:px-16"
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-14">
          <div>
            <span className="text-brand-orange text-xs uppercase tracking-[0.35em] font-display font-medium">
              Menu
            </span>
            <h2 className="text-white font-display text-4xl lg:text-5xl font-bold mt-4 tracking-tight">
              精选<span className="text-brand-orange">菜单</span>
            </h2>
          </div>

          <div className="flex gap-2 flex-wrap">
            {filters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={`px-5 py-2 rounded-full font-display text-xs uppercase tracking-wider transition-all ${
                  activeFilter === filter.id
                    ? 'bg-brand-orange text-white'
                    : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
                }`}
              >
                {filter.name}
              </button>
            ))}
          </div>
        </div>

        {/* Dish Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredDishes.map((dish) => (
            <Link
              to="/order"
              key={dish.id}
              className="menu-item group relative overflow-hidden rounded-xl cursor-pointer"
            >
              <div className="aspect-square overflow-hidden">
                <img
                  src={dish.image}
                  alt={dish.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 brightness-75 group-hover:brightness-100"
                  loading="lazy"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                {dish.tags && dish.tags[0] && (
                  <span className="text-brand-orange text-[10px] uppercase tracking-[0.2em] font-display">
                    {dish.tags[0]}
                  </span>
                )}
                <h3 className="text-white font-display font-semibold text-sm mt-1 group-hover:text-brand-orange transition-colors">
                  {dish.name}
                </h3>
                <p className="text-white/30 font-serif text-xs mt-1 line-clamp-1">
                  {dish.description}
                </p>
                <p className="text-brand-orange font-display font-bold text-sm mt-2">
                  ¥{dish.price}
                </p>
              </div>
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <Link
            to="/order"
            className="inline-flex items-center gap-3 border border-white/15 text-white/70 px-8 py-4 rounded-full font-display text-sm uppercase tracking-wider hover:bg-brand-orange hover:border-brand-orange hover:text-white transition-all hover:shadow-glow"
          >
            查看完整菜单 <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─────────── Footer ─────────── */
function Footer() {
  return (
    <footer className="w-full py-16 px-8 lg:px-16 border-t border-white/[0.04]">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div>
            <h3 className="text-white font-display font-bold text-2xl tracking-tight">
              GUSTO
            </h3>
            <p className="font-serif text-white/25 text-sm mt-4 leading-relaxed max-w-xs">
              现代臻选餐厅，以匠心与创新，为每一位食客呈现 unforgettable 的用餐体验。
            </p>
          </div>
          <div>
            <h4 className="text-white/50 font-display text-xs uppercase tracking-[0.2em] mb-4">
              快速链接
            </h4>
            <div className="space-y-2.5">
              <Link to="/" className="block text-white/30 hover:text-brand-orange text-sm font-display transition-colors">
                首页
              </Link>
              <Link to="/order" className="block text-white/30 hover:text-brand-orange text-sm font-display transition-colors">
                甄选美味
              </Link>
            </div>
          </div>
          <div>
            <h4 className="text-white/50 font-display text-xs uppercase tracking-[0.2em] mb-4">
              联系我们
            </h4>
            <p className="text-white/30 text-sm font-serif leading-relaxed">
              上海市静安区南京西路1266号
            </p>
            <p className="text-white/30 text-sm font-serif mt-2">
              预订热线: 021-8888-9999
            </p>
          </div>
        </div>
        <div className="mt-14 pt-8 border-t border-white/[0.04] text-center">
          <p className="text-white/15 text-xs font-display tracking-wider">
            © 2026 GUSTO. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ─────────── Home Page ─────────── */
export default function Home() {
  return (
    <div className="relative z-10">
      <HeroSection />
      <PhilosophySection />
      <MenuShowcase />
      <Footer />
    </div>
  );
}
