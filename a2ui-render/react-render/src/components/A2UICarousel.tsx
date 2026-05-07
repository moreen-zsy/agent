/**
 * A2UI Carousel 轮播图组件 (v0.9)
 * 支持自动播放和手动切换
 */

import { useState, useEffect, useCallback } from 'react';

export interface CarouselItem {
  imageUrl: string;
  title?: string;
  description?: string;
}

export interface CarouselProps {
  items?: CarouselItem[];
  autoPlay?: boolean;
  interval?: number;
}

export function A2UICarousel({ items = [], autoPlay = true, interval = 3000 }: CarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
  }, [items.length]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  }, [items.length]);

  useEffect(() => {
    if (!autoPlay || items.length <= 1) return;
    const timer = setInterval(goToNext, interval);
    return () => clearInterval(timer);
  }, [autoPlay, interval, goToNext, items.length]);

  if (items.length === 0) {
    return <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">暂无图片</div>;
  }

  const currentItem = items[currentIndex];
  if (!currentItem) {
    return <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">加载中</div>;
  }

  return (
    <div className="relative w-full overflow-hidden rounded-lg">
      {/* 图片区域 */}
      <div className="relative w-full h-64">
        <img
          src={currentItem.imageUrl}
          alt={currentItem.title || ''}
          className="w-full h-full object-cover transition-opacity duration-300"
        />
        {/* 标题遮罩 */}
        {(currentItem.title || currentItem.description) && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
            {currentItem.title && (
              <h3 className="text-white font-semibold text-lg">{currentItem.title}</h3>
            )}
            {currentItem.description && (
              <p className="text-white/80 text-sm mt-1">{currentItem.description}</p>
            )}
          </div>
        )}
      </div>

      {/* 左右切换按钮 */}
      {items.length > 1 && (
        <>
          <button
            onClick={goToPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors"
          >
            ←
          </button>
          <button
            onClick={goToNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors"
          >
            →
          </button>
        </>
      )}

      {/* 指示器 */}
      {items.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
          {items.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentIndex ? 'bg-white' : 'bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
