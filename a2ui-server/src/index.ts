/**
 * @a2ui/server
 * A2UI 服务端 - Elysia + SSE 流式传输
 */

import { Elysia } from 'elysia';

const app = new Elysia();

app.get('/', () => ({ status: 'A2UI Server is running' }));

app.listen(3000, () => {
  console.log('A2UI Server running at http://localhost:3000');
});
