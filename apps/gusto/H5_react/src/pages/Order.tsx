import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Minus, Search, Star, Leaf, ChefHat, CakeSlice, Wine, LayoutGrid, X, Loader2 } from 'lucide-react';
import { categories } from '@/data/dishes';
import { useCart } from '@/context/CartContext';
import { api } from '@/api';
import type { Dish } from '@/types';
import gsap from 'gsap';

const categoryIcons: Record<string, React.ReactNode> = {
  LayoutGrid: <LayoutGrid className="w-4 h-4" />,
  Star: <Star className="w-4 h-4" />,
  Leaf: <Leaf className="w-4 h-4" />,
  ChefHat: <ChefHat className="w-4 h-4" />,
  CakeSlice: <CakeSlice className="w-4 h-4" />,
  Wine: <Wine className="w-4 h-4" />,
};

function DishCard({ dish, index }: { dish: Dish; index: number }) {
  const { addToCart, items, updateQuantity } = useCart();
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const cartItem = items.find(item => item.dish.id === dish.id);
  const quantity = cartItem?.quantity || 0;

  useEffect(() => {
    if (!cardRef.current) return;
    gsap.fromTo(
      cardRef.current,
      { opacity: 0, y: 40 },
      {
        opacity: 1,
        y: 0,
        duration: 0.6,
        delay: index * 0.05,
        ease: 'power2.out',
      }
    );
  }, [index]);

  const handleAdd = useCallback(() => {
    addToCart(dish);
  }, [addToCart, dish]);

  return (
    <div
      ref={cardRef}
      className="group relative bg-[#111] rounded-2xl overflow-hidden border border-white/5 hover:border-brand-orange/30 transition-all duration-500"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image */}
      <div className="relative aspect-[3/2] overflow-hidden">
        <img
          src={dish.image}
          alt={dish.name}
          className={`w-full h-full object-cover transition-all duration-700 ${
            isHovered ? 'scale-110 brightness-100' : 'scale-100 brightness-90'
          }`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-transparent to-transparent" />

        {/* Hover overlay with add button */}
        <div
          className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity duration-300 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {quantity === 0 ? (
            <button
              onClick={handleAdd}
              className="flex items-center gap-2 bg-brand-orange text-white px-6 py-3 rounded-full font-display text-sm uppercase tracking-wider hover:shadow-glow transition-all transform hover:scale-105"
            >
              <Plus className="w-4 h-4" />
              加入购物车
            </button>
          ) : (
            <div className="flex items-center gap-3 bg-[#0A0A0A]/90 backdrop-blur-sm rounded-full px-4 py-2">
              <button
                onClick={() => updateQuantity(dish.id, quantity - 1)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-brand-orange transition-all"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-white font-display font-semibold w-6 text-center">{quantity}</span>
              <button
                onClick={handleAdd}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-brand-orange transition-all"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Tags */}
        {dish.tags && dish.tags.length > 0 && (
          <div className="absolute top-3 left-3 flex gap-1.5">
            {dish.tags.slice(0, 2).map(tag => (
              <span
                key={tag}
                className="px-2.5 py-1 bg-brand-orange/90 text-white text-[10px] font-display uppercase tracking-wider rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-display font-semibold text-base group-hover:text-brand-orange transition-colors">
              {dish.name}
            </h3>
            <p className="text-white/40 font-serif text-xs mt-1.5 line-clamp-2 leading-relaxed">
              {dish.description}
            </p>
          </div>
          <span className="text-brand-orange font-display font-bold text-xl flex-shrink-0">
            ¥{dish.price}
          </span>
        </div>

        {/* Ingredients */}
        {dish.ingredients && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {dish.ingredients.slice(0, 3).map(ing => (
              <span
                key={ing}
                className="px-2 py-0.5 bg-white/5 text-white/30 text-[10px] font-display rounded-md"
              >
                {ing}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DishModal({ dish, onClose }: { dish: Dish; onClose: () => void }) {
  const { addToCart } = useCart();
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  useEffect(() => {
    if (!modalRef.current) return;
    gsap.fromTo(
      modalRef.current,
      { opacity: 0, scale: 0.9, filter: 'blur(10px)' },
      { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.4, ease: 'power2.out' }
    );
  }, []);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div
        ref={modalRef}
        className="relative bg-[#111] rounded-3xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col md:flex-row shadow-2xl border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/80 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Image */}
        <div className="w-full md:w-1/2 aspect-square md:aspect-auto flex-shrink-0">
          <img
            src={dish.image}
            alt={dish.name}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Info */}
        <div className="flex-1 p-8 overflow-y-auto">
          {dish.tags && dish.tags[0] && (
            <span className="text-brand-orange text-xs uppercase tracking-[0.2em] font-display">
              {dish.tags[0]}
            </span>
          )}
          <h2 className="text-white font-display text-3xl font-bold mt-2 tracking-tight">
            {dish.name}
          </h2>
          <p className="text-brand-orange font-display text-2xl font-bold mt-4">
            ¥{dish.price}
          </p>
          <p className="font-serif text-white/50 text-sm mt-6 leading-relaxed">
            {dish.fullDescription || dish.description}
          </p>

          {dish.ingredients && (
            <div className="mt-6">
              <h4 className="text-white/70 font-display text-xs uppercase tracking-wider mb-3">主要配料</h4>
              <div className="flex flex-wrap gap-2">
                {dish.ingredients.map(ing => (
                  <span
                    key={ing}
                    className="px-3 py-1.5 bg-white/5 text-white/50 text-xs font-display rounded-lg border border-white/5"
                  >
                    {ing}
                  </span>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => {
              addToCart(dish);
              onClose();
            }}
            className="w-full mt-8 py-4 bg-brand-orange text-white font-display font-semibold text-sm uppercase tracking-widest rounded-xl hover:shadow-glow transition-all active:scale-[0.98]"
          >
            加入购物车
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Order() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.food.menu
      .get({
        category: activeCategory === 'all' ? undefined : activeCategory,
        search: searchQuery || undefined,
      })
      .then((result) => {
        if (result.data) {
          setDishes(
            result.data.map((dish: unknown) => {
              const d = dish as Record<string, unknown>;
              return {
                id: String(d.id),
                name: String(d.name),
                description: String(d.description),
                fullDescription: d.fullDescription ? String(d.fullDescription) : undefined,
                price: parseFloat(String(d.price)),
                image: d.image ? String(d.image) : '',
                category: String(d.category) as Dish['category'],
                tags: Array.isArray(d.tags) ? d.tags.map(String) : undefined,
                ingredients: Array.isArray(d.ingredients) ? d.ingredients.map(String) : undefined,
                available: d.available === null ? undefined : Boolean(d.available),
              };
            })
          );
        } else {
          setError('加载菜单失败');
        }
        setLoading(false);
      })
      .catch(() => {
        setError('网络错误，请稍后重试');
        setLoading(false);
      });
  }, [activeCategory, searchQuery]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!headerRef.current) return;
    gsap.fromTo(
      headerRef.current.querySelectorAll('.header-reveal'),
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.8, stagger: 0.1, ease: 'power2.out' }
    );
  }, []);

  useEffect(() => {
    if (!gridRef.current) return;
    const cards = gridRef.current.querySelectorAll('.dish-card-wrapper');
    gsap.fromTo(
      cards,
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.04, ease: 'power2.out' }
    );
  }, [activeCategory, searchQuery]);

  return (
    <div className="relative z-10 min-h-screen pt-20">
      {/* Header */}
      <div ref={headerRef} className="px-6 lg:px-12 py-12 lg:py-16">
        <div className="max-w-7xl mx-auto">
          <span className="header-reveal text-brand-orange text-xs uppercase tracking-[0.3em] font-display">
            Order Now
          </span>
          <h1 className="header-reveal text-white font-display text-4xl lg:text-6xl font-bold mt-4 tracking-tight">
            甄选<span className="text-brand-orange">美味</span>
          </h1>
          <p className="header-reveal font-serif text-white/40 text-sm mt-4 max-w-lg">
            浏览我们的精选菜单，将心仪的美食加入购物车，开启一段味蕾之旅。
          </p>

          {/* Search & Filter Bar */}
          <div className="header-reveal mt-10 flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                placeholder="搜索菜品..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-display text-sm placeholder:text-white/30 focus:outline-none focus:border-brand-orange/50 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Category Tabs */}
          <div className="header-reveal mt-6 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-display text-xs uppercase tracking-wider whitespace-nowrap transition-all flex-shrink-0 ${
                  activeCategory === cat.id
                    ? 'bg-brand-orange text-white shadow-glow'
                    : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                }`}
              >
                {categoryIcons[cat.icon]}
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Dish Grid */}
      <div className="px-6 lg:px-12 pb-24">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-brand-orange animate-spin" />
              <p className="text-white/30 font-display text-sm mt-4">加载菜单中...</p>
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <p className="text-white/30 font-display text-lg">{error}</p>
              <button
                onClick={() => { setActiveCategory('all'); setSearchQuery(''); }}
                className="mt-4 text-brand-orange text-sm font-display hover:underline"
              >
                重新加载
              </button>
            </div>
          ) : dishes.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-white/30 font-display text-lg">没有找到匹配的菜品</p>
              <button
                onClick={() => { setActiveCategory('all'); setSearchQuery(''); }}
                className="mt-4 text-brand-orange text-sm font-display hover:underline"
              >
                查看全部菜品
              </button>
            </div>
          ) : (
            <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {dishes.map((dish, index) => (
                <div key={dish.id} className="dish-card-wrapper">
                  <div onClick={() => setSelectedDish(dish)} className="cursor-pointer">
                    <DishCard dish={dish} index={index} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dish Modal */}
      {selectedDish && (
        <DishModal dish={selectedDish} onClose={() => setSelectedDish(null)} />
      )}
    </div>
  );
}
