/**
 * Agent 对话历史管理器
 * 维护 OpenAI 兼容格式的 clean 对话历史，绕过 HttpAgent 格式损坏问题
 */

export interface AgentMessage {
  role: 'user' | 'assistant' | 'tool';
  content?: string;
  toolCalls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  toolCallId?: string;
}

/** 为 tool result 生成一句话摘要，避免历史数据淹没 LLM 上下文 */
function summarizeToolResult(content: string | undefined): string {
  if (!content || content.length < 200) return content || '';

  try {
    const data = JSON.parse(content);
    // 订单数据
    if (Array.isArray(data.data) && data.data.length > 0) {
      const first = data.data[0];
      if (first.orderNo || first.status) {
        return `[订单列表数据，共 ${data.data.length} 条，已截断]`;
      }
      if (first.name && first.price) {
        return `[菜单数据，共 ${data.data.length} 道菜品，已截断]`;
      }
      if (first.title || first.name) {
        return `[列表数据，共 ${data.data.length} 条，已截断]`;
      }
    }
    // 单个订单详情
    if (data.orderNo || data.status || data.items) {
      return `[订单详情数据，已截断]`;
    }
    // 单个菜品详情
    if (data.name && data.description && data.image) {
      return `[菜品详情数据：${data.name}，已截断]`;
    }
    // 通用对象
    if (typeof data === 'object' && data !== null) {
      const keys = Object.keys(data).slice(0, 3).join(', ');
      return `[业务数据：{${keys}...}，已截断]`;
    }
  } catch {
    // 非 JSON，直接截断
  }

  return content.slice(0, 80) + '... [已截断]';
}

export class AgentConversation {
  private history: AgentMessage[] = [];

  /** 添加用户消息 */
  addUserMessage(content: string): void {
    this.history.push({ role: 'user', content });
  }

  /** 添加 assistant 文本（累积模式） */
  addAssistantText(text: string): void {
    const last = this.history[this.history.length - 1];
    if (last && last.role === 'assistant' && !last.toolCalls) {
      last.content = (last.content || '') + text;
    } else {
      this.history.push({ role: 'assistant', content: text });
    }
  }

  /** 结束当前 assistant 文本（用于兜底） */
  finalizeAssistantText(): void {
    // 当前实现自动累积，无需显式 finalize
  }

  /** 添加 assistant 的 tool-call */
  addToolCall(toolCallId: string, toolName: string, args: string): void {
    this.history.push({
      role: 'assistant',
      content: '',
      toolCalls: [
        {
          id: toolCallId,
          type: 'function',
          function: { name: toolName, arguments: args },
        },
      ],
    });
  }

  /** 添加 tool result */
  addToolResult(toolCallId: string, content: string): void {
    this.history.push({
      role: 'tool',
      content,
      toolCallId,
    });
  }

  /**
   * 获取完整历史（用于调试）
   */
  getHistory(): AgentMessage[] {
    return [...this.history];
  }

  /**
   * 获取供 LLM 使用的历史
   * 保留最近 2 轮次的完整历史（含 tool call/tool result），让 LLM 能看到之前获取的数据。
   * 更早的轮次只保留 user 和纯文本 assistant，tool result 压缩为摘要，
   * 防止历史业务数据淹没 LLM 上下文。
   */
  getHistoryForLLM(): AgentMessage[] {
    // 找到所有 user 消息的索引
    const userIndices: number[] = [];
    for (let i = 0; i < this.history.length; i++) {
      if (this.history[i]?.role === 'user') {
        userIndices.push(i);
      }
    }

    // 确定保留完整历史的起点：最近 2 轮（即最后 2 个 user 消息）
    const keepFullRounds = 2;
    const fullHistoryStartIdx =
      userIndices.length <= keepFullRounds
        ? 0
        : userIndices[userIndices.length - keepFullRounds]!;

    const result: AgentMessage[] = [];
    for (let i = 0; i < this.history.length; i++) {
      const msg = this.history[i];
      if (!msg) continue;

      // 最近 2 轮：完整保留
      if (i >= fullHistoryStartIdx) {
        result.push(msg);
        continue;
      }

      // 更早的轮次：只保留 user 和纯文本 assistant
      if (msg.role === 'user' || (msg.role === 'assistant' && !msg.toolCalls)) {
        result.push(msg);
        continue;
      }

      // 更早轮次的 tool result：压缩为摘要（保留最后一条，其余截断）
      if (msg.role === 'tool') {
        result.push({ ...msg, content: summarizeToolResult(msg.content || '') });
        continue;
      }

      // 更早轮次的 assistant tool-call：跳过，避免干扰意图
      // （不 push）
    }
    return result;
  }

  /** 清空历史 */
  clear(): void {
    this.history = [];
  }

  /** 历史消息数 */
  get length(): number {
    return this.history.length;
  }
}
