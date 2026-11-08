/**
 * Token 估算
 *
 * 不引入 tiktoken 等重型依赖（体积大、WASM 加载慢）。
 * 采用经验估算：中文字符约 1.5 字符/token，英文约 4 字符/token。
 * 对于「预算控制」这一用途，±20% 误差完全可接受。
 */

const CJK = /[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/g;

/** 估算单段文本的 token 数 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const cjkCount = (text.match(CJK) || []).length;
  const otherCount = text.length - cjkCount;
  // 中文约 1 token / 1.5 字，其余约 1 token / 4 字符
  return Math.ceil(cjkCount / 1.5 + otherCount / 4);
}

/** 估算任意 JSON 结构（消息、实体等）的 token 数 */
export function estimateObjectTokens(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "string") return estimateTokens(value);
  if (typeof value === "number" || typeof value === "boolean") return 2;
  try {
    return estimateTokens(JSON.stringify(value));
  } catch {
    return 0;
  }
}

/** 消息数组的总 token 估算 */
export function estimateMessagesTokens(
  messages: Array<{ role?: string; content?: unknown }>,
): number {
  let total = 0;
  for (const m of messages) {
    // 每条消息有固定开销（role、分隔符等）
    total += 4;
    total += estimateObjectTokens(m.content);
  }
  return total;
}
