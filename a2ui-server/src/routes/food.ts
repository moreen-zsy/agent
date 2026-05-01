/**
 * 点餐业务 REST API
 */

import { Elysia, t } from 'elysia';
import { getMenu, getDish, createOrder, getOrders, getOrder, updateOrderStatus, deleteOrder } from '../services/food-service.js';
import { verifyToken } from '../middleware/auth.js';

const OrderItemSchema = t.Object({
  dishId: t.String(),
  name: t.String(),
  quantity: t.Number({ minimum: 1 }),
  price: t.Number({ minimum: 0 }),
});

export const foodRoutes = new Elysia({ prefix: '/api/food', detail: { tags: ['Food'] } })
  .get('/menu', async ({ query }) => {
    const category = query.category;
    const search = query.search;
    const page = query.page ? parseInt(query.page) : 1;
    const pageSize = query.pageSize ? parseInt(query.pageSize) : 20;

    return getMenu(category, search, { page, pageSize });
  }, {
    query: t.Object({
      category: t.Optional(t.String()),
      search: t.Optional(t.String()),
      page: t.Optional(t.String()),
      pageSize: t.Optional(t.String()),
    }),
    detail: { summary: 'Get menu with optional filtering and pagination' },
  })

  .get('/menu/:id', async ({ params }) => {
    const dish = await getDish(params.id);
    if (!dish) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Dish not found' } };
    }
    return { success: true, data: dish };
  }, {
    params: t.Object({ id: t.String() }),
    detail: { summary: 'Get a single dish by ID' },
  })

  .post('/order', async ({ body, headers }) => {
    const user = await verifyToken(headers);
    if (!user) return { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } };

    const order = await createOrder(user.id, body.items, body.address);
    return { success: true, data: order };
  }, {
    body: t.Object({
      items: t.Array(OrderItemSchema, { minItems: 1 }),
      address: t.Optional(t.String()),
    }),
    detail: { summary: 'Create a new order' },
  })

  .get('/orders', async ({ query, headers }) => {
    const user = await verifyToken(headers);
    if (!user) return { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } };

    const page = query.page ? parseInt(query.page) : 1;
    const pageSize = query.pageSize ? parseInt(query.pageSize) : 20;
    const status = query.status;

    return getOrders(user.id, { page, pageSize }, status);
  }, {
    query: t.Object({
      page: t.Optional(t.String()),
      pageSize: t.Optional(t.String()),
      status: t.Optional(t.String()),
    }),
    detail: { summary: 'Get user orders with pagination' },
  })

  .get('/orders/:id', async ({ params }) => {
    const order = await getOrder(params.id);
    if (!order) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } };
    }
    return { success: true, data: order };
  }, {
    params: t.Object({ id: t.String() }),
    detail: { summary: 'Get a single order by ID' },
  })

  .put('/orders/:id', async ({ params, body, headers }) => {
    const user = await verifyToken(headers);
    if (!user) return { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } };

    const order = await getOrder(params.id);
    if (!order) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } };
    }
    if (order.userId !== user.id) {
      return { success: false, error: { code: 'FORBIDDEN', message: 'Cannot modify this order' } };
    }

    const updated = await updateOrderStatus(params.id, body.status);
    return { success: true, data: updated };
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      status: t.String(),
    }),
    detail: { summary: 'Update order status' },
  })

  .delete('/orders/:id', async ({ params, headers }) => {
    const user = await verifyToken(headers);
    if (!user) return { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } };

    const order = await getOrder(params.id);
    if (!order) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } };
    }
    if (order.userId !== user.id) {
      return { success: false, error: { code: 'FORBIDDEN', message: 'Cannot delete this order' } };
    }

    const deleted = await deleteOrder(params.id);
    return { success: true, data: deleted };
  }, {
    params: t.Object({ id: t.String() }),
    detail: { summary: 'Delete an order' },
  });
