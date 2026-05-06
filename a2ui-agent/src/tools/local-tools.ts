/**
 * 本地业务工具定义
 * 根据 appType 动态返回可用工具
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { AppType } from '../types.js';

export function buildBusinessTools(appType: AppType) {
  if (appType === 'food') {
    return foodTools;
  }
  return campusTools;
}

// 点餐工具
const foodTools = {
  query_menu: tool({
    description: '查询菜单，支持按分类筛选或搜索关键词',
    inputSchema: z.object({
      category: z.enum(['signature', 'main', 'dessert', 'drink', 'appetizer']).optional(),
      search: z.string().optional(),
    }),
    execute: async ({ category, search }) => {
      try {
        const params = new URLSearchParams();
        if (category) params.set('category', category);
        if (search) params.set('search', search);
        const qs = params.toString();
        const res = await fetch(`http://localhost:3000/api/food/menu${qs ? `?${qs}` : ''}`);
        const data = await res.json();
        return {
          success: true,
          items: data.data || [],
          total: data.pagination?.total || 0,
        };
      } catch (err) {
        return {
          success: false,
          error: String(err),
          items: [],
        };
      }
    },
  }),

  add_to_cart: tool({
    description: '添加菜品到购物车',
    inputSchema: z.object({
      dishId: z.string(),
      quantity: z.number().min(1).default(1),
    }),
    execute: async ({ dishId, quantity }) => {
      return { dishId, quantity, success: true };
    },
  }),

  place_order: tool({
    description: '提交订单',
    inputSchema: z.object({
      items: z.array(z.object({
        dishId: z.string(),
        quantity: z.number(),
      })),
      address: z.string().optional(),
    }),
    execute: async ({ items, address }) => {
      return { orderId: `order-${Date.now()}`, items, address, status: 'confirmed' };
    },
  }),

  query_order_status: tool({
    description: '查询订单状态',
    inputSchema: z.object({
      orderId: z.string(),
    }),
    execute: async ({ orderId }) => {
      return { orderId, status: 'preparing', estimatedTime: '30 min' };
    },
  }),
};

// 校园工具
const campusTools = {
  query_schedule: tool({
    description: '查询课表',
    inputSchema: z.object({
      week: z.string().optional(),
      day: z.string().optional(),
    }),
    execute: async ({ week, day }) => {
      return { week, day, courses: [] };
    },
  }),

  query_grades: tool({
    description: '查询成绩',
    inputSchema: z.object({
      semester: z.string().optional(),
    }),
    execute: async ({ semester }) => {
      return { semester, grades: [] };
    },
  }),

  pay_fee: tool({
    description: '缴纳费用',
    inputSchema: z.object({
      type: z.enum(['tuition', 'utility', 'network']),
      amount: z.number(),
    }),
    execute: async ({ type, amount }) => {
      return { type, amount, status: 'paid', transactionId: `tx-${Date.now()}` };
    },
  }),

  book_facility: tool({
    description: '预约设施',
    inputSchema: z.object({
      facilityType: z.enum(['gym', 'study_room', 'lab']),
      date: z.string(),
      timeSlot: z.string(),
    }),
    execute: async ({ facilityType, date, timeSlot }) => {
      return { reservationId: `res-${Date.now()}`, facilityType, date, timeSlot, status: 'confirmed' };
    },
  }),

  query_facilities: tool({
    description: '查询可预约设施',
    inputSchema: z.object({
      type: z.enum(['gym', 'study_room', 'lab']).optional(),
      date: z.string().optional(),
    }),
    execute: async ({ type, date }) => {
      return { type, date, facilities: [] };
    },
  }),
};
