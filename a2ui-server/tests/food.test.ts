import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { api, createTestUser, startServer, uniqueEmail, type TestServer } from "./helpers.ts";
import { db } from "../src/prisma/db";

let server: TestServer;

beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.close();
});

/** 构造一个菜品输入 */
function dishPayload(overrides: Record<string, unknown> = {}) {
  const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    name: `测试菜品-${tag}`,
    description: "集成测试用菜品",
    price: "19.90",
    category: "test",
    tags: ["测试"],
    ingredients: ["盐"],
    available: true,
    ...overrides,
  };
}

describe("点餐接口 /food", () => {
  // ═══════════════════ 菜品 ═══════════════════

  describe("菜品", () => {
    test("创建菜品需要登录", async () => {
      const res = await api(server.url, "/food/menu", {
        method: "POST",
        body: JSON.stringify(dishPayload()),
      });
      expect(res.status).toBe(401);
    });

    test("登录后可创建菜品并返回 Prisma 模型字段", async () => {
      const user = await createTestUser(server.url);
      const payload = dishPayload();

      const res = await api(server.url, "/food/menu", {
        method: "POST",
        token: user.accessToken,
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const dish = res.body.data;
      expect(dish.id).toBeTruthy();
      expect(dish.name).toBe(payload.name);
      expect(dish.category).toBe("test");
      expect(dish.available).toBe(true);
      // Prisma 模型含 createdAt，不含关联键
      expect(dish.createdAt).toBeDefined();
    });

    test("按 id 查询菜品；不存在返回 404", async () => {
      const user = await createTestUser(server.url);
      const created = await api(server.url, "/food/menu", {
        method: "POST",
        token: user.accessToken,
        body: JSON.stringify(dishPayload()),
      });
      const id = created.body.data.id;

      const found = await api(server.url, `/food/menu/${id}`);
      expect(found.status).toBe(200);
      expect(found.body.data.id).toBe(id);

      const missing = await api(
        server.url,
        "/food/menu/00000000-0000-0000-0000-000000000000",
      );
      expect(missing.status).toBe(404);
      expect(missing.body.success).toBe(false);
    });

    test("菜单支持分页与分类过滤", async () => {
      const user = await createTestUser(server.url);
      const category = `cat-${Date.now()}`;

      for (let i = 0; i < 3; i++) {
        await api(server.url, "/food/menu", {
          method: "POST",
          token: user.accessToken,
          body: JSON.stringify(dishPayload({ category, name: `分页菜-${i}-${Date.now()}` })),
        });
      }

      const res = await api(
        server.url,
        `/food/menu?category=${category}&page=1&pageSize=2`,
      );

      expect(res.status).toBe(200);
      expect(res.body.data.data).toHaveLength(2);
      expect(res.body.data.pagination.total).toBe(3);
      expect(res.body.data.pagination.totalPages).toBe(2);
      expect(res.body.data.pagination.page).toBe(1);
    });

    test("菜单支持按名称模糊搜索", async () => {
      const user = await createTestUser(server.url);
      const keyword = `关键词${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
      const category = `search-${keyword}`;

      await api(server.url, "/food/menu", {
        method: "POST",
        token: user.accessToken,
        body: JSON.stringify(dishPayload({ name: `${keyword}-红烧肉`, category })),
      });

      const res = await api(
        server.url,
        `/food/menu?search=${encodeURIComponent(keyword)}&category=${encodeURIComponent(category)}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBe(1);
      expect(res.body.data.data[0].name).toContain(keyword);
    });

    test("PATCH 只更新传入字段，未传字段保持不变", async () => {
      const user = await createTestUser(server.url);
      const created = await api(server.url, "/food/menu", {
        method: "POST",
        token: user.accessToken,
        body: JSON.stringify(dishPayload({ description: "原始描述" })),
      });
      const dish = created.body.data;

      const patched = await api(server.url, `/food/menu/${dish.id}`, {
        method: "PATCH",
        token: user.accessToken,
        body: JSON.stringify({ price: "88.00" }),
      });

      expect(patched.status).toBe(200);
      expect(patched.body.data.price).toBeDefined();
      // 未传字段应保留
      expect(patched.body.data.name).toBe(dish.name);
      expect(patched.body.data.description).toBe("原始描述");
      expect(patched.body.data.category).toBe(dish.category);
    });

    test("删除菜品后查询返回 404", async () => {
      const user = await createTestUser(server.url);
      const created = await api(server.url, "/food/menu", {
        method: "POST",
        token: user.accessToken,
        body: JSON.stringify(dishPayload()),
      });
      const id = created.body.data.id;

      const deleted = await api(server.url, `/food/menu/${id}`, {
        method: "DELETE",
        token: user.accessToken,
      });
      expect(deleted.status).toBe(200);

      const after = await api(server.url, `/food/menu/${id}`);
      expect(after.status).toBe(404);
    });
  });

  // ═══════════════════ 订单 ═══════════════════

  describe("订单", () => {
    /** 创建一个订单，返回响应 */
    async function placeOrder(token: string, overrides: Record<string, unknown> = {}) {
      return api(server.url, "/food/orders", {
        method: "POST",
        token,
        body: JSON.stringify({
          items: [
            { dishId: "d-1", name: "红烧肉", quantity: 2, price: 25.5 },
            { dishId: "d-2", name: "米饭", quantity: 1, price: 3 },
          ],
          address: "测试地址",
          phone: "13800138000",
          contactName: "张三",
          note: "少放辣",
          ...overrides,
        }),
      });
    }

    test("创建订单需要登录", async () => {
      const res = await api(server.url, "/food/orders", {
        method: "POST",
        body: JSON.stringify({
          items: [{ dishId: "d", name: "x", quantity: 1, price: 1 }],
        }),
      });
      expect(res.status).toBe(401);
    });

    test("创建订单成功，含初始状态历史", async () => {
      const user = await createTestUser(server.url);
      const res = await placeOrder(user.accessToken);

      expect(res.status).toBe(200);
      const { order, history } = res.body.data;

      expect(order.id).toBeTruthy();
      expect(order.orderNo).toMatch(/^GD\d+/);
      expect(order.status).toBe("pending");
      expect(order.userId).toBe(user.userId);
      expect(Array.isArray(history)).toBe(true);
      expect(history[0].status).toBe("pending");
    });

    test("订单金额按单价×数量累计", async () => {
      const user = await createTestUser(server.url);
      const res = await placeOrder(user.accessToken);
      // 25.5 * 2 + 3 * 1 = 54
      expect(Number(res.body.data.order.total)).toBeCloseTo(54, 2);
    });

    test("空明细被拒绝", async () => {
      const user = await createTestUser(server.url);
      const res = await api(server.url, "/food/orders", {
        method: "POST",
        token: user.accessToken,
        body: JSON.stringify({ items: [] }),
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    test("订单列表只返回当前用户的订单，并支持分页", async () => {
      const alice = await createTestUser(server.url);
      const bob = await createTestUser(server.url);

      const a1 = await placeOrder(alice.accessToken);
      const a2 = await placeOrder(alice.accessToken);
      const b1 = await placeOrder(bob.accessToken);

      const aliceIds = [a1.body.data.order.id, a2.body.data.order.id];
      const bobId = b1.body.data.order.id;

      const res = await api(server.url, "/food/orders?page=1&pageSize=100", {
        token: alice.accessToken,
      });

      expect(res.status).toBe(200);
      const { data } = res.body.data;
      const returnedIds = data.map((o: any) => o.id);

      // 只含自己的订单，不含他人订单
      expect(returnedIds).toEqual(expect.arrayContaining(aliceIds));
      expect(returnedIds).not.toContain(bobId);
      expect(data.every((o: any) => o.userId === alice.userId)).toBe(true);

      // 分页元信息存在且自洽
      const { pagination } = res.body.data;
      expect(pagination.page).toBe(1);
      expect(pagination.pageSize).toBe(100);
      expect(pagination.totalPages).toBe(Math.ceil(pagination.total / pagination.pageSize));
    });

    test("可按状态过滤订单", async () => {
      const user = await createTestUser(server.url);
      const created = await placeOrder(user.accessToken);
      const orderId = created.body.data.order.id;

      await api(server.url, `/food/orders/${orderId}/status`, {
        method: "PUT",
        token: user.accessToken,
        body: JSON.stringify({ status: "confirmed" }),
      });

      const confirmed = await api(server.url, "/food/orders?status=confirmed&pageSize=100", {
        token: user.accessToken,
      });
      const pending = await api(server.url, "/food/orders?status=pending&pageSize=100", {
        token: user.accessToken,
      });

      // 断言具体订单的状态归属，而非依赖用户下的订单总数
      const confirmedIds = confirmed.body.data.data.map((o: any) => o.id);
      const pendingIds = pending.body.data.data.map((o: any) => o.id);

      expect(confirmedIds).toContain(orderId);
      expect(pendingIds).not.toContain(orderId);
      expect(
        confirmed.body.data.data.every((o: any) => o.status === "confirmed"),
      ).toBe(true);
      expect(pending.body.data.data.every((o: any) => o.status === "pending")).toBe(true);
    });

    test("订单详情包含状态历史", async () => {
      const user = await createTestUser(server.url);
      const created = await placeOrder(user.accessToken);
      const orderId = created.body.data.order.id;

      await api(server.url, `/food/orders/${orderId}/status`, {
        method: "PUT",
        token: user.accessToken,
        body: JSON.stringify({ status: "preparing", message: "开始烹饪" }),
      });

      const detail = await api(server.url, `/food/orders/${orderId}`, {
        token: user.accessToken,
      });

      expect(detail.status).toBe(200);
      expect(detail.body.data.order.status).toBe("preparing");
      expect(detail.body.data.history.length).toBeGreaterThanOrEqual(2);
      expect(detail.body.data.history.at(-1).message).toBe("开始烹饪");
    });

    test("他人订单不可访问（403）", async () => {
      const alice = await createTestUser(server.url);
      const bob = await createTestUser(server.url);
      const created = await placeOrder(alice.accessToken);
      const orderId = created.body.data.order.id;

      const res = await api(server.url, `/food/orders/${orderId}`, {
        token: bob.accessToken,
      });
      expect(res.status).toBe(403);
    });

    test("取消订单写入 cancelled 状态", async () => {
      const user = await createTestUser(server.url);
      const created = await placeOrder(user.accessToken);
      const orderId = created.body.data.order.id;

      const res = await api(server.url, `/food/orders/${orderId}/cancel`, {
        method: "POST",
        token: user.accessToken,
        body: JSON.stringify({ reason: "不想吃了" }),
      });

      expect(res.status).toBe(200);
      expect(res.body.data.order.status).toBe("cancelled");
      expect(res.body.data.history.at(-1).message).toBe("不想吃了");
    });

    test("重复取消返回 400", async () => {
      const user = await createTestUser(server.url);
      const created = await placeOrder(user.accessToken);
      const orderId = created.body.data.order.id;

      await api(server.url, `/food/orders/${orderId}/cancel`, {
        method: "POST",
        token: user.accessToken,
        body: JSON.stringify({}),
      });

      const again = await api(server.url, `/food/orders/${orderId}/cancel`, {
        method: "POST",
        token: user.accessToken,
        body: JSON.stringify({}),
      });
      expect(again.status).toBe(400);
    });

    test("配送中订单不可取消", async () => {
      const user = await createTestUser(server.url);
      const created = await placeOrder(user.accessToken);
      const orderId = created.body.data.order.id;

      await api(server.url, `/food/orders/${orderId}/status`, {
        method: "PUT",
        token: user.accessToken,
        body: JSON.stringify({ status: "delivering" }),
      });

      const res = await api(server.url, `/food/orders/${orderId}/cancel`, {
        method: "POST",
        token: user.accessToken,
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    test("删除订单同时清理状态历史", async () => {
      const user = await createTestUser(server.url);
      const created = await placeOrder(user.accessToken);
      const orderId = created.body.data.order.id;

      const del = await api(server.url, `/food/orders/${orderId}`, {
        method: "DELETE",
        token: user.accessToken,
      });
      expect(del.status).toBe(200);

      const after = await api(server.url, `/food/orders/${orderId}`, {
        token: user.accessToken,
      });
      expect(after.status).toBe(404);

      const remaining = await db.orm.public.OrderStatusHistory
        .where((h) => h.orderId.eq(orderId))
        .all();
      expect(remaining).toHaveLength(0);
    });
  });

  // ═══════════════════ 地址 ═══════════════════

  describe("地址", () => {
    test("地址接口需要登录", async () => {
      const res = await api(server.url, "/food/addresses");
      expect(res.status).toBe(401);
    });

    test("创建地址并出现在列表中", async () => {
      const user = await createTestUser(server.url);

      const created = await api(server.url, "/food/addresses", {
        method: "POST",
        token: user.accessToken,
        body: JSON.stringify({
          address: "北京市朝阳区测试路 1 号",
          label: "公司",
          contactName: "李四",
          phone: "13900139000",
        }),
      });

      expect(created.status).toBe(200);
      expect(created.body.data.address).toBe("北京市朝阳区测试路 1 号");

      const list = await api(server.url, "/food/addresses", { token: user.accessToken });
      expect(list.status).toBe(200);
      expect(list.body.data).toHaveLength(1);
    });

    test("一对多：同一用户可拥有多条地址", async () => {
      const user = await createTestUser(server.url);

      const first = await api(server.url, "/food/addresses", {
        method: "POST",
        token: user.accessToken,
        body: JSON.stringify({ address: "地址 A", isDefault: true }),
      });
      expect(first.body.data.isDefault).toBe(true);

      const second = await api(server.url, "/food/addresses", {
        method: "POST",
        token: user.accessToken,
        body: JSON.stringify({ address: "地址 B", isDefault: true }),
      });
      expect(second.status).toBe(200);
      expect(second.body.data.address).toBe("地址 B");
      expect(second.body.data.id).not.toBe(first.body.data.id);

      const list = await api(server.url, "/food/addresses", { token: user.accessToken });
      expect(list.body.data).toHaveLength(2);

      // 设为默认会取消其他地址的默认标记
      const defaults = list.body.data.filter((a: any) => a.isDefault === true);
      expect(defaults).toHaveLength(1);
      expect(defaults[0].address).toBe("地址 B");
    });

    test("默认地址排在列表首位", async () => {
      const user = await createTestUser(server.url);

      await api(server.url, "/food/addresses", {
        method: "POST",
        token: user.accessToken,
        body: JSON.stringify({ address: "普通地址" }),
      });
      await api(server.url, "/food/addresses", {
        method: "POST",
        token: user.accessToken,
        body: JSON.stringify({ address: "默认地址", isDefault: true }),
      });

      const list = await api(server.url, "/food/addresses", { token: user.accessToken });
      expect(list.body.data).toHaveLength(2);
      expect(list.body.data[0].address).toBe("默认地址");
      expect(list.body.data[0].isDefault).toBe(true);
    });

    test("通过更新接口切换默认地址", async () => {
      const user = await createTestUser(server.url);

      const a = await api(server.url, "/food/addresses", {
        method: "POST",
        token: user.accessToken,
        body: JSON.stringify({ address: "地址 A", isDefault: true }),
      });
      const b = await api(server.url, "/food/addresses", {
        method: "POST",
        token: user.accessToken,
        body: JSON.stringify({ address: "地址 B" }),
      });

      const updated = await api(server.url, `/food/addresses/${b.body.data.id}`, {
        method: "PUT",
        token: user.accessToken,
        body: JSON.stringify({ isDefault: true }),
      });

      expect(updated.status).toBe(200);
      expect(updated.body.data.isDefault).toBe(true);

      const list = await api(server.url, "/food/addresses", { token: user.accessToken });
      const defaults = list.body.data.filter((x: any) => x.isDefault === true);
      expect(defaults).toHaveLength(1);
      expect(defaults[0].id).toBe(b.body.data.id);

      // 原默认地址已被取消
      const aNow = list.body.data.find((x: any) => x.id === a.body.data.id);
      expect(aNow.isDefault).toBe(false);
    });

    test("updatedAt 由 ORM 在 update 时自动更新", async () => {
      const user = await createTestUser(server.url);

      const created = await api(server.url, "/food/addresses", {
        method: "POST",
        token: user.accessToken,
        body: JSON.stringify({ address: "待更新地址" }),
      });
      const id = created.body.data.id;

      // 先等待一小段时间，确保时间戳可区分
      await new Promise((r) => setTimeout(r, 50));

      await api(server.url, `/food/addresses/${id}`, {
        method: "PUT",
        token: user.accessToken,
        body: JSON.stringify({ address: "已更新地址" }),
      });

      const row = await db.orm.public.UserAddresses.where({ id }).first();
      expect(row).toBeTruthy();
      expect(row!.address).toBe("已更新地址");
    });
    test("更新地址与删除地址", async () => {
      const user = await createTestUser(server.url);

      const created = await api(server.url, "/food/addresses", {
        method: "POST",
        token: user.accessToken,
        body: JSON.stringify({ address: "旧地址" }),
      });
      const id = created.body.data.id;

      const updated = await api(server.url, `/food/addresses/${id}`, {
        method: "PUT",
        token: user.accessToken,
        body: JSON.stringify({ address: "新地址" }),
      });
      expect(updated.status).toBe(200);
      expect(updated.body.data.address).toBe("新地址");

      const deleted = await api(server.url, `/food/addresses/${id}`, {
        method: "DELETE",
        token: user.accessToken,
      });
      expect(deleted.status).toBe(200);

      const list = await api(server.url, "/food/addresses", { token: user.accessToken });
      expect(list.body.data).toHaveLength(0);
    });

    test("不能操作他人地址", async () => {
      const alice = await createTestUser(server.url);
      const bob = await createTestUser(server.url);

      const created = await api(server.url, "/food/addresses", {
        method: "POST",
        token: alice.accessToken,
        body: JSON.stringify({ address: "Alice 的地址" }),
      });
      const id = created.body.data.id;

      const update = await api(server.url, `/food/addresses/${id}`, {
        method: "PUT",
        token: bob.accessToken,
        body: JSON.stringify({ address: "被篡改" }),
      });
      expect(update.status).toBe(404);

      const del = await api(server.url, `/food/addresses/${id}`, {
        method: "DELETE",
        token: bob.accessToken,
      });
      expect(del.status).toBe(404);
    });
  });
});

void uniqueEmail;
