/**
 * 引擎运行时注册表
 *
 * 问题背景：`engine/agent.ts` 与 `index.ts` 若各自通过不同路径
 * （相对路径 vs 包名）导入 runtime，Bun 会创建两个模块实例，
 * 导致 `peekRuntime()` 拿到 null。
 *
 * 解决方案：把「当前运行时引用」放到一个**无依赖**的独立模块，
 * 所有使用者只从这个文件读写，保证全局唯一。
 */

import type { EngineRuntime } from "./runtime.js";

let current: EngineRuntime | null = null;

export function setRuntime(rt: EngineRuntime): void {
  current = rt;
}

export function getCurrentRuntime(): EngineRuntime | null {
  return current;
}
