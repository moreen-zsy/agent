/**
 * A2UI JSONL 流式解析器 (v0.9)
 * 逐行解析 SSE/JSONL 流，支持不完整行缓冲
 */

import type {
  A2UIMessage,
  ParseResult,
  ParseResultType,
} from './types.js';

const VALID_KEYS: ParseResultType[] = [
  'createSurface',
  'updateComponents',
  'updateDataModel',
  'deleteSurface',
];

export class A2UIParser {
  private buffer = '';

  /**
   * 解析单行 JSON
   */
  parseLine(line: string): ParseResult {
    const trimmed = line.trim();
    if (!trimmed) {
      return { type: 'error', error: 'Empty line' };
    }

    let parsed: Record<string, any>;
    try {
      parsed = JSON.parse(trimmed);
    } catch (e) {
      return { type: 'error', error: `Invalid JSON: ${(e as Error).message}` };
    }

    // v0.9 消息包含 version 字段
    if (parsed.version !== 'v0.9') {
      return { type: 'error', error: `Expected version "v0.9", got: ${parsed.version}` };
    }

    const keys = Object.keys(parsed).filter(k => k !== 'version');
    if (keys.length !== 1) {
      return { type: 'error', error: `Message must contain exactly one key (besides version), got: ${keys.join(', ')}` };
    }

    const key = keys[0];
    if (!VALID_KEYS.includes(key as ParseResultType)) {
      return { type: 'error', error: `Unknown message type: ${key}` };
    }

    return {
      type: key as ParseResultType,
      message: parsed as A2UIMessage,
    };
  }

  /**
   * 解析数据块（可能包含不完整行）
   * 返回所有完整行的解析结果，不完整行缓存到内部 buffer
   */
  parseChunk(chunk: string): ParseResult[] {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');
    // 最后一个元素可能是不完整的行，保留在 buffer 中
    this.buffer = lines.pop() ?? '';

    const results: ParseResult[] = [];
    for (const line of lines) {
      const result = this.parseLine(line);
      if (result.type !== 'error' || result.error !== 'Empty line') {
        results.push(result);
      }
    }
    return results;
  }

  /**
   * 重置解析器状态
   */
  reset(): void {
    this.buffer = '';
  }

  /**
   * 获取当前缓冲的不完整数据
   */
  getPendingBuffer(): string {
    return this.buffer;
  }

  /**
   * 强制刷新 buffer（流结束时调用）
   */
  flush(): ParseResult | null {
    if (!this.buffer.trim()) return null;
    const result = this.parseLine(this.buffer);
    this.buffer = '';
    return result;
  }
}
