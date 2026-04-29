/**
 * A2UI 数据模型管理
 * 存储每个 surface 的 JSON 数据，支持 JSON Pointer 路径解析
 */

import type { DataEntry, DataModel, BoundValue } from './types.js';

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
   * 使用 dataModelUpdate 更新数据模型（不可变更新）
   * @param path 数据模型内的路径，省略或 "/" 则替换整个根
   */
  update(surfaceId: string, path: string | undefined, contents: DataEntry[]): void {
    let model = this.getModel(surfaceId);
    const data = this.entriesToObject(contents);

    if (!path || path === '/' || path === '') {
      this.models.set(surfaceId, data);
      return;
    }

    const target = this.getValueByPath(model, path);
    if (target && typeof target === 'object' && !Array.isArray(target)) {
      // 不可变浅合并：只 clone 路径上的对象
      const merged = { ...target, ...data };
      model = this.immutableSetByPath(model, path, merged);
    } else {
      model = this.immutableSetByPath(model, path, data);
    }
    this.models.set(surfaceId, model);
  }

  /**
   * 将邻接列表格式的 DataEntry[] 转换为普通 JSON 对象
   */
  private entriesToObject(entries: DataEntry[]): DataModel {
    const result: DataModel = {};
    for (const entry of entries) {
      if (entry.valueString !== undefined) {
        result[entry.key] = entry.valueString;
      } else if (entry.valueNumber !== undefined) {
        result[entry.key] = entry.valueNumber;
      } else if (entry.valueBoolean !== undefined) {
        result[entry.key] = entry.valueBoolean;
      } else if (entry.valueMap !== undefined) {
        result[entry.key] = this.entriesToObject(entry.valueMap);
      }
    }
    return result;
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

  private setValueByPath(obj: any, path: string, value: any): void {
    if (!path || path === '/') {
      Object.assign(obj, value);
      return;
    }
    const parts = path.split('/').filter(p => p !== '');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!;
      if (!(part in current) || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }
    const lastPart = parts[parts.length - 1]!;
    current[lastPart] = value;
  }

  /**
   * 解析 BoundValue
   * - literal*: 直接返回值
   * - path: 从数据模型中查找
   * - path + literal*: 先写入数据模型，再绑定（初始化简写）
   */
  resolveBoundValue(surfaceId: string, boundValue: BoundValue): any {
    const bv = boundValue as Record<string, any>;

    // 初始化简写：path + literal
    if ('path' in bv && ('literalString' in bv || 'literalNumber' in bv || 'literalBoolean' in bv)) {
      const value = bv.literalString ?? bv.literalNumber ?? bv.literalBoolean;
      this.setValueByPath(this.getModel(surfaceId), bv.path, value);
      return value;
    }

    // 纯路径绑定
    if ('path' in bv) {
      return this.getValue(surfaceId, bv.path);
    }

    // 纯字面量
    return bv.literalString ?? bv.literalNumber ?? bv.literalBoolean;
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
