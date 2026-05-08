/**
 * 消息级 Surface 绑定器
 * 将 A2UI Surface 与聊天消息关联，生成消息级唯一 surfaceId
 */

export class SurfaceMessageBinder {
  /** messageId -> uniqueSurfaceId */
  private bindings = new Map<string, string>();

  /**
   * 绑定 Surface 到消息
   * @param messageId 消息唯一标识
   * @param originalSurfaceId LLM 生成的原始 surfaceId（如 "menu-surface"）
   * @returns 消息级唯一 surfaceId（如 "msg-xxx__menu-surface"）
   */
  bind(messageId: string, originalSurfaceId: string): string {
    const uniqueSurfaceId = `${messageId}__${originalSurfaceId}`;
    this.bindings.set(messageId, uniqueSurfaceId);
    return uniqueSurfaceId;
  }

  /** 获取消息绑定的唯一 surfaceId */
  getSurfaceId(messageId: string): string | undefined {
    return this.bindings.get(messageId);
  }

  /** 检查消息是否已绑定 Surface */
  hasBinding(messageId: string): boolean {
    return this.bindings.has(messageId);
  }

  /**
   * 将 operations 中的 surfaceId 替换为消息级唯一 surfaceId
   */
  mapOperations(operations: any[], messageId: string): any[] {
    const uniqueSurfaceId = this.bindings.get(messageId);
    if (!uniqueSurfaceId) return operations;

    return operations.map((op) => {
      const key = Object.keys(op).find((k) => k !== 'version');
      if (!key) return op;
      const payload = op[key];
      if (payload?.surfaceId) {
        return { ...op, [key]: { ...payload, surfaceId: uniqueSurfaceId } };
      }
      return op;
    });
  }

  /** 解除绑定 */
  unbind(messageId: string): void {
    this.bindings.delete(messageId);
  }

  /** 清空所有绑定 */
  clear(): void {
    this.bindings.clear();
  }
}
