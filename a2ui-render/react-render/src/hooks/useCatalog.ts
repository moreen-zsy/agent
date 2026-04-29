/**
 * useCatalog Hook
 * 根据 catalogId 查找对应的 React 组件
 */

import { useMemo } from 'react';
import { defaultRegistry, STANDARD_CATALOG_ID } from '../catalog/standard-catalog.js';
import type { A2UIComponent } from '../catalog/standard-catalog.js';

export function useCatalog(catalogId: string | undefined, type: string): A2UIComponent | undefined {
  return useMemo(() => {
    const id = catalogId || STANDARD_CATALOG_ID;
    return defaultRegistry.getComponent(id, type);
  }, [catalogId, type]);
}
