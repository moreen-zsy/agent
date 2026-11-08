import { Elysia } from "elysia";
import type { AuthPlugin } from "../plugins/auth-plugin";
import {
  cancelOrderSchema,
  createAddressSchema,
  createDishSchema,
  createOrderSchema,
  menuQuerySchema,
  ordersQuerySchema,
  updateAddressSchema,
  updateDishSchema,
  updateOrderStatusSchema,
} from "../schemas/food.ts";
import * as foodService from "../services/food-service.ts";

/**
 * 点餐业务路由
 *
 * 迁移自 `a2ui-server/src/routes/food.ts`，数据层从 Drizzle 改为 Prisma ORM。
 *
 * ## 类型约定
 * - 输入：zod schema（`schemas/food.ts`）
 * - 输出：Prisma 模型类型（`services/food-service.ts` 的返回类型）
 *
 * ## 鉴权
 * 使用 `authPlugin` 注入的 `user`；需要登录的接口自行判断并返回 401。
 */

/** 统一错误响应体 */
const errorOf = (code: string, message: string) => ({ success: false, error: { code, message } });
/** 统一成功响应体 */
const dataOf = <T>(data: T) => ({ success: true, data });

export const foodRoutes = (auth: AuthPlugin) =>
  new Elysia({ name: "food-routes", prefix: "/food" })
    .use(auth)

    // ═══════════════════════ 菜品 ═══════════════════════

    /** 获取菜单，支持分类过滤、模糊搜索与分页 */
    .get("/menu", async ({ query }) => {
      const result = await foodService.getMenu({
        category: query.category,
        search: query.search,
        page: query.page,
        pageSize: query.pageSize,
      });
      return dataOf(result);
    }, {
      query: menuQuerySchema,
      detail: { summary: "Get menu with optional filtering and pagination", tags: ["Food"] },
    })

    /** 获取单个菜品 */
    .get("/menu/:id", async ({ params, status }) => {
      const dish = await foodService.getDish(params.id);
      if (!dish) return status(404, errorOf("NOT_FOUND", "Dish not found"));
      return dataOf(dish);
    }, {
      detail: { summary: "Get a single dish by ID", tags: ["Food"] },
    })

    /** 创建菜品（需登录） */
    .post("/menu", async ({ body, user, status }) => {
      if (!user) return status(401, errorOf("UNAUTHORIZED", "Unauthorized"));

      const dish = await foodService.createDish(body);
      return dataOf(dish);
    }, {
      body: createDishSchema,
      detail: { summary: "Create a dish", tags: ["Food"] },
    })

    /** 部分更新菜品（需登录） */
    .patch("/menu/:id", async ({ params, body, user, status }) => {
      if (!user) return status(401, errorOf("UNAUTHORIZED", "Unauthorized"));

      const dish = await foodService.updateDish(params.id, body);
      if (!dish) return status(404, errorOf("NOT_FOUND", "Dish not found"));
      return dataOf(dish);
    }, {
      body: updateDishSchema,
      detail: { summary: "Partially update a dish", tags: ["Food"] },
    })

    /** 删除菜品（需登录） */
    .delete("/menu/:id", async ({ params, user, status }) => {
      if (!user) return status(401, errorOf("UNAUTHORIZED", "Unauthorized"));

      const dish = await foodService.deleteDish(params.id);
      if (!dish) return status(404, errorOf("NOT_FOUND", "Dish not found"));
      return dataOf(dish);
    }, {
      detail: { summary: "Delete a dish", tags: ["Food"] },
    })

    // ═══════════════════════ 订单 ═══════════════════════

    /** 创建订单 */
    .post("/orders", async ({ body, user, status }) => {
      if (!user) return status(401, errorOf("UNAUTHORIZED", "Unauthorized"));

      const userId = typeof user.sub === "string" ? user.sub : undefined;
      if (!userId) return status(401, errorOf("UNAUTHORIZED", "Invalid token payload"));

      const order = await foodService.createOrder(userId, body);
      return dataOf(order);
    }, {
      body: createOrderSchema,
      detail: { summary: "Create a new order", tags: ["Food"] },
    })

    /** 查询当前用户的订单列表 */
    .get("/orders", async ({ query, user, status }) => {
      if (!user) return status(401, errorOf("UNAUTHORIZED", "Unauthorized"));

      const userId = typeof user.sub === "string" ? user.sub : undefined;
      if (!userId) return status(401, errorOf("UNAUTHORIZED", "Invalid token payload"));

      const page = Math.max(1, Number(query.page) || 1);
      const pageSize = Math.max(1, Number(query.pageSize) || 20);

      const result = await foodService.getOrders(userId, { page, pageSize }, query.status);
      return dataOf(result);
    }, {
      query: ordersQuerySchema,
      detail: { summary: "Get user orders with pagination", tags: ["Food"] },
    })

    /** 订单详情（含状态历史） */
    .get("/orders/:id", async ({ params, user, status }) => {
      if (!user) return status(401, errorOf("UNAUTHORIZED", "Unauthorized"));

      const result = await foodService.getOrderWithHistory(params.id);
      if (!result) return status(404, errorOf("NOT_FOUND", "Order not found"));

      if (String(result.order.userId) !== String(user.sub)) {
        return status(403, errorOf("FORBIDDEN", "Cannot access this order"));
      }
      return dataOf(result);
    }, {
      detail: { summary: "Get order detail with status history", tags: ["Food"] },
    })

    /** 更新订单状态 */
    .put("/orders/:id/status", async ({ params, body, user, status }) => {
      if (!user) return status(401, errorOf("UNAUTHORIZED", "Unauthorized"));

      const current = await foodService.getOrder(params.id);
      if (!current) return status(404, errorOf("NOT_FOUND", "Order not found"));

      if (String(current.userId) !== String(user.sub)) {
        return status(403, errorOf("FORBIDDEN", "Cannot modify this order"));
      }

      const updated = await foodService.updateOrderStatus(params.id, body.status, body.message);
      if (!updated) return status(404, errorOf("NOT_FOUND", "Order not found"));
      return dataOf(updated);
    }, {
      body: updateOrderStatusSchema,
      detail: { summary: "Update order status with history", tags: ["Food"] },
    })

    /** 取消订单 */
    .post("/orders/:id/cancel", async ({ params, body, user, status }) => {
      if (!user) return status(401, errorOf("UNAUTHORIZED", "Unauthorized"));

      const current = await foodService.getOrder(params.id);
      if (!current) return status(404, errorOf("NOT_FOUND", "Order not found"));

      if (String(current.userId) !== String(user.sub)) {
        return status(403, errorOf("FORBIDDEN", "Cannot cancel this order"));
      }
      if (current.status === "cancelled") {
        return status(400, errorOf("VALIDATION_ERROR", "Order already cancelled"));
      }
      if (["delivered", "delivering"].includes(String(current.status))) {
        return status(400, errorOf("VALIDATION_ERROR", "Cannot cancel order at this stage"));
      }

      const updated = await foodService.cancelOrder(params.id, body?.reason);
      if (!updated) return status(404, errorOf("NOT_FOUND", "Order not found"));
      return dataOf(updated);
    }, {
      body: cancelOrderSchema,
      detail: { summary: "Cancel an order", tags: ["Food"] },
    })

    /** 删除订单 */
    .delete("/orders/:id", async ({ params, user, status }) => {
      if (!user) return status(401, errorOf("UNAUTHORIZED", "Unauthorized"));

      const current = await foodService.getOrder(params.id);
      if (!current) return status(404, errorOf("NOT_FOUND", "Order not found"));

      if (String(current.userId) !== String(user.sub)) {
        return status(403, errorOf("FORBIDDEN", "Cannot delete this order"));
      }

      const deleted = await foodService.deleteOrder(params.id);
      return dataOf(deleted);
    }, {
      detail: { summary: "Delete an order", tags: ["Food"] },
    })

    // ═══════════════════════ 地址 ═══════════════════════

    /** 获取当前用户地址列表 */
    .get("/addresses", async ({ user, status }) => {
      if (!user) return status(401, errorOf("UNAUTHORIZED", "Unauthorized"));

      const userId = typeof user.sub === "string" ? user.sub : undefined;
      if (!userId) return status(401, errorOf("UNAUTHORIZED", "Invalid token payload"));

      const addresses = await foodService.getUserAddresses(userId);
      return dataOf(addresses);
    }, {
      detail: { summary: "Get user addresses", tags: ["Food"] },
    })

    /** 新增地址 */
    .post("/addresses", async ({ body, user, status }) => {
      if (!user) return status(401, errorOf("UNAUTHORIZED", "Unauthorized"));

      const userId = typeof user.sub === "string" ? user.sub : undefined;
      if (!userId) return status(401, errorOf("UNAUTHORIZED", "Invalid token payload"));

      const address = await foodService.createUserAddress(userId, body);
      return dataOf(address);
    }, {
      body: createAddressSchema,
      detail: { summary: "Create a new address", tags: ["Food"] },
    })

    /** 更新地址 */
    .put("/addresses/:id", async ({ params, body, user, status }) => {
      if (!user) return status(401, errorOf("UNAUTHORIZED", "Unauthorized"));

      const userId = typeof user.sub === "string" ? user.sub : undefined;
      if (!userId) return status(401, errorOf("UNAUTHORIZED", "Invalid token payload"));

      const updated = await foodService.updateUserAddress(params.id, userId, body);
      if (!updated) return status(404, errorOf("NOT_FOUND", "Address not found"));
      return dataOf(updated);
    }, {
      body: updateAddressSchema,
      detail: { summary: "Update an address", tags: ["Food"] },
    })

    /** 删除地址 */
    .delete("/addresses/:id", async ({ params, user, status }) => {
      if (!user) return status(401, errorOf("UNAUTHORIZED", "Unauthorized"));

      const userId = typeof user.sub === "string" ? user.sub : undefined;
      if (!userId) return status(401, errorOf("UNAUTHORIZED", "Invalid token payload"));

      const deleted = await foodService.deleteUserAddress(params.id, userId);
      if (!deleted) return status(404, errorOf("NOT_FOUND", "Address not found"));
      return dataOf(deleted);
    }, {
      detail: { summary: "Delete an address", tags: ["Food"] },
    });
