import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  defineCatalog,
  validateComponent,
  validateComponents,
  standardCatalogV08,
  type InferComponentProps,
} from '../src/catalog.js';

describe('Catalog', () => {
  const testCatalog = defineCatalog({
    catalogId: 'test-catalog',
    version: '1.0.0',
    components: {
      Text: {
        props: z.object({
          text: z.union([
            z.object({ literalString: z.string() }),
            z.object({ path: z.string() }),
          ]),
          style: z.enum(['heading', 'body']).optional(),
        }),
        description: '文本组件',
        events: ['press'],
      },
      Button: {
        props: z.object({
          label: z.union([
            z.object({ literalString: z.string() }),
            z.object({ path: z.string() }),
          ]),
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
      { Text: { text: { literalString: 'Hello' } } },
      testCatalog
    );
    expect(result.success).toBe(true);
  });

  it('should validate component with optional props', () => {
    const result = validateComponent(
      { Text: { text: { literalString: 'Hello' }, style: 'heading' } },
      testCatalog
    );
    expect(result.success).toBe(true);
  });

  it('should fail validation for missing required prop', () => {
    const result = validateComponent(
      { Text: {} },
      testCatalog
    );
    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain('text');
  });

  it('should fail validation for invalid prop type', () => {
    const result = validateComponent(
      { Text: { text: { literalNumber: 42 } } },
      testCatalog
    );
    expect(result.success).toBe(false);
  });

  it('should fail validation for unknown component type', () => {
    const result = validateComponent(
      { Unknown: { foo: 'bar' } },
      testCatalog
    );
    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain('Unknown');
  });

  it('should fail validation for missing component type', () => {
    const result = validateComponent(
      {},
      testCatalog
    );
    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain('missing');
  });

  it('should validate multiple components', () => {
    const result = validateComponents(
      [
        { Text: { text: { literalString: 'A' } } },
        { Button: { label: { literalString: 'B' } } },
      ],
      testCatalog
    );
    expect(result.success).toBe(true);
  });

  it('should fail batch validation with errors', () => {
    const result = validateComponents(
      [
        { Text: { text: { literalString: 'A' } } },
        { Button: {} },
      ],
      testCatalog
    );
    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain('component 1');
  });

  it('standard catalog should have v0.8 components', () => {
    const names = Object.keys(standardCatalogV08.components);
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
    expect(names.length).toBeGreaterThanOrEqual(16);
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
