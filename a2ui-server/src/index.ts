/**
 * A2UI Server
 * Elysia + SSE + REST API + 认证
 */

import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { config } from './config.js';
import { agentRoutes } from './routes/agent.js';
import { authRoutes } from './routes/auth.js';
import { foodRoutes } from './routes/food.js';
import { campusRoutes } from './routes/campus.js';

const app = new Elysia()
  .use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }))
  .use(swagger({
    documentation: {
      info: {
        title: 'A2UI Server API',
        version: '0.1.0',
        description: 'A2UI Agent-to-User Interface Server API',
      },
      tags: [
        { name: 'Agent', description: 'Agent streaming endpoints' },
        { name: 'Auth', description: 'Authentication endpoints' },
        { name: 'Food', description: 'Food ordering endpoints' },
        { name: 'Campus', description: 'Campus assistant endpoints' },
        { name: 'System', description: 'System health endpoints' },
      ],
    },
  }))
  .use(agentRoutes)
  .use(authRoutes)
  .use(foodRoutes)
  .use(campusRoutes)
  .get('/', () => ({ status: 'A2UI Server is running', version: '0.1.0' }), { detail: { tags: ['System'] } })
  .get('/health', () => ({ status: 'ok' }), { detail: { tags: ['System'] } });

app.listen(config.PORT, () => {
  console.log(`🚀 A2UI Server running at http://localhost:${config.PORT}`);
  console.log(`📚 Swagger UI at http://localhost:${config.PORT}/swagger`);
});

export type App = typeof app;
