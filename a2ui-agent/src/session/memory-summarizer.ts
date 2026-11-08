/**
 * 工作记忆摘要压缩器
 *
 * 策略 B（自适应摘要）：当 working_memory 超出 token 预算时，
 * 把超出保留窗口的旧消息交给轻量模型做「增量摘要」，
 * 保留关键结论与实体 ID，丢弃冗余对话。
 *
 * 设计要点：
 *   1. 只压缩久远历史，最近几轮永远保留原文
 *   2. 结构化实体独立存放在 entity_store，不会被摘要丢失
 *   3. 摘要失败时静默降级为「简单截断」，保证对话不中断
 */

import { generateText, type LanguageModel } from "ai";
import type { MemoryMessage } from "./session-manager.js";

const SUMMARY_PROMPT = `你是对话摘要器。请把下面的多轮对话压缩成简洁的中文摘要。

要求：
1. 保留用户的真实意图和已确认的事实（如已选菜品、地址、订单号）
2. 保留关键实体 ID（dishId、orderId 等）
3. 丢弃寒暄、重复表述、中间失败重试等冗余信息
4. 输出不超过 300 字，用要点式列表
5. 只输出摘要正文，不要任何前后缀说明

已有摘要（可为空）：
---
{prevSummary}
---

需要压缩的新对话：
---
{newMessages}
---`;

export interface SummarizerOptions {
  model: LanguageModel;
  /** 摘要失败时的兜底：截断保留多少字符 */
  fallbackChars?: number;
}

export class MemorySummarizer {
  constructor(private readonly options: SummarizerOptions) {}

  /** 生成摘要；失败时降级为截断 */
  summarize = async (old: MemoryMessage[], prevSummary: string): Promise<string> => {
    if (old.length === 0) return prevSummary;

    const dialogue = old
      .map((m) => `[${m.role}] ${m.content}`)
      .join("\n")
      .slice(0, 8000);

    const prompt = SUMMARY_PROMPT
      .replace("{prevSummary}", prevSummary || "（无）")
      .replace("{newMessages}", dialogue);

    try {
      const res = await generateText({
        model: this.options.model,
        prompt,
        maxOutputTokens: 600,
      });

      const text = res.text.trim();
      if (text.length > 0) {
        console.log(
          `[memory] 摘要完成: ${old.length} 条 → ${text.length} 字`,
        );
        return text;
      }
      return this.fallback(old, prevSummary);
    } catch (err) {
      console.warn("[memory] 摘要失败，降级为截断:", (err as Error).message);
      return this.fallback(old, prevSummary);
    }
  };

  /** 降级策略：保留最近内容的前 N 字符 */
  private fallback(old: MemoryMessage[], prevSummary: string): string {
    const limit = this.options.fallbackChars ?? 800;
    const merged = old
      .map((m) => `[${m.role}] ${m.content}`)
      .join("\n");

    const tail = merged.length > limit ? merged.slice(-limit) : merged;
    const head = prevSummary ? `${prevSummary}\n\n` : "";
    return `${head}（早期对话已压缩）\n${tail}`;
  }
}
