import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Dish, CartItem } from '@/types';

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([]);
  const isOpen = ref(false);

  const totalItems = computed(() => items.value.reduce((sum, item) => sum + item.quantity, 0));
  const totalPrice = computed(() => items.value.reduce((sum, item) => sum + item.dish.price * item.quantity, 0));

  function addToCart(dish: Dish) {
    const existing = items.value.find(item => item.dish.id === dish.id);
    if (existing) {
      existing.quantity++;
    } else {
      items.value.push({ dish, quantity: 1 });
    }
    isOpen.value = true;
  }

  function removeFromCart(dishId: string) {
    items.value = items.value.filter(item => item.dish.id !== dishId);
  }

  function updateQuantity(dishId: string, quantity: number) {
    if (quantity <= 0) {
      removeFromCart(dishId);
      return;
    }
    const item = items.value.find(i => i.dish.id === dishId);
    if (item) item.quantity = quantity;
  }

  function clearCart() {
    items.value = [];
  }

  function toggleCart() { isOpen.value = !isOpen.value; }
  function openCart() { isOpen.value = true; }
  function closeCart() { isOpen.value = false; }

  return {
    items,
    isOpen,
    totalItems,
    totalPrice,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    toggleCart,
    openCart,
    closeCart,
  };
});
