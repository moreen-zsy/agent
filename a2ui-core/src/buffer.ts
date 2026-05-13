/**
 * A2UI Surface 级消息缓冲区 (v0.9)
 * 管理每个 surface 的组件和数据模型
 */

import type {
  A2UIMessage,
  ComponentDef,
  DataModel,
  SurfaceState,
} from './types.js';
import { DataModelStore } from './data-model.js';

export class A2UIBuffer {
  private surfaces = new Map<string, SurfaceState>();
  private dataStore = new DataModelStore();

  /**
   * 获取或创建 Surface 状态
   */
  private getOrCreateSurface(surfaceId: string): SurfaceState {
    if (!this.surfaces.has(surfaceId)) {
      this.surfaces.set(surfaceId, {
        surfaceId,
        components: new Map(),
        isReady: false,
        dataModel: {},
      });
    }
    return this.surfaces.get(surfaceId)!;
  }

  /**
   * 将消息推入缓冲区
   */
  push(message: A2UIMessage): void {
    if ('updateComponents' in message) {
      const { surfaceId, components } = message.updateComponents;
      const surface = this.getOrCreateSurface(surfaceId);
      for (const comp of components) {
        surface.components.set(comp.id, comp);
      }
    } else if ('updateDataModel' in message) {
      const { surfaceId, path, value, data } = message.updateDataModel;
      const surface = this.getOrCreateSurface(surfaceId);
      if (data !== undefined) {
        this.dataStore.update(surfaceId, '/', data);
      } else {
        this.dataStore.update(surfaceId, path, value);
      }
      surface.dataModel = this.dataStore.getModel(surfaceId);
    } else if ('createSurface' in message) {
      const { surfaceId, catalogId, theme, sendDataModel } = message.createSurface;
      const surface = this.getOrCreateSurface(surfaceId);
      surface.isReady = true;
      if (catalogId) surface.catalogId = catalogId;
      if (theme) surface.theme = theme;
      if (sendDataModel !== undefined) surface.sendDataModel = sendDataModel;
    } else if ('deleteSurface' in message) {
      const { surfaceId } = message.deleteSurface;
      this.surfaces.delete(surfaceId);
      this.dataStore.deleteModel(surfaceId);
    }
  }

  /**
   * 获取指定 surface 的所有组件
   */
  getComponents(surfaceId: string): ComponentDef[] {
    const surface = this.surfaces.get(surfaceId);
    return surface ? Array.from(surface.components.values()) : [];
  }

  /**
   * 获取指定 surface 的组件 Map
   */
  getComponentMap(surfaceId: string): Map<string, ComponentDef> {
    const surface = this.surfaces.get(surfaceId);
    return surface ? surface.components : new Map();
  }

  /**
   * 获取指定 surface 的数据模型
   */
  getDataModel(surfaceId: string): DataModel {
    return this.dataStore.getModel(surfaceId);
  }

  /**
   * 判断 surface 是否准备好渲染
   */
  isReady(surfaceId: string): boolean {
    return this.surfaces.get(surfaceId)?.isReady ?? false;
  }

  /**
   * 查找指定 surface 的根组件 ID
   */
  findRootId(surfaceId: string): string | undefined {
    const surface = this.surfaces.get(surfaceId);
    if (!surface) return undefined;
    for (const [id] of surface.components) {
      if (id === 'root') return id;
    }
    return undefined;
  }

  /**
   * 获取指定 surface 的完整状态
   */
  getSurfaceState(surfaceId: string): SurfaceState | undefined {
    return this.surfaces.get(surfaceId);
  }

  /**
   * 获取所有 surface ID
   */
  getSurfaceIds(): string[] {
    return Array.from(this.surfaces.keys());
  }

  /**
   * 清空指定 surface
   */
  clear(surfaceId: string): void {
    this.surfaces.delete(surfaceId);
    this.dataStore.deleteModel(surfaceId);
  }

  /**
   * 清空所有 surface
   */
  clearAll(): void {
    this.surfaces.clear();
    this.dataStore.clear();
  }

  /**
   * 获取 DataModelStore 实例（用于外部绑定解析）
   */
  getDataStore(): DataModelStore {
    return this.dataStore;
  }
}
