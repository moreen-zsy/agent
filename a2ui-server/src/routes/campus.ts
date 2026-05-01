/**
 * 校园业务 REST API
 */

import { Elysia, t } from 'elysia';
import {
  getFacilities,
  getFacility,
  createReservation,
  getReservations,
  updateReservationStatus,
  deleteReservation,
  createPayment,
  getPayments,
  updatePaymentStatus,
} from '../services/campus-service.js';
import { verifyToken } from '../middleware/auth.js';

export const campusRoutes = new Elysia({ prefix: '/api/campus', detail: { tags: ['Campus'] } })
  .get('/facilities', async ({ query }) => {
    const type = query.type;
    const search = query.search;
    const page = query.page ? parseInt(query.page) : 1;
    const pageSize = query.pageSize ? parseInt(query.pageSize) : 20;

    return getFacilities(type, search, { page, pageSize });
  }, {
    query: t.Object({
      type: t.Optional(t.String()),
      search: t.Optional(t.String()),
      page: t.Optional(t.String()),
      pageSize: t.Optional(t.String()),
    }),
    detail: { summary: 'Get facilities with optional filtering and pagination' },
  })

  .get('/facilities/:id', async ({ params }) => {
    const facility = await getFacility(params.id);
    if (!facility) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Facility not found' } };
    }
    return { success: true, data: facility };
  }, {
    params: t.Object({ id: t.String() }),
    detail: { summary: 'Get a single facility by ID' },
  })

  .post('/reservations', async ({ body, headers }) => {
    const user = await verifyToken(headers);
    if (!user) return { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } };

    const res = await createReservation(user.id, body.facilityId, body.date, body.timeSlot);
    return { success: true, data: res };
  }, {
    body: t.Object({
      facilityId: t.String(),
      date: t.String(),
      timeSlot: t.String(),
    }),
    detail: { summary: 'Create a new reservation' },
  })

  .get('/reservations', async ({ query, headers }) => {
    const user = await verifyToken(headers);
    if (!user) return { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } };

    const page = query.page ? parseInt(query.page) : 1;
    const pageSize = query.pageSize ? parseInt(query.pageSize) : 20;

    return getReservations(user.id, { page, pageSize });
  }, {
    query: t.Object({
      page: t.Optional(t.String()),
      pageSize: t.Optional(t.String()),
    }),
    detail: { summary: 'Get user reservations with pagination' },
  })

  .put('/reservations/:id', async ({ params, body, headers }) => {
    const user = await verifyToken(headers);
    if (!user) return { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } };

    const updated = await updateReservationStatus(params.id, body.status);
    if (!updated) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Reservation not found' } };
    }
    return { success: true, data: updated };
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      status: t.String(),
    }),
    detail: { summary: 'Update reservation status' },
  })

  .delete('/reservations/:id', async ({ params, headers }) => {
    const user = await verifyToken(headers);
    if (!user) return { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } };

    const deleted = await deleteReservation(params.id);
    if (!deleted) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Reservation not found' } };
    }
    return { success: true, data: deleted };
  }, {
    params: t.Object({ id: t.String() }),
    detail: { summary: 'Cancel/delete a reservation' },
  })

  .post('/payments', async ({ body, headers }) => {
    const user = await verifyToken(headers);
    if (!user) return { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } };

    const payment = await createPayment(user.id, body.type, body.amount, body.description);
    return { success: true, data: payment };
  }, {
    body: t.Object({
      type: t.Enum({ tuition: 'tuition', utility: 'utility', network: 'network' }),
      amount: t.Number({ minimum: 0 }),
      description: t.Optional(t.String()),
    }),
    detail: { summary: 'Create a new payment record' },
  })

  .get('/payments', async ({ query, headers }) => {
    const user = await verifyToken(headers);
    if (!user) return { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } };

    const page = query.page ? parseInt(query.page) : 1;
    const pageSize = query.pageSize ? parseInt(query.pageSize) : 20;
    const type = query.type;

    return getPayments(user.id, { page, pageSize }, type);
  }, {
    query: t.Object({
      page: t.Optional(t.String()),
      pageSize: t.Optional(t.String()),
      type: t.Optional(t.String()),
    }),
    detail: { summary: 'Get user payments with pagination' },
  })

  .put('/payments/:id', async ({ params, body, headers }) => {
    const user = await verifyToken(headers);
    if (!user) return { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } };

    const updated = await updatePaymentStatus(params.id, body.status);
    if (!updated) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Payment not found' } };
    }
    return { success: true, data: updated };
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      status: t.String(),
    }),
    detail: { summary: 'Update payment status' },
  });
