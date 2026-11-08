/**
 * 后端 API 客户端
 *
 * 对齐 `a2ui-server2` 的实现：
 * - 路由前缀为 `/food`、`/auth`、`/agent`（无 `/api` 前缀）
 * - 成功响应：`{ success: true, data }`
 * - 失败响应：`{ success: false, error: { code, message } }`
 * - 认证：`Authorization: Bearer <accessToken>`
 * - 菜品价格为 Prisma Numeric，序列化后为 **字符串**（如 "88.00"）
 */

import type { OrderStatus } from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/** 后端统一错误结构 */
export interface ApiError {
  code: string;
  message: string;
}

/** 部分错误响应可能只带 message（如 auth 的 401） */
type RawErrorBody = { error?: string | ApiError; message?: string };

/** 请求失败时抛出的错误，携带 HTTP 状态码与后端错误码 */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

/** 把后端各种错误形态归一为可读消息 */
function extractError(body: unknown, status: number): ApiRequestError {
  const raw = (body ?? {}) as RawErrorBody & { success?: boolean };

  // { success: false, error: { code, message } }
  if (raw.error && typeof raw.error === 'object') {
    return new ApiRequestError(raw.error.message || `HTTP ${status}`, status, raw.error.code);
  }
  // { error: "..." }（Elysia status(code, string) 或简单对象）
  if (typeof raw.error === 'string') {
    return new ApiRequestError(raw.error, status);
  }
  // Elysia 校验错误：{ type, on, property, message, ... }
  if (raw.message) {
    return new ApiRequestError(raw.message, status);
  }
  return new ApiRequestError(`HTTP ${status}`, status);
}

async function requestRaw<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string> | undefined),
    },
  });

  const text = await response.text();

  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    throw extractError(parsed, response.status);
  }

  return parsed as T;
}

/** 解包 `{ success, data }`，直接拿到 data */
async function requestData<T>(path: string, options?: RequestInit): Promise<T> {
  const body = await requestRaw<{ success?: boolean; data?: T }>(path, options);
  if (body && typeof body === 'object' && 'data' in body) {
    return body.data as T;
  }
  return body as unknown as T;
}

/** 保留原始响应（需要读取 success 字段时） */
export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  return requestRaw<T>(path, options);
}

function authHeaders(token?: string): Record<string, string> | undefined {
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  }
  const qs = q.toString();
  return qs ? `?${qs}` : '';
}

// ─────────────────────────── 类型 ───────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
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

/** 菜品（Prisma `Dishes` 模型） */
export interface RawDish {
  id: string;
  name: string;
  description?: string | null;
  /** 后端字段名为下划线风格 */
  full_description?: string | null;
  /** Prisma Numeric 序列化为字符串，如 "88.00" */
  price: string | number;
  image?: string | null;
  category: string;
  tags?: string[] | null;
  ingredients?: string[] | null;
  available?: boolean | null;
  createdAt?: string;
}

export interface RawOrderItem {
  dishId: string;
  name: string;
  quantity: number;
  price: number | string;
  image?: string;
}

export interface RawOrderStatusHistory {
  id: string;
  orderId: string;
  status: OrderStatus;
  prevStatus?: string | null;
  message?: string | null;
  createdAt: string;
}

/** 订单（Prisma `Orders` 模型） */
export interface RawOrder {
  id: string;
  userId: string;
  orderNo: string;
  items: RawOrderItem[];
  /** Numeric 序列化为字符串 */
  total: string | number;
  status: OrderStatus;
  address?: string | null;
  phone?: string | null;
  contactName?: string | null;
  note?: string | null;
  deliveryType?: string | null;
  estimatedTime?: string | null;
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface RawOrderWithHistory {
  order: RawOrder;
  history: RawOrderStatusHistory[];
}

/** 地址（Prisma `UserAddresses` 模型，一对多） */
export interface RawUserAddress {
  id: string;
  userId: string;
  label?: string | null;
  address: string;
  phone?: string | null;
  contactName?: string | null;
  isDefault?: boolean | null;
  createdAt?: string;
}

export interface RawUser {
  id: string;
  email: string;
  name?: string | null;
  avatar?: string | null;
  phone?: string | null;
  createdAt?: string;
}

/** 登录/注册响应（accessToken + refreshToken） */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: string | number;
}

/** 把 Numeric 字符串安全转成数字 */
export function toNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') return value;
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

// ─────────────────────── Raw → UI 映射 ───────────────────────
// 后端返回的 prisma 模型字段可为 null、下划线命名、Numeric 为字符串，
// 这里统一转换为 UI 层 types 定义的结构。

export function mapDish(d: RawDish): import('./types').Dish {
  return {
    id: String(d.id),
    name: String(d.name),
    description: d.description ?? '',
    fullDescription: d.full_description ?? undefined,
    price: toNumber(d.price),
    image: d.image ?? '',
    category: (d.category ?? '') as import('./types').Dish['category'],
    tags: d.tags ?? undefined,
    ingredients: d.ingredients ?? undefined,
    available: d.available ?? undefined,
    createdAt: d.createdAt,
  };
}

export function mapAddress(a: RawUserAddress): import('./types').UserAddress {
  return {
    id: String(a.id),
    userId: String(a.userId),
    label: a.label ?? undefined,
    address: a.address,
    phone: a.phone ?? undefined,
    contactName: a.contactName ?? undefined,
    isDefault: a.isDefault ?? undefined,
    createdAt: a.createdAt,
  };
}

export function mapOrder(o: RawOrder): import('./types').Order {
  return {
    id: String(o.id),
    userId: String(o.userId),
    orderNo: o.orderNo,
    items: (o.items ?? []).map((it) => ({
      dishId: it.dishId,
      name: it.name,
      quantity: toNumber(it.quantity),
      price: toNumber(it.price),
      image: it.image,
    })),
    total: String(o.total),
    status: o.status,
    address: o.address ?? undefined,
    phone: o.phone ?? undefined,
    contactName: o.contactName ?? undefined,
    note: o.note ?? undefined,
    deliveryType: o.deliveryType ?? undefined,
    estimatedTime: o.estimatedTime ?? undefined,
    paymentStatus: o.paymentStatus ?? undefined,
    paymentMethod: o.paymentMethod ?? undefined,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

export function mapOrderWithHistory(
  r: RawOrderWithHistory,
): import('./types').OrderWithHistory {
  return {
    order: mapOrder(r.order),
    history: (r.history ?? []).map((h) => ({
      id: h.id,
      orderId: h.orderId,
      status: h.status,
      prevStatus: h.prevStatus ?? undefined,
      message: h.message ?? undefined,
      createdAt: h.createdAt,
    })),
  };
}

// ─────────────────────────── API ───────────────────────────

export const api = {
  food: {
    menu: {
      /** 菜单列表（分页 + 过滤 + 搜索） */
      get: (params?: { category?: string; search?: string; page?: number; pageSize?: number }) =>
        requestData<PaginatedResult<RawDish>>(
          `/food/menu${buildQuery({
            category: params?.category,
            search: params?.search,
            page: params?.page,
            pageSize: params?.pageSize,
          })}`,
        ),
      /** 单个菜品 */
      getById: (id: string) => requestData<RawDish>(`/food/menu/${encodeURIComponent(id)}`),
      /** 创建菜品（需登录） */
      create: (token: string, body: Partial<RawDish> & { name: string; category: string }) =>
        requestData<RawDish>('/food/menu', {
          method: 'POST',
          body: JSON.stringify(body),
          headers: authHeaders(token),
        }),
      /** 部分更新菜品（需登录） */
      update: (id: string, token: string, body: Partial<RawDish>) =>
        requestData<RawDish>(`/food/menu/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
          headers: authHeaders(token),
        }),
      /** 删除菜品（需登录） */
      delete: (id: string, token: string) =>
        requestData<RawDish>(`/food/menu/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: authHeaders(token),
        }),
    },

    order: {
      /** 创建订单（需登录） */
      post: (
        body: {
          items: RawOrderItem[];
          address?: string;
          phone?: string;
          contactName?: string;
          note?: string;
          deliveryType?: string;
          estimatedTime?: string;
        },
        token: string,
      ) =>
        requestData<RawOrderWithHistory>('/food/orders', {
          method: 'POST',
          body: JSON.stringify(body),
          headers: authHeaders(token),
        }),
    },

    orders: {
      /** 我的订单列表（需登录） */
      get: (token: string, params?: { page?: number; pageSize?: number; status?: string }) =>
        requestData<PaginatedResult<RawOrder>>(
          `/food/orders${buildQuery({
            page: params?.page,
            pageSize: params?.pageSize,
            status: params?.status,
          })}`,
          { headers: authHeaders(token) },
        ),
      /** 订单详情（含状态历史，需登录） */
      getById: (id: string, token: string) =>
        requestData<RawOrderWithHistory>(`/food/orders/${encodeURIComponent(id)}`, {
          headers: authHeaders(token),
        }),
      /** 更新订单状态（需登录） */
      updateStatus: (id: string, token: string, status: OrderStatus, message?: string) =>
        requestData<RawOrderWithHistory>(`/food/orders/${encodeURIComponent(id)}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status, message }),
          headers: authHeaders(token),
        }),
      /** 取消订单（需登录） */
      cancel: (id: string, token: string, reason?: string) =>
        requestData<RawOrderWithHistory>(`/food/orders/${encodeURIComponent(id)}/cancel`, {
          method: 'POST',
          body: JSON.stringify(reason ? { reason } : {}),
          headers: authHeaders(token),
        }),
      /** 删除订单（需登录） */
      delete: (id: string, token: string) =>
        requestData<RawOrder>(`/food/orders/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: authHeaders(token),
        }),
    },

    addresses: {
      /** 地址列表（一对多，默认地址置顶） */
      get: (token: string) =>
        requestData<RawUserAddress[]>('/food/addresses', { headers: authHeaders(token) }),
      create: (
        token: string,
        body: {
          address: string;
          label?: string;
          phone?: string;
          contactName?: string;
          isDefault?: boolean;
        },
      ) =>
        requestData<RawUserAddress>('/food/addresses', {
          method: 'POST',
          body: JSON.stringify(body),
          headers: authHeaders(token),
        }),
      update: (
        id: string,
        token: string,
        body: Partial<Pick<RawUserAddress, 'address' | 'label' | 'phone' | 'contactName' | 'isDefault'>>,
      ) =>
        requestData<RawUserAddress>(`/food/addresses/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: JSON.stringify(body),
          headers: authHeaders(token),
        }),
      delete: (id: string, token: string) =>
        requestData<RawUserAddress>(`/food/addresses/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: authHeaders(token),
        }),
    },
  },

  auth: {
    /** 注册：邮箱 + 密码（后端要求密码至少 8 位） */
    register: (body: { email: string; password: string; name?: string }) =>
      requestData<Pick<RawUser, 'id' | 'email' | 'name'>>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    /** 登录：返回 accessToken / refreshToken */
    login: (body: { email: string; password: string }) =>
      requestData<AuthTokens>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    /** 当前用户（需登录） */
    me: (token: string) => requestData<RawUser>('/auth/me', { headers: authHeaders(token) }),
    /** 用 refreshToken 换新令牌 */
    refresh: (refreshToken: string) =>
      requestData<AuthTokens>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }),
  },
};
