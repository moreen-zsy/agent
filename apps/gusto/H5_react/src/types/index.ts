export interface Dish {
  id: string;
  name: string;
  description: string;
  fullDescription?: string;
  price: number;
  image: string;
  category: 'signature' | 'main' | 'dessert' | 'drink' | 'appetizer';
  tags?: string[];
  ingredients?: string[];
}

export interface CartItem {
  dish: Dish;
  quantity: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}
