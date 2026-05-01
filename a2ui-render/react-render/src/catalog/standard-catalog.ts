/**
 * A2UI 标准 Catalog 组件映射 (v0.9)
 * 将组件类型名映射到 React 组件
 */

import type { ComponentType } from 'react';

import { A2UIText } from '../components/A2UIText.js';
import { A2UIImage } from '../components/A2UIImage.js';
import { A2UIButton } from '../components/A2UIButton.js';
import { A2UIColumn } from '../components/A2UIColumn.js';
import { A2UIRow } from '../components/A2UIRow.js';
import { A2UICard } from '../components/A2UICard.js';
import { A2UIList } from '../components/A2UIList.js';
import { A2UITextField } from '../components/A2UITextField.js';
import { A2UIIcon } from '../components/A2UIIcon.js';
import { A2UIVideo } from '../components/A2UIVideo.js';
import { A2UIAudioPlayer } from '../components/A2UIAudioPlayer.js';
import { A2UICheckBox } from '../components/A2UICheckBox.js';
import { A2UIChoicePicker } from '../components/A2UIChoicePicker.js';
import { A2UISlider } from '../components/A2UISlider.js';
import { A2UITabs } from '../components/A2UITabs.js';
import { A2UIDivider } from '../components/A2UIDivider.js';
import { A2UISpacer } from '../components/A2UISpacer.js';
import { A2UIModal } from '../components/A2UIModal.js';
import { A2UISwitch } from '../components/A2UISwitch.js';
import { A2UIChip } from '../components/A2UIChip.js';

export type A2UIComponent = ComponentType<any>;

export const STANDARD_CATALOG_ID = 'https://a2ui.org/specification/v0_9/basic_catalog.json';

/**
 * 标准 Catalog 组件注册表
 */
export const standardCatalog: Map<string, A2UIComponent> = new Map(
  [
    ['Text', A2UIText],
    ['Image', A2UIImage],
    ['Button', A2UIButton],
    ['Column', A2UIColumn],
    ['Row', A2UIRow],
    ['List', A2UIList],
    ['Card', A2UICard],
    ['TextField', A2UITextField],
    ['Icon', A2UIIcon],
    ['Video', A2UIVideo],
    ['AudioPlayer', A2UIAudioPlayer],
    ['CheckBox', A2UICheckBox],
    ['ChoicePicker', A2UIChoicePicker],
    ['Slider', A2UISlider],
    ['Tabs', A2UITabs],
    ['Divider', A2UIDivider],
    ['Spacer', A2UISpacer],
    ['Modal', A2UIModal],
    ['Switch', A2UISwitch],
    ['Chip', A2UIChip],
  ] as [string, A2UIComponent][]
);

/**
 * Catalog 管理器：支持多个 Catalog
 */
export class CatalogRegistry {
  private catalogs = new Map<string, Map<string, A2UIComponent>>();

  constructor() {
    this.register(STANDARD_CATALOG_ID, standardCatalog);
  }

  register(catalogId: string, components: Map<string, A2UIComponent>): void {
    this.catalogs.set(catalogId, components);
  }

  getComponent(catalogId: string, type: string): A2UIComponent | undefined {
    const catalog = this.catalogs.get(catalogId);
    if (catalog) {
      return catalog.get(type);
    }
    // 回退到标准 Catalog
    return standardCatalog.get(type);
  }

  hasCatalog(catalogId: string): boolean {
    return this.catalogs.has(catalogId);
  }
}

export const defaultRegistry = new CatalogRegistry();
