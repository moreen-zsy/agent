/**
 * A2UI Catalog 系统 (v0.9)
 * 使用 Zod 定义组件属性 Schema，支持运行时验证和 AI Prompt 生成
 * 严格对齐 A2UI v0.9 协议
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
 */
export function validateComponent(
  component: ComponentDef,
  catalog: A2UICatalog
): ValidationResult {
  const typeName = component.component;
  if (!typeName) {
    return { success: false, errors: ['Component type missing'] };
  }

  const def = catalog.components[typeName];
  if (!def) {
    return { success: false, errors: [`Unknown component type: "${typeName}". Available: ${Object.keys(catalog.components).join(', ')}`] };
  }

  const { component: _, id: __, ...props } = component;
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
  components: ComponentDef[],
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

export type InferComponentProps<
  C extends A2UICatalog,
  K extends keyof C['components']
> = C['components'][K] extends { props: z.ZodType<infer P> } ? P : never;

export type InferComponentNames<C extends A2UICatalog> = keyof C['components'] & string;

// ============================================================
// v0.9 Schema 定义
// ============================================================

import type { ComponentDef } from './types.js';

const dynamicStringSchema = z.union([
  z.string(),
  z.object({ path: z.string() }),
  z.object({ call: z.string(), args: z.record(z.string(), z.any()).optional(), returnType: z.literal('string').optional() }),
]);

const dynamicNumberSchema = z.union([
  z.number(),
  z.object({ path: z.string() }),
  z.object({ call: z.string(), args: z.record(z.string(), z.any()).optional(), returnType: z.literal('number').optional() }),
]);

const dynamicBooleanSchema = z.union([
  z.boolean(),
  z.object({ path: z.string() }),
  z.object({ call: z.string(), args: z.record(z.string(), z.any()).optional(), returnType: z.literal('boolean').optional() }),
]);

const dynamicStringListSchema = z.union([
  z.array(z.string()),
  z.object({ path: z.string() }),
  z.object({ call: z.string(), args: z.record(z.string(), z.any()).optional(), returnType: z.literal('array').optional() }),
]);

const dynamicValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.any()),
  z.object({ path: z.string() }),
  z.object({ call: z.string(), args: z.record(z.string(), z.any()).optional(), returnType: z.string().optional() }),
]);

const childListSchema = z.union([
  z.array(z.string()),
  z.object({ componentId: z.string(), path: z.string() }),
]);

const actionSchema = z.union([
  z.object({
    event: z.object({
      name: z.string(),
      context: z.record(z.string(), dynamicValueSchema).optional(),
    }),
  }),
  z.object({
    functionCall: z.object({
      call: z.string(),
      args: z.record(z.string(), z.any()).optional(),
      returnType: z.string().optional(),
    }),
  }),
]);

const checkRuleSchema = z.object({
  condition: dynamicBooleanSchema,
  message: z.string(),
});

const checksSchema = z.array(checkRuleSchema).optional();

const accessibilitySchema = z.object({
  label: dynamicStringSchema.optional(),
  description: dynamicStringSchema.optional(),
}).optional();

// ============================================================
// 标准 Catalog（A2UI v0.9 标准组件）
// ============================================================

/**
 * A2UI v0.9 标准 Catalog
 * 基于 specification/v0_9/json/basic_catalog.json
 */
export const standardCatalogV09: A2UICatalog = {
  catalogId: 'https://a2ui.org/specification/v0_9/basic_catalog.json',
  version: '0.9.0',
  components: {
    Text: {
      props: z.object({
        text: dynamicStringSchema,
        variant: z.enum(['h1', 'h2', 'h3', 'h4', 'h5', 'caption', 'body']).optional(),
        accessibility: accessibilitySchema,
      }),
      description: '文本组件，支持字面量、数据绑定或函数调用。variant 可选 h1/h2/h3/h4/h5/caption/body。',
      events: ['press'],
    },
    Image: {
      props: z.object({
        url: dynamicStringSchema,
        description: dynamicStringSchema.optional(),
        fit: z.enum(['contain', 'cover', 'fill', 'none', 'scaleDown']).optional(),
        variant: z.enum(['icon', 'avatar', 'smallFeature', 'mediumFeature', 'largeFeature', 'header']).optional(),
        accessibility: accessibilitySchema,
      }),
      description: '图片组件，url 支持 URL 字面量或数据绑定。',
      events: ['press'],
    },
    Icon: {
      props: z.object({
        name: z.union([z.string(), z.object({ path: z.string() })]),
        accessibility: accessibilitySchema,
      }),
      description: '图标组件，通过 name 指定图标标识。',
      events: ['press'],
    },
    Video: {
      props: z.object({
        url: dynamicStringSchema,
        accessibility: accessibilitySchema,
      }),
      description: '视频组件。',
      events: ['press'],
    },
    AudioPlayer: {
      props: z.object({
        url: dynamicStringSchema,
        description: dynamicStringSchema.optional(),
        accessibility: accessibilitySchema,
      }),
      description: '音频播放器组件。',
      events: ['press'],
    },
    Button: {
      props: z.object({
        child: z.string(),
        variant: z.enum(['default', 'primary', 'borderless']).optional(),
        action: actionSchema,
        checks: checksSchema,
        accessibility: accessibilitySchema,
      }),
      description: '按钮组件，child 为子组件 ID。variant 可选 default/primary/borderless。',
      events: ['press'],
    },
    TextField: {
      props: z.object({
        label: dynamicStringSchema,
        value: dynamicStringSchema.optional(),
        variant: z.enum(['longText', 'number', 'shortText', 'obscured']).optional(),
        validationRegexp: z.string().optional(),
        checks: checksSchema,
        accessibility: accessibilitySchema,
      }),
      description: '文本输入框，variant 可选 longText/number/shortText/obscured。',
      events: ['change', 'submit'],
    },
    CheckBox: {
      props: z.object({
        label: dynamicStringSchema,
        value: dynamicBooleanSchema,
        checks: checksSchema,
        accessibility: accessibilitySchema,
      }),
      description: '复选框组件。',
      events: ['change'],
    },
    ChoicePicker: {
      props: z.object({
        label: dynamicStringSchema.optional(),
        variant: z.enum(['multipleSelection', 'mutuallyExclusive']).optional(),
        options: z.array(z.object({
          label: dynamicStringSchema,
          value: z.string(),
        })),
        value: dynamicStringListSchema,
        displayStyle: z.enum(['checkbox', 'chips']).optional(),
        filterable: z.boolean().optional(),
        checks: checksSchema,
        accessibility: accessibilitySchema,
      }),
      description: '选择器组件，支持多选/单选。variant 可选 multipleSelection/mutuallyExclusive。',
      events: ['change'],
    },
    Slider: {
      props: z.object({
        label: dynamicStringSchema.optional(),
        min: z.number().optional(),
        max: z.number(),
        value: dynamicNumberSchema,
        checks: checksSchema,
        accessibility: accessibilitySchema,
      }),
      description: '滑块组件。',
      events: ['change'],
    },
    DateTimeInput: {
      props: z.object({
        value: dynamicStringSchema,
        enableDate: z.boolean().optional(),
        enableTime: z.boolean().optional(),
        min: dynamicStringSchema.optional(),
        max: dynamicStringSchema.optional(),
        label: dynamicStringSchema.optional(),
        checks: checksSchema,
        accessibility: accessibilitySchema,
      }),
      description: '日期时间输入组件。',
      events: ['change'],
    },
    Row: {
      props: z.object({
        children: childListSchema,
        justify: z.enum(['center', 'end', 'spaceAround', 'spaceBetween', 'spaceEvenly', 'start', 'stretch']).optional(),
        align: z.enum(['start', 'center', 'end', 'stretch']).optional(),
        accessibility: accessibilitySchema,
      }),
      description: '水平排列容器。',
      slots: ['children'],
    },
    Column: {
      props: z.object({
        children: childListSchema,
        justify: z.enum(['start', 'center', 'end', 'spaceBetween', 'spaceAround', 'spaceEvenly', 'stretch']).optional(),
        align: z.enum(['center', 'end', 'start', 'stretch']).optional(),
        accessibility: accessibilitySchema,
      }),
      description: '垂直排列容器。',
      slots: ['children'],
    },
    List: {
      props: z.object({
        children: childListSchema,
        direction: z.enum(['vertical', 'horizontal']).optional(),
        align: z.enum(['start', 'center', 'end', 'stretch']).optional(),
        accessibility: accessibilitySchema,
      }),
      description: '列表容器。',
      slots: ['children'],
    },
    Card: {
      props: z.object({
        child: z.string(),
        accessibility: accessibilitySchema,
      }),
      description: '卡片容器，包含一个子组件。',
      slots: ['child'],
    },
    Tabs: {
      props: z.object({
        tabs: z.array(z.object({
          title: dynamicStringSchema,
          child: z.string(),
        })),
        accessibility: accessibilitySchema,
      }),
      description: '标签页组件。',
      events: ['select'],
    },
    Modal: {
      props: z.object({
        trigger: z.string(),
        content: z.string(),
        accessibility: accessibilitySchema,
      }),
      description: '模态框，trigger 触发按钮，content 内容。',
      slots: ['trigger', 'content'],
    },
    Divider: {
      props: z.object({
        axis: z.enum(['horizontal', 'vertical']).optional(),
        accessibility: accessibilitySchema,
      }),
      description: '分隔线。',
    },
    // v0.9 扩展组件（非标准 catalog 但保留支持）
    Spacer: {
      props: z.object({
        flex: z.number().optional(),
        height: z.number().optional(),
        width: z.number().optional(),
        accessibility: accessibilitySchema,
      }),
      description: '弹性空间占位组件。',
    },
    Switch: {
      props: z.object({
        value: z.boolean().optional(),
        label: dynamicStringSchema.optional(),
        checks: checksSchema,
        accessibility: accessibilitySchema,
      }),
      description: '开关组件。',
      events: ['change'],
    },
    Chip: {
      props: z.object({
        label: dynamicStringSchema,
        selected: z.boolean().optional(),
        icon: z.string().optional(),
        accessibility: accessibilitySchema,
      }),
      description: '标签/芯片组件。',
      events: ['press'],
    },
    Carousel: {
      props: z.object({
        items: z.union([
          z.array(z.object({
            imageUrl: dynamicStringSchema,
            title: dynamicStringSchema.optional(),
            description: dynamicStringSchema.optional(),
            id: z.string().optional(),
          })),
          z.object({ path: z.string() }),
        ]),
        autoPlay: z.boolean().optional(),
        interval: z.number().optional(),
        action: actionSchema.optional(),
        accessibility: accessibilitySchema,
      }),
      description: '轮播图组件，用于展示图片列表（如菜单菜品），支持自动播放和点击事件。items 可以是数组字面量（每项含 imageUrl、title、description、id），也可以是 {path: "/dishes"} 数据绑定（推荐，减少 LLM 输出量）。',
      events: ['press'],
    },
    OrderCard: {
      props: z.object({
        order: dynamicValueSchema,
        accessibility: accessibilitySchema,
      }),
      description: '订单卡片组件，展示订单号、状态、商品预览、总价和下单时间。order 字段为订单对象，包含 id, orderNo, status, items, total, createdAt。点击卡片触发 view_order_detail 事件。',
      events: ['press'],
    },
    DishDetail: {
      props: z.object({
        dish: dynamicValueSchema,
        accessibility: accessibilitySchema,
      }),
      description: '菜品详情组件，展示菜品图片、名称、价格、描述、配料和购物车按钮。dish 字段为菜品对象，包含 id, name, price, description, fullDescription, image, ingredients, tags。点击购物车按钮触发 add_to_cart 事件。',
      events: ['press'],
    },
    OrderDetail: {
      props: z.object({
        order: dynamicValueSchema,
        accessibility: accessibilitySchema,
      }),
      description: '订单详情组件，展示订单完整信息（商品列表、配送信息、总价）。order 字段为订单对象，包含 id, orderNo, status, items, total, createdAt, address, phone, contactName, note。',
    },
  },
};
