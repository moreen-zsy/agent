/**
 * Agent SSE 流端点
 * POST /api/agent/stream
 *
 * 使用 AGUI 协议作为传输层 (v0.9):
 * - 接收 AGUI 标准消息格式 (RunAgentInput)
 * - 透传 context/tools 到 Agent 引擎
 * - 返回 AGUI 标准事件流 (EventEncoder 编码)
 */

import { Elysia } from 'elysia';
import { z } from 'zod';
import { EventEncoder } from '@ag-ui/encoder';
import { EventType } from '@ag-ui/core';
import { randomUUID } from '@ag-ui/client';
import { streamAgent } from '../services/agent-service.js';

const agentBodySchema = z.object({
  messages: z.array(z.object({
    id: z.string().optional(),
    role: z.enum(['user', 'assistant', 'system', 'tool', 'developer']),
    content: z.string().optional(),
  })),
  forwardedProps: z.record(z.string(), z.any()).optional(),
  context: z.record(z.string(), z.any()).optional(),
  tools: z.record(z.string(), z.any()).optional(),
});

export const agentRoutes = new Elysia({ prefix: '/api/agent' })
  .post('/stream', async ({ body, request, set }) => {
    const parsed = agentBodySchema.parse(body);

    // 内容协商：根据 Accept 头部选择编码格式
    const accept = request.headers.get('accept') || 'text/event-stream';
    const encoder = new EventEncoder({ accept });

    set.headers['content-type'] = encoder.getContentType();
    set.headers['cache-control'] = 'no-cache';
    set.headers['connection'] = 'keep-alive';

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 为没有 id 的消息生成 id
          const messages = parsed.messages.map((m) => ({
            ...m,
            id: m.id || randomUUID(),
          }));

          // 从 forwardedProps 中提取 appType（AGUI 标准格式）
          const appType = parsed.forwardedProps?.appType || 'food';

          const agentStream = streamAgent({
            messages: messages as any,
            appType: appType as 'food' | 'campus',
            forwardedProps: parsed.forwardedProps,
            context: parsed.context,
            tools: parsed.tools,
          });

          for await (const event of agentStream) {
            const encoded = encoder.encode(event);
            if (typeof encoded === 'string') {
              controller.enqueue(new TextEncoder().encode(encoded));
            } else {
              controller.enqueue(encoded);
            }
          }
        } catch (err) {
          const errorEvent = {
            type: EventType.RUN_ERROR,
            messageId: randomUUID(),
            message: (err as Error).message,
          };
          const encoded = encoder.encode(errorEvent);
          if (typeof encoded === 'string') {
            controller.enqueue(new TextEncoder().encode(encoded));
          } else {
            controller.enqueue(encoded);
          }
        }
        controller.close();
      },
    });

    return new Response(stream);
  });
