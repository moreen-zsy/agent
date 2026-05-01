import { describe, it, expect } from 'vitest';
import { standardCatalog } from '../src/catalog/standard-catalog.js';

describe('standardCatalog', () => {
  it('should register all expected components', () => {
    const expectedComponents = [
      'Button',
      'Text',
      'Image',
      'TextField',
      'CheckBox',
      'Slider',
      'MultipleChoice',
      'Tabs',
      'Card',
      'List',
      'Icon',
      'Spacer',
      'Modal',
      'Switch',
      'Chip',
    ];

    for (const name of expectedComponents) {
      expect(standardCatalog.has(name), `Component ${name} should be registered`).toBe(true);
    }
  });

  it('should have Button component', () => {
    const button = standardCatalog.get('Button');
    expect(button).toBeDefined();
  });
});
