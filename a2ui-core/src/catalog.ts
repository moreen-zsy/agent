/**
 * A2UI Catalog 系统
 * 使用 Zod 定义组件属性 Schema，支持运行时验证和 AI Prompt 生成
 * 严格对齐 A2UI v0.8 协议
 */

import { z } from 'zod';

// ============================================================
// Catalog 组件定义
// ============================================================

/**
 * Catalog 中的组件定义
 * - props: Zod Schema，描述组件可接受的属性
 * - description: 组件描述，用于 AI Prompt
 * - events: 组件支持的事件名列表
 * - slots: 组件接受的子元素插槽名
 */
export interface CatalogComponentDef {
  props: z.ZodType<Record<string, any>>;
  description?: string;
  events?: string[];
  slots?: string[];
}

/**
 * A2UI Catalog 定义
 */
export interface A2UICatalog {
  catalogId: string;
  version?: string;
  components: Record<string, CatalogComponentDef>;
}

// ============================================================
// defineCatalog
// ============================================================

/**
 * 创建 A2UI Catalog
 *
 * @example
 * ```typescript
 * const catalog = defineCatalog({
 *   catalogId: 'my-catalog',
 *   components: {
 *     Text: {
 *       props: z.object({
 *         text: z.union([
 *           z.object({ literalString: z.string() }),
 *           z.object({ path: z.string() }),
 *         ]),
 *         style: z.enum(['heading', 'body', 'caption']).optional(),
 *       }),
 *       description: '文本组件，支持字面量或数据绑定',
 *       events: ['press'],
 *     },
 *     Button: {
 *       props: z.object({
 *         label: z.union([
 *           z.object({ literalString: z.string() }),
 *           z.object({ path: z.string() }),
 *         ]),
 *         variant: z.enum(['primary', 'secondary']).optional(),
 *       }),
 *       description: '按钮组件',
 *       events: ['press'],
 *     },
 *   },
 * });
 * ```
 */
export function defineCatalog(catalog: A2UICatalog): A2UICatalog {
  return catalog;
}

// ============================================================
// 验证
// ============================================================

export interface ValidationResult {
  success: boolean;
  errors?: string[];
}

/**
 * 验证组件定义是否符合 Catalog Schema
 *
 * @param component 组件定义（A2UI v0.8 格式）
 * @param catalog Catalog 定义
 * @returns 验证结果
 */
export function validateComponent(
  component: Record<string, Record<string, any>>,
  catalog: A2UICatalog
): ValidationResult {
  const typeName = Object.keys(component)[0];
  if (!typeName) {
    return { success: false, errors: ['Component type missing'] };
  }

  const def = catalog.components[typeName];
  if (!def) {
    return { success: false, errors: [`Unknown component type: "${typeName}". Available: ${Object.keys(catalog.components).join(', ')}`] };
  }

  const props = component[typeName];
  const result = def.props.safeParse(props);

  if (result.success) {
    return { success: true };
  }

  const errors = result.error.issues.map(
    (issue) => `${issue.path.join('.')}: ${issue.message}`
  );
  return { success: false, errors };
}

/**
 * 批量验证多个组件
 */
export function validateComponents(
  components: Array<Record<string, Record<string, any>>>,
  catalog: A2UICatalog
): ValidationResult {
  const allErrors: string[] = [];

  for (let i = 0; i < components.length; i++) {
    const comp = components[i];
    if (!comp) continue;
    const result = validateComponent(comp, catalog);
    if (!result.success && result.errors) {
      allErrors.push(`[component ${i}] ${result.errors.join('; ')}`);
    }
  }

  if (allErrors.length === 0) {
    return { success: true };
  }
  return { success: false, errors: allErrors };
}

// ============================================================
// 类型推断辅助
// ============================================================

/**
 * 从 Catalog 中提取组件 Props 类型
 * @example
 * type ButtonProps = InferComponentProps<typeof catalog, 'Button'>;
 */
export type InferComponentProps<
  C extends A2UICatalog,
  K extends keyof C['components']
> = C['components'][K] extends { props: z.ZodType<infer P> } ? P : never;

/**
 * 从 Catalog 中提取组件名联合类型
 */
export type InferComponentNames<C extends A2UICatalog> = keyof C['components'] & string;

// ============================================================
// 标准 Catalog（A2UI v0.8 标准组件）
// ============================================================

const boundValueSchema = z.union([
  z.object({ literalString: z.string() }),
  z.object({ literalNumber: z.number() }),
  z.object({ literalBoolean: z.boolean() }),
  z.object({ path: z.string() }),
  z.object({ literalString: z.string(), path: z.string() }),
  z.object({ literalNumber: z.number(), path: z.string() }),
  z.object({ literalBoolean: z.boolean(), path: z.string() }),
]);

const childrenDefSchema = z.union([
  z.object({ explicitList: z.array(z.string()) }),
  z.object({ template: z.object({ dataBinding: z.string(), componentId: z.string() }) }),
]);

/**
 * A2UI v0.8 标准 Catalog
 * 基于 specification/v0_8/ 标准协议
 */
export const standardCatalogV08: A2UICatalog = {
  catalogId: 'a2ui-specification-v0_8-standard_catalog_definition',
  version: '0.8.0',
  components: {
    Text: {
      props: z.object({
        text: boundValueSchema,
        style: z.enum(['heading', 'body', 'caption', 'label']).optional(),
      }),
      description: '文本组件，支持字面量或数据绑定。style 可选 heading/body/caption/label。',
      events: ['press'],
    },
    Button: {
      props: z.object({
        label: boundValueSchema,
        variant: z.enum(['primary', 'secondary', 'danger']).optional(),
        icon: z.string().optional(),
      }),
      description: '按钮组件，支持标签、变体和图标。',
      events: ['press'],
    },
    TextField: {
      props: z.object({
        label: boundValueSchema.optional(),
        value: boundValueSchema.optional(),
        placeholder: boundValueSchema.optional(),
        type: z.enum(['text', 'password', 'email', 'number']).optional(),
      }),
      description: '文本输入框，支持标签、值绑定、占位符。',
      events: ['change', 'submit'],
    },
    Image: {
      props: z.object({
        source: boundValueSchema,
        alt: boundValueSchema.optional(),
        fit: z.enum(['cover', 'contain', 'fill']).optional(),
      }),
      description: '图片组件，source 支持 URL 字面量或数据绑定。',
      events: ['press'],
    },
    Icon: {
      props: z.object({
        name: boundValueSchema,
        size: z.number().optional(),
        color: boundValueSchema.optional(),
      }),
      description: '图标组件，通过 name 指定图标标识。',
      events: ['press'],
    },
    Card: {
      props: z.object({
        child: z.string().optional(),
        padding: z.number().optional(),
        elevation: z.number().optional(),
      }),
      description: '卡片容器，可包含一个子组件。',
      slots: ['child'],
    },
    Row: {
      props: z.object({
        children: childrenDefSchema,
        mainAxisAlignment: z.enum(['start', 'center', 'end', 'spaceBetween', 'spaceAround']).optional(),
        crossAxisAlignment: z.enum(['start', 'center', 'end', 'stretch']).optional(),
      }),
      description: '水平排列容器。',
      slots: ['children'],
    },
    Column: {
      props: z.object({
        children: childrenDefSchema,
        mainAxisAlignment: z.enum(['start', 'center', 'end', 'spaceBetween', 'spaceAround']).optional(),
        crossAxisAlignment: z.enum(['start', 'center', 'end', 'stretch']).optional(),
      }),
      description: '垂直排列容器。',
      slots: ['children'],
    },
    Spacer: {
      props: z.object({
        flex: z.number().optional(),
        height: z.number().optional(),
        width: z.number().optional(),
      }),
      description: '弹性空间占位组件。',
    },
    Divider: {
      props: z.object({
        thickness: z.number().optional(),
        color: boundValueSchema.optional(),
      }),
      description: '分隔线。',
    },
    List: {
      props: z.object({
        children: childrenDefSchema,
        separator: z.boolean().optional(),
      }),
      description: '列表容器。',
      slots: ['children'],
    },
    Tabs: {
      props: z.object({
        tabItems: z.array(
          z.object({
            title: boundValueSchema,
            child: z.string(),
          })
        ),
        selectedIndex: z.number().optional(),
      }),
      description: '标签页组件，tabItems 定义各页标题和子组件。',
      events: ['select'],
    },
    Chip: {
      props: z.object({
        label: boundValueSchema,
        selected: z.boolean().optional(),
        icon: z.string().optional(),
      }),
      description: '标签/芯片组件。',
      events: ['press'],
    },
    Modal: {
      props: z.object({
        entryPointChild: z.string().optional(),
        contentChild: z.string().optional(),
        visible: z.boolean().optional(),
      }),
      description: '模态框，entryPointChild 触发按钮，contentChild 内容。',
      slots: ['entryPointChild', 'contentChild'],
    },
    Switch: {
      props: z.object({
        value: z.boolean().optional(),
        label: boundValueSchema.optional(),
      }),
      description: '开关组件。',
      events: ['change'],
    },
    Slider: {
      props: z.object({
        value: z.number().optional(),
        min: z.number().optional(),
        max: z.number().optional(),
        label: boundValueSchema.optional(),
      }),
      description: '滑块组件。',
      events: ['change'],
    },
  },
};
