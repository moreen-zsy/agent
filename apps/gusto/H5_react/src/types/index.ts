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
  available?: boolean;
  createdAt?: string;
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

export interface OrderItem {
  dishId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  total: number;
  status: string;
  address?: string;
  createdAt?: string;
}
