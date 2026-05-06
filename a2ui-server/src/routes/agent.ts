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
  threadId: z.string().optional(),
  runId: z.string().optional(),
  messages: z.array(z.object({
    id: z.string().optional(),
    role: z.enum(['user', 'assistant', 'system', 'tool', 'developer']),
    content: z.string().optional(),
  })),
  forwardedProps: z.record(z.string(), z.any()).optional(),
  context: z.union([
    z.record(z.string(), z.any()),
    z.array(z.object({ value: z.string(), description: z.string() })),
  ]).optional(),
  tools: z.union([
    z.record(z.string(), z.any()),
    z.array(z.record(z.string(), z.any())),
  ]).optional(),
});

/** 将 AGUI 数组格式的 tools 转换为 AI SDK 所需的 record 格式 */
function normalizeTools(
  tools: Record<string, any> | Array<Record<string, any>> | undefined,
): Record<string, any> {
  if (!tools) return {};
  if (Array.isArray(tools)) {
    return Object.fromEntries(
      tools.filter((t) => t && typeof t === 'object' && t.name).map((t) => [t.name, t]),
    );
  }
  return tools;
}

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
            tools: normalizeTools(parsed.tools) as any,
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
