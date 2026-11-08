import { Elysia } from "elysia";
import { z } from "zod";
import { EventEncoder } from "@ag-ui/encoder";
import { EventType, type BaseEvent } from "@ag-ui/core";
import { randomUUID } from "@ag-ui/client";
import { streamAgent } from "../services/agent-service.ts";

/**
 * Agent SSE 流端点
 * POST /agent/stream
 *
 * 迁移自 `a2ui-server/src/routes/agent.ts`，使用 AGUI 协议作为传输层 (v0.9)：
 * - 接收 AGUI 标准消息格式 (RunAgentInput)
 * - 透传 context/tools 到 Agent 引擎
 * - 返回 AGUI 标准事件流 (EventEncoder 编码)
 */

const agentBodySchema = z.object({
  threadId: z.string().optional(),
  runId: z.string().optional(),
  messages: z.array(
    z.object({
      id: z.string().optional(),
      role: z.enum(["user", "assistant", "system", "tool", "developer"]),
      content: z.string().optional(),
    }),
  ),
  forwardedProps: z.record(z.string(), z.any()).optional(),
  context: z
    .union([
      z.record(z.string(), z.any()),
      z.array(z.object({ value: z.string(), description: z.string() })),
    ])
    .optional(),
  tools: z
    .union([z.record(z.string(), z.any()), z.array(z.record(z.string(), z.any()))])
    .optional(),
});
export type AgentBody = z.infer<typeof agentBodySchema>;

/** 将 AGUI 数组格式的 tools 转换为 AI SDK v6 所需的 record 格式 */
function normalizeTools(
  tools: Record<string, any> | Array<Record<string, any>> | undefined,
): Record<string, any> {
  if (!tools) return {};

  const normalize = (t: Record<string, any>): [string, Record<string, any>] | null => {
    if (!t || typeof t !== "object") return null;
    // AGUI 数组格式: { name, description, parameters }
    const key = t.name || t.toolName;
    if (!key) return null;
    const { description, parameters, execute } = t;
    const normalized: Record<string, any> = {};
    if (description) normalized.description = description;
    if (parameters) normalized.parameters = parameters;
    if (execute) normalized.execute = execute;
    return [key, normalized];
  };

  if (Array.isArray(tools)) {
    const entries = tools.map(normalize).filter(Boolean) as [string, Record<string, any>][];
    return Object.fromEntries(entries);
  }

  // Record 格式: { [name]: { name, description, parameters } }
  const entries = Object.entries(tools).map(([key, t]) => {
    if (t && typeof t === "object" && (t.name || t.toolName)) {
      const normalized = normalize(t);
      if (normalized) return normalized;
    }
    return [key, t] as [string, Record<string, any>];
  });
  return Object.fromEntries(entries);
}

export const agentRoutes = new Elysia({ name: "agent-routes", prefix: "/agent" }).post(
  "/stream",
  async ({ body, request, set, status }) => {
    const parsed = agentBodySchema.safeParse(body);
    if (!parsed.success) {
      return status(422, {
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.message },
      });
    }

    const input = parsed.data;
    const normalizedTools = normalizeTools(input.tools);

    // 内容协商：根据 Accept 头部选择编码格式
    const accept = request.headers.get("accept") || "text/event-stream";
    const encoder = new EventEncoder({ accept });

    set.headers["content-type"] = encoder.getContentType();
    set.headers["cache-control"] = "no-cache";
    set.headers["connection"] = "keep-alive";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 为没有 id 的消息生成 id
          const messages = input.messages.map((m) => ({ ...m, id: m.id || randomUUID() }));

          // 从 forwardedProps 中提取 appType（AGUI 标准格式）
          const appType = input.forwardedProps?.appType || "food";

          // 从 HTTP headers 中提取 Authorization，注入 forwardedProps
          const forwardedProps = { ...(input.forwardedProps ?? {}) };
          const authHeader = request.headers.get("authorization");
          if (authHeader?.startsWith("Bearer ")) {
            forwardedProps.token = authHeader.slice(7);
          }

          const generator = streamAgent({
            messages: messages as any,
            appType: appType as "food" | "campus",
            forwardedProps,
            context: input.context,
            tools: normalizedTools as any,
            // 会话 ID：客户端传入则复用，便于会话记忆与缓存跨请求延续
            threadId: input.threadId,
          });

          let eventCount = 0;
          for await (const event of generator) {
            eventCount++;
            const encoded = encoder.encode(event);
            try {
              if (typeof encoded === "string") {
                controller.enqueue(new TextEncoder().encode(encoded));
              } else {
                controller.enqueue(encoded);
              }
            } catch {
              // controller 已关闭（客户端断开），优雅退出循环
              console.log(`[agent-route] controller 已关闭，停止发送事件 (已发 ${eventCount} 个)`);
              break;
            }
          }
          console.log(`[agent-route] 流正常结束，共发送 ${eventCount} 个事件`);
        } catch (err) {
          console.error(`[agent-route] 流处理异常:`, err);
          try {
            const errorEvent = { type: EventType.RUN_ERROR, message: (err as Error).message };
            const encoded = encoder.encode(errorEvent);
            if (typeof encoded === "string") {
              controller.enqueue(new TextEncoder().encode(encoded));
            } else {
              controller.enqueue(encoded);
            }
          } catch {
            // controller 已关闭，忽略错误事件
          }
        } finally {
          try {
            controller.close();
          } catch {
            // 可能已被取消关闭
          }
        }
      },
      cancel() {
        // 客户端断开时不中断 generator，让它自然结束
      },
    });

    return new Response(stream);
  },
  {
    detail: { summary: "AGUI agent SSE stream", tags: ["Agent"] },
  },
);

export type { BaseEvent };
