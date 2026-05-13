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
  image?: string;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'delivering'
  | 'delivered'
  | 'cancelled';

export interface OrderStatusHistory {
  id: string;
  orderId: string;
  status: OrderStatus;
  prevStatus?: string;
  message?: string;
  createdAt: string;
}

export interface Order {
  id: string;
  userId: string;
  orderNo: string;
  items: OrderItem[];
  total: string;
  status: OrderStatus;
  address?: string;
  phone?: string;
  contactName?: string;
  note?: string;
  deliveryType?: string;
  estimatedTime?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OrderWithHistory {
  order: Order;
  history: OrderStatusHistory[];
}

export interface UserAddress {
  id: string;
  userId: string;
  label?: string;
  address: string;
  phone?: string;
  contactName?: string;
  isDefault?: boolean;
  createdAt?: string;
}
