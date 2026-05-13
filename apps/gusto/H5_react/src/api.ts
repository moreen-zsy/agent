const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface Dish {
  id: string;
  name: string;
  description: string;
  fullDescription?: string;
  price: number;
  image?: string;
  category: string;
  tags?: string[];
  ingredients?: string[];
  available?: boolean;
  createdAt?: string;
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

export interface User {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  avatar?: string;
}

export const api = {
  food: {
    menu: {
      get: (params?: { category?: string; search?: string; page?: number; pageSize?: number }) => {
        const query = new URLSearchParams();
        if (params?.category) query.set('category', params.category);
        if (params?.search) query.set('search', params.search);
        if (params?.page) query.set('page', String(params.page));
        if (params?.pageSize) query.set('pageSize', String(params.pageSize));
        const qs = query.toString();
        return request<PaginatedResult<Dish>>(`/api/food/menu${qs ? `?${qs}` : ''}`);
      },
      getById: (id: string) => request<ApiResponse<Dish>>(`/api/food/menu/${id}`),
    },
    order: {
      post: (body: {
        items: OrderItem[];
        address?: string;
        phone?: string;
        contactName?: string;
        note?: string;
        deliveryType?: string;
      }, token?: string) =>
        request<ApiResponse<Order>>('/api/food/order', {
          method: 'POST',
          body: JSON.stringify(body),
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }),
    },
    orders: {
      get: (token: string, params?: { page?: number; pageSize?: number; status?: string }) => {
        const query = new URLSearchParams();
        if (params?.page) query.set('page', String(params.page));
        if (params?.pageSize) query.set('pageSize', String(params.pageSize));
        if (params?.status) query.set('status', params.status);
        const qs = query.toString();
        return request<PaginatedResult<Order>>(`/api/food/orders${qs ? `?${qs}` : ''}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      },
      getById: (id: string, token: string) =>
        request<ApiResponse<OrderWithHistory>>(`/api/food/orders/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      cancel: (id: string, token: string, reason?: string) =>
        request<ApiResponse<Order>>(`/api/food/orders/${id}/cancel`, {
          method: 'POST',
          body: JSON.stringify(reason ? { reason } : {}),
          headers: { Authorization: `Bearer ${token}` },
        }),
      delete: (id: string, token: string) =>
        request<ApiResponse<Order>>(`/api/food/orders/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }),
    },
    addresses: {
      get: (token: string) =>
        request<ApiResponse<UserAddress[]>>(`/api/food/addresses`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      create: (token: string, body: Omit<UserAddress, 'id' | 'userId' | 'createdAt'>) =>
        request<ApiResponse<UserAddress>>('/api/food/addresses', {
          method: 'POST',
          body: JSON.stringify(body),
          headers: { Authorization: `Bearer ${token}` },
        }),
      update: (id: string, token: string, body: Partial<Omit<UserAddress, 'id' | 'userId' | 'createdAt'>>) =>
        request<ApiResponse<UserAddress>>(`/api/food/addresses/${id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
          headers: { Authorization: `Bearer ${token}` },
        }),
      delete: (id: string, token: string) =>
        request<ApiResponse<UserAddress>>(`/api/food/addresses/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }),
    },
  },
  auth: {
    register: (body: { email: string; name: string }) =>
      request<ApiResponse<{ token: string; user: User }>>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    login: (body: { email: string }) =>
      request<ApiResponse<{ token: string; user: User }>>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    me: (token: string) =>
      request<ApiResponse<{ user: User }>>('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    updateProfile: (token: string, body: { name?: string; phone?: string; avatar?: string }) =>
      request<ApiResponse<{ user: User }>>('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(body),
        headers: { Authorization: `Bearer ${token}` },
      }),
  },
};
