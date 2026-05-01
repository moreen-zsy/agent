/**
 * A2UI 数据模型管理 (v0.9)
 * 存储每个 surface 的 JSON 数据，支持 JSON Pointer 路径解析
 * v0.9 使用标准 JSON，不再使用邻接列表格式的 DataEntry
 */

import type { DataModel, DynamicValue } from './types.js';

export class DataModelStore {
  private models = new Map<string, DataModel>();

  /**
   * 获取指定 surface 的数据模型
   */
  getModel(surfaceId: string): DataModel {
    if (!this.models.has(surfaceId)) {
      this.models.set(surfaceId, {});
    }
    return this.models.get(surfaceId)!;
  }

  /**
   * 使用 updateDataModel 更新数据模型（不可变更新）
   * @param path 数据模型内的路径，省略或 "/" 则替换整个根
   * @param value 标准 JSON 值
   */
  update(surfaceId: string, path: string | undefined, value: any): void {
    let model = this.getModel(surfaceId);

    if (!path || path === '/' || path === '') {
      this.models.set(surfaceId, value ?? {});
      return;
    }

    model = this.immutableSetByPath(model, path, value);
    this.models.set(surfaceId, model);
  }

  /**
   * JSON Pointer 路径解析（RFC 6901）
   * 如 /user/name、/items/0/price
   */
  getValue(surfaceId: string, path: string): any {
    const model = this.getModel(surfaceId);
    return this.getValueByPath(model, path);
  }

  private getValueByPath(obj: any, path: string): any {
    if (!path || path === '/') return obj;
    const parts = path.split('/').filter(p => p !== '');
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    return current;
  }

  /**
   * 不可变设置路径上的值，只 clone 路径上的对象，未修改分支保持原引用
   */
  private immutableSetByPath(obj: DataModel, path: string, value: any): DataModel {
    const segments = path.split('/').filter(p => p !== '');
    if (segments.length === 0) return value;

    const result = { ...obj };
    let current: Record<string, any> = result;

    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i]!;
      const child = current[seg];
      if (Array.isArray(child)) {
        current[seg] = [...child];
      } else if (child !== null && typeof child === 'object') {
        current[seg] = { ...child };
      } else {
        const nextSeg = segments[i + 1];
        current[seg] = nextSeg !== undefined && /^\d+$/.test(nextSeg) ? [] : {};
      }
      current = current[seg];
    }

    const lastSeg = segments[segments.length - 1]!;
    current[lastSeg] = value;
    return result;
  }

  /**
   * 解析 DynamicValue
   * - 字面量（string/number/boolean/array）：直接返回值
   * - {path}: 从数据模型中查找
   * - {call, args, returnType}: 透传给组件（组件自行处理 FunctionCall）
   */
  resolveDynamicValue(surfaceId: string, value: DynamicValue): any {
    // 如果是 FunctionCall，直接透传
    if (value !== null && typeof value === 'object' && 'call' in value) {
      return value;
    }

    // 如果是 DataBinding，从数据模型查找
    if (value !== null && typeof value === 'object' && 'path' in value) {
      return this.getValue(surfaceId, (value as { path: string }).path);
    }

    // 字面量直接返回
    return value;
  }

  /**
   * 直接设置指定 path 的值（用于组件双向绑定）
   */
  setValue(surfaceId: string, path: string, value: any): void {
    const model = this.getModel(surfaceId);
    const updated = this.immutableSetByPath(model, path, value);
    this.models.set(surfaceId, updated);
  }

  /**
   * 删除指定 surface 的数据模型
   */
  deleteModel(surfaceId: string): void {
    this.models.delete(surfaceId);
  }

  /**
   * 清空所有数据模型
   */
  clear(): void {
    this.models.clear();
  }
}
