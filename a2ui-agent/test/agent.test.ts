/**
 * A2UI Agent 引擎测试
 * 覆盖 runAgentStream 的输入解析、事件序列和工具合并逻辑
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// 为测试提供假的环境变量
process.env.KIMI_API_KEY = 'test-api-key';
process.env.VITEST = 'true';
import { EventType } from '@ag-ui/core';
import type { AgentInput } from '../src/types.js';

// Mock ai 模块
vi.mock('ai', () => ({
  streamText: vi.fn(),
  tool: vi.fn((config: any) => config),
  jsonSchema: vi.fn((schema: any) => ({ jsonSchema: schema })),
  stepCountIs: vi.fn((count: number) => ({ stepCountIs: count })),
}));

// Mock @ai-sdk/anthropic
vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn(() => vi.fn((modelName: string) => ({ modelName }))),
}));

// Mock @ag-ui/client 的 randomUUID
vi.mock('@ag-ui/client', () => ({
  randomUUID: vi.fn(() => 'test-uuid-123'),
}));

import { streamText } from 'ai';

function mockStream(events: Array<{ type: string;[key: string]: any }>) {
  return {
    fullStream: (async function* () {
      for (const ev of events) {
        yield ev;
      }
    })(),
  };
}

async function collectEvents(generator: AsyncGenerator<any>) {
  const events: any[] = [];
  for await (const ev of generator) {
    events.push(ev);
  }
  return events;
}

import { runAgentStream } from '../src/engine/agent.js';

describe('runAgentStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should yield RUN_STARTED and RUN_FINISHED events', async () => {
    (streamText as any).mockResolvedValue(mockStream([]) as any);

    const input: AgentInput = {
      messages: [{ id: '1', role: 'user', content: 'Hello' }],
      appType: 'food',
    };

    const events = await collectEvents(runAgentStream(input));

    expect(events[0].type).toBe(EventType.RUN_STARTED);
    expect(events[events.length - 1].type).toBe(EventType.RUN_FINISHED);
  });

  it('should convert AGUI array context to system prompt', async () => {
    const streamTextMock = vi.fn().mockResolvedValue(mockStream([]) as any);
    (streamText as any).mockImplementation(streamTextMock);

    const input: AgentInput = {
      messages: [{ id: '1', role: 'user', content: 'Hi' }],
      appType: 'food',
      context: [
        { description: 'Schema', value: '{"components":["Text"]}' },
        { description: 'Guide', value: 'Use render_a2ui tool' },
      ],
    };

    await collectEvents(runAgentStream(input));

    const callArgs = streamTextMock.mock.calls[0][0];
    expect(callArgs.system).toContain('Schema: {"components":["Text"]}');
    expect(callArgs.system).toContain('Guide: Use render_a2ui tool');
  });

  it('should convert Record context to system prompt', async () => {
    const streamTextMock = vi.fn().mockResolvedValue(mockStream([]) as any);
    (streamText as any).mockImplementation(streamTextMock);

    const input: AgentInput = {
      messages: [{ id: '1', role: 'user', content: 'Hi' }],
      appType: 'food',
      context: {
        schema: '{"components":["Button"]}',
        hint: 'Use buttons',
      },
    };

    await collectEvents(runAgentStream(input));

    const callArgs = streamTextMock.mock.calls[0][0];
    expect(callArgs.system).toContain('schema: {"components":["Button"]}');
    expect(callArgs.system).toContain('hint: Use buttons');
  });

  it('should merge middlewareTools and businessTools', async () => {
    const streamTextMock = vi.fn().mockResolvedValue(mockStream([]) as any);
    (streamText as any).mockImplementation(streamTextMock);

    const customTool = { name: 'custom_tool', execute: async () => 'ok' };
    const input: AgentInput = {
      messages: [{ id: '1', role: 'user', content: 'Hi' }],
      appType: 'food',
      tools: { custom_tool: customTool },
    };

    await collectEvents(runAgentStream(input));

    const callArgs = streamTextMock.mock.calls[0][0];
    expect(callArgs.tools).toHaveProperty('custom_tool');
    expect(callArgs.tools).toHaveProperty('query_menu');
  });

  it('should handle forwardedProps userAction', async () => {
    const streamTextMock = vi.fn().mockResolvedValue(mockStream([]) as any);
    (streamText as any).mockImplementation(streamTextMock);

    const input: AgentInput = {
      messages: [{ id: '1', role: 'user', content: 'Hi' }],
      appType: 'food',
      forwardedProps: {
        a2uiAction: {
          action: {
            name: 'button_click',
            sourceComponentId: 'btn-1',
            surfaceId: 'main',
            context: { value: 'submit' },
          },
        },
      },
    };

    await collectEvents(runAgentStream(input));

    const callArgs = streamTextMock.mock.calls[0][0];
    const messages = callArgs.messages;
    const lastMessage = messages[messages.length - 1];
    expect(lastMessage.role).toBe('user');
    expect(lastMessage.content).toContain('button_click');
    expect(lastMessage.content).toContain('btn-1');
  });

  it('should yield text-delta as TEXT_MESSAGE_CONTENT events', async () => {
    (streamText as any).mockResolvedValue(
      mockStream([
        { type: 'text-delta', text: 'Hello' },
        { type: 'text-delta', text: ' World' },
      ]) as any,
    );

    const input: AgentInput = {
      messages: [{ id: '1', role: 'user', content: 'Hi' }],
      appType: 'food',
    };

    const events = await collectEvents(runAgentStream(input));
    const contentEvents = events.filter((e) => e.type === EventType.TEXT_MESSAGE_CONTENT);

    expect(contentEvents).toHaveLength(2);
    expect(contentEvents[0].delta).toBe('Hello');
    expect(contentEvents[1].delta).toBe(' World');
  });

  it('should yield tool-call as TOOL_CALL_START events', async () => {
    (streamText as any).mockResolvedValue(
      mockStream([
        { type: 'tool-call', toolName: 'render_a2ui', toolCallId: 'tc-1' },
      ]) as any,
    );

    const input: AgentInput = {
      messages: [{ id: '1', role: 'user', content: 'Hi' }],
      appType: 'food',
    };

    const events = await collectEvents(runAgentStream(input));
    const toolEvents = events.filter((e) => e.type === EventType.TOOL_CALL_START);

    expect(toolEvents).toHaveLength(1);
    expect(toolEvents[0].toolCallName).toBe('render_a2ui');
  });

  it('should handle streamText errors gracefully', async () => {
    (streamText as any).mockRejectedValue(new Error('LLM timeout'));

    const input: AgentInput = {
      messages: [{ id: '1', role: 'user', content: 'Hi' }],
      appType: 'food',
    };

    const events = await collectEvents(runAgentStream(input));
    const errorEvent = events.find((e) => e.type === EventType.RUN_ERROR);

    expect(errorEvent).toBeDefined();
    expect(errorEvent.message).toContain('LLM timeout');
    expect(events[events.length - 1].type).toBe(EventType.RUN_FINISHED);
  });
});
