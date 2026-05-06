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
  fullDescription: string | null;
  price: number;
  image: string | null;
  category: string;
  tags: string[] | null;
  ingredients: string[] | null;
  available: boolean | null;
  createdAt: string | null;
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
  total: string;
  status: string;
  address: string | null;
  createdAt: string | null;
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
      post: (body: { items: OrderItem[]; address?: string }, token?: string) =>
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
    },
  },
  auth: {
    register: (body: { email: string; name: string }) =>
      request<ApiResponse<{ token: string; user: { id: string; email: string; name: string | null } }>>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    login: (body: { email: string }) =>
      request<ApiResponse<{ token: string; user: { id: string; email: string; name: string | null } }>>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    me: (token: string) =>
      request<ApiResponse<{ user: { id: string; email: string } }>>('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      }),
  },
};
