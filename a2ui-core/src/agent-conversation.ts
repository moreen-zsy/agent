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

  /** 获取完整历史 */
  getHistory(): AgentMessage[] {
    return [...this.history];
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
