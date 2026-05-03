import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  defineCatalog,
  validateComponent,
  validateComponents,
  standardCatalogV09,
  type InferComponentProps,
} from '../src/catalog.js';

describe('Catalog', () => {
  const dynString = z.union([z.string(), z.object({ path: z.string() })]);

  const testCatalog = defineCatalog({
    catalogId: 'test-catalog',
    version: '1.0.0',
    components: {
      Text: {
        props: z.object({
          text: dynString,
          style: z.enum(['heading', 'body']).optional(),
        }),
        description: '文本组件',
        events: ['press'],
      },
      Button: {
        props: z.object({
          label: dynString,
          variant: z.enum(['primary', 'secondary']).optional(),
        }),
        description: '按钮组件',
        events: ['press'],
      },
    },
  });

  it('should define catalog with components', () => {
    expect(testCatalog.catalogId).toBe('test-catalog');
    expect(Object.keys(testCatalog.components)).toHaveLength(2);
    expect(testCatalog.components.Text.description).toBe('文本组件');
  });

  it('should validate valid component', () => {
    const result = validateComponent(
      { id: 't1', component: 'Text', text: 'Hello' },
      testCatalog
    );
    expect(result.success).toBe(true);
  });

  it('should validate component with optional props', () => {
    const result = validateComponent(
      { id: 't2', component: 'Text', text: 'Hello', style: 'heading' },
      testCatalog
    );
    expect(result.success).toBe(true);
  });

  it('should fail validation for missing required prop', () => {
    const result = validateComponent(
      { id: 't3', component: 'Text' },
      testCatalog
    );
    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain('text');
  });

  it('should fail validation for invalid prop type', () => {
    const result = validateComponent(
      { id: 't4', component: 'Text', text: 42 },
      testCatalog
    );
    expect(result.success).toBe(false);
  });

  it('should fail validation for unknown component type', () => {
    const result = validateComponent(
      { id: 'u1', component: 'Unknown', foo: 'bar' },
      testCatalog
    );
    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain('Unknown');
  });

  it('should fail validation for missing component type', () => {
    const result = validateComponent(
      { id: 'm1' } as any,
      testCatalog
    );
    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain('missing');
  });

  it('should validate multiple components', () => {
    const result = validateComponents(
      [
        { id: 'a', component: 'Text', text: 'A' },
        { id: 'b', component: 'Button', label: 'B' },
      ],
      testCatalog
    );
    expect(result.success).toBe(true);
  });

  it('should fail batch validation with errors', () => {
    const result = validateComponents(
      [
        { id: 'a', component: 'Text', text: 'A' },
        { id: 'b', component: 'Button' },
      ],
      testCatalog
    );
    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain('component 1');
  });

  it('standard catalog should have v0.9 components', () => {
    const names = Object.keys(standardCatalogV09.components);
    expect(names).toContain('Text');
    expect(names).toContain('Button');
    expect(names).toContain('Card');
    expect(names).toContain('Column');
    expect(names).toContain('Row');
    expect(names).toContain('TextField');
    expect(names).toContain('Image');
    expect(names).toContain('Icon');
    expect(names).toContain('Tabs');
    expect(names).toContain('Modal');
    expect(names).toContain('Switch');
    expect(names).toContain('Chip');
    expect(names.length).toBeGreaterThanOrEqual(20);
  });
});

describe('Catalog Type Inference', () => {
  const catalog = defineCatalog({
    catalogId: 'type-test',
    components: {
      Button: {
        props: z.object({
          label: z.string(),
          variant: z.enum(['primary', 'secondary']).optional(),
        }),
        description: '按钮',
      },
    },
  });

  it('should support type inference', () => {
    type ButtonProps = InferComponentProps<typeof catalog, 'Button'>;
    // 编译时类型检查：如果类型推断正确，以下代码应能通过
    const props: ButtonProps = {
      label: 'Click',
      variant: 'primary',
    };
    expect(props.label).toBe('Click');
  });
});
