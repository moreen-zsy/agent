/**
 * A2UI DishDetail 组件
 * 展示单一菜品详情，包含图片、名称、价格、描述和购物车按钮
 */

import type { A2UIComponentProps } from './types.js';
import { ShoppingCart } from 'lucide-react';

export interface DishDetailData {
  id: string;
  name: string;
  price: number | string;
  description?: string;
  fullDescription?: string;
  image?: string;
  ingredients?: string[];
  tags?: string[];
}

export interface DishDetailProps extends A2UIComponentProps {
  dish?: DishDetailData;
}

export function A2UIDishDetail({ dish, _store, _surfaceId, _componentId }: DishDetailProps) {
  if (!dish) {
    return (
      <div className="w-full bg-[#111] rounded-2xl border border-white/5 p-6 text-center">
        <p className="text-white/30 text-sm">菜品数据加载中...</p>
      </div>
    );
  }

  const price = typeof dish.price === 'string' ? parseFloat(dish.price) : (dish.price || 0);

  const handleAddToCart = () => {
    if (!_store || !_surfaceId || !_componentId) return;
    _store.sendUserAction({
      action: {
        name: 'add_to_cart',
        surfaceId: _surfaceId,
        sourceComponentId: _componentId,
        timestamp: new Date().toISOString(),
        context: { dishId: dish.id },
      },
    });
  };

  return (
    <div className="w-full bg-[#111] rounded-2xl border border-white/5 overflow-hidden">
      {/* Image */}
      {dish.image ? (
        <img
          src={dish.image}
          alt={dish.name}
          className="w-full h-48 object-cover"
        />
      ) : (
        <div className="w-full h-48 bg-white/5 flex items-center justify-center">
          <span className="text-white/20 text-sm">暂无图片</span>
        </div>
      )}

      {/* Content */}
      <div className="p-5 space-y-3">
        {/* Name & Price */}
        <div className="flex items-center justify-between">
          <h3 className="text-white font-display text-lg font-bold">{dish.name}</h3>
          <span className="text-brand-orange font-display font-semibold text-lg">
            ¥{price.toFixed(2)}
          </span>
        </div>

        {/* Tags */}
        {dish.tags && dish.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {dish.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-brand-orange/10 text-brand-orange text-xs rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Description */}
        {dish.fullDescription && (
          <p className="text-white/50 text-sm leading-relaxed">{dish.fullDescription}</p>
        )}
        {!dish.fullDescription && dish.description && (
          <p className="text-white/50 text-sm leading-relaxed">{dish.description}</p>
        )}

        {/* Ingredients */}
        {dish.ingredients && dish.ingredients.length > 0 && (
          <div className="pt-2">
            <p className="text-white/30 text-xs mb-2">主要配料</p>
            <div className="flex flex-wrap gap-2">
              {dish.ingredients.map((ing) => (
                <span
                  key={ing}
                  className="px-2 py-1 bg-white/5 text-white/50 text-xs rounded-lg border border-white/5"
                >
                  {ing}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Add to Cart Button */}
        <button
          onClick={handleAddToCart}
          className="w-full mt-3 py-3 bg-brand-orange text-white font-display font-semibold text-sm rounded-xl hover:shadow-glow transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <ShoppingCart className="w-4 h-4" />
          加入购物车
        </button>
      </div>
    </div>
  );
}
