/**
 * 点餐业务 REST API
 */

import { Elysia, t } from 'elysia';
import {
  getMenu, getDish, createOrder, getOrders, getOrderWithHistory,
  updateOrderStatus, cancelOrder, deleteOrder,
  getUserAddresses, createUserAddress, updateUserAddress, deleteUserAddress,
} from '../services/food-service.js';
import { verifyToken } from '../middleware/auth.js';

const OrderItemSchema = t.Object({
  dishId: t.String(),
  name: t.String(),
  quantity: t.Number({ minimum: 1 }),
  price: t.Number({ minimum: 0 }),
  image: t.Optional(t.String()),
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

    const order = await createOrder(user.id, {
      items: body.items,
      address: body.address,
      phone: body.phone,
      contactName: body.contactName,
      note: body.note,
      deliveryType: body.deliveryType,
    });
    return { success: true, data: order };
  }, {
    body: t.Object({
      items: t.Array(OrderItemSchema, { minItems: 1 }),
      address: t.Optional(t.String()),
      phone: t.Optional(t.String()),
      contactName: t.Optional(t.String()),
      note: t.Optional(t.String()),
      deliveryType: t.Optional(t.String()),
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

  .get('/orders/:id', async ({ params, headers }) => {
    const user = await verifyToken(headers);
    if (!user) return { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } };

    const result = await getOrderWithHistory(params.id);
    if (!result) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } };
    }
    if (result.order.userId !== user.id) {
      return { success: false, error: { code: 'FORBIDDEN', message: 'Cannot access this order' } };
    }

    return { success: true, data: result };
  }, {
    params: t.Object({ id: t.String() }),
    detail: { summary: 'Get order detail with status history' },
  })

  .put('/orders/:id/status', async ({ params, body, headers }) => {
    const user = await verifyToken(headers);
    if (!user) return { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } };

    const result = await getOrderWithHistory(params.id);
    if (!result) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } };
    }
    if (result.order.userId !== user.id) {
      return { success: false, error: { code: 'FORBIDDEN', message: 'Cannot modify this order' } };
    }

    const updated = await updateOrderStatus(params.id, body.status, body.message);
    return { success: true, data: updated };
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      status: t.String(),
      message: t.Optional(t.String()),
    }),
    detail: { summary: 'Update order status with history' },
  })

  .post('/orders/:id/cancel', async ({ params, body, headers }) => {
    const user = await verifyToken(headers);
    if (!user) return { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } };

    const result = await getOrderWithHistory(params.id);
    if (!result) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } };
    }
    if (result.order.userId !== user.id) {
      return { success: false, error: { code: 'FORBIDDEN', message: 'Cannot cancel this order' } };
    }
    if (result.order.status === 'cancelled') {
      return { success: false, error: { code: 'VALIDATION_ERROR', message: 'Order already cancelled' } };
    }
    if (['delivered', 'delivering'].includes(result.order.status)) {
      return { success: false, error: { code: 'VALIDATION_ERROR', message: 'Cannot cancel order at this stage' } };
    }

    const updated = await cancelOrder(params.id, body?.reason);
    return { success: true, data: updated };
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Optional(t.Object({
      reason: t.Optional(t.String()),
    })),
    detail: { summary: 'Cancel an order' },
  })

  .delete('/orders/:id', async ({ params, headers }) => {
    const user = await verifyToken(headers);
    if (!user) return { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } };

    const result = await getOrderWithHistory(params.id);
    if (!result) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } };
    }
    if (result.order.userId !== user.id) {
      return { success: false, error: { code: 'FORBIDDEN', message: 'Cannot delete this order' } };
    }

    const deleted = await deleteOrder(params.id);
    return { success: true, data: deleted };
  }, {
    params: t.Object({ id: t.String() }),
    detail: { summary: 'Delete an order' },
  })

  // ─── 地址管理 ───
  .get('/addresses', async ({ headers }) => {
    const user = await verifyToken(headers);
    if (!user) return { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } };

    const addresses = await getUserAddresses(user.id);
    return { success: true, data: addresses };
  }, {
    detail: { summary: 'Get user addresses' },
  })

  .post('/addresses', async ({ body, headers }) => {
    const user = await verifyToken(headers);
    if (!user) return { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } };

    const address = await createUserAddress(user.id, body);
    return { success: true, data: address };
  }, {
    body: t.Object({
      label: t.Optional(t.String()),
      address: t.String(),
      phone: t.Optional(t.String()),
      contactName: t.Optional(t.String()),
      isDefault: t.Optional(t.Boolean()),
    }),
    detail: { summary: 'Create a new address' },
  })

  .put('/addresses/:id', async ({ params, body, headers }) => {
    const user = await verifyToken(headers);
    if (!user) return { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } };

    const updated = await updateUserAddress(params.id, user.id, body);
    if (!updated) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Address not found' } };
    }
    return { success: true, data: updated };
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      label: t.Optional(t.String()),
      address: t.Optional(t.String()),
      phone: t.Optional(t.String()),
      contactName: t.Optional(t.String()),
      isDefault: t.Optional(t.Boolean()),
    }),
    detail: { summary: 'Update an address' },
  })

  .delete('/addresses/:id', async ({ params, headers }) => {
    const user = await verifyToken(headers);
    if (!user) return { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } };

    const deleted = await deleteUserAddress(params.id, user.id);
    if (!deleted) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Address not found' } };
    }
    return { success: true, data: deleted };
  }, {
    params: t.Object({ id: t.String() }),
    detail: { summary: 'Delete an address' },
  });
