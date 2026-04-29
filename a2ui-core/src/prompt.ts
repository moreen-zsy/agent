/**
 * A2UI AI Prompt 生成器
 * 从 Catalog 定义自动生成 System Prompt，用于指导 AI 生成符合 A2UI v0.8 协议的 UI
 */

import type { A2UICatalog, CatalogComponentDef } from './catalog.js';

// ============================================================
// Prompt 选项
// ============================================================

export interface PromptOptions {
  /** 自定义 system 消息前缀 */
  system?: string;
  /** 额外规则 */
  customRules?: string[];
  /** 输出模式 */
  mode?: 'standalone' | 'chat';
  /** 组件使用示例 */
  includeExamples?: boolean;
}

// ============================================================
// Zod 类型格式化辅助
// ============================================================

function formatZodType(schema: any): string {
  if (!schema || !schema._def) return 'any';

  const def = schema._def as Record<string, any>;
  const typeName = (def.typeName as string) || (def.type as string) || '';

  switch (typeName) {
    case 'ZodString':
    case 'string':
      return 'string';
    case 'ZodNumber':
    case 'number':
      return 'number';
    case 'ZodBoolean':
    case 'boolean':
      return 'boolean';
    case 'ZodLiteral':
    case 'literal': {
      const values = def.values as unknown[] | undefined;
      return JSON.stringify(values?.[0] ?? def.value);
    }
    case 'ZodEnum':
    case 'enum': {
      let values: string[];
      if (Array.isArray(def.values)) {
        values = def.values as string[];
      } else if (def.entries && typeof def.entries === 'object') {
        values = Object.values(def.entries as Record<string, string>);
      } else {
        return 'enum';
      }
      return values.map((v) => `"${v}"`).join(' | ');
    }
    case 'ZodArray':
    case 'array': {
      const inner = (def.type as any) ?? (def.element as any);
      return inner ? `Array<${formatZodType(inner)}>` : 'Array<any>';
    }
    case 'ZodObject':
    case 'object': {
      const shape =
        typeof def.shape === 'function'
          ? (def.shape as () => Record<string, any>)()
          : (def.shape as Record<string, any>);
      if (!shape) return 'object';
      const props = Object.entries(shape)
        .map(([key, value]) => {
          const innerType = (value as any)._def?.typeName || (value as any)._def?.type || '';
          const isOptional = innerType === 'ZodOptional' || innerType === 'optional';
          return `${key}${isOptional ? '?' : ''}: ${formatZodType(value)}`;
        })
        .join(', ');
      return `{ ${props} }`;
    }
    case 'ZodUnion':
    case 'union': {
      const options = def.options as any[] | undefined;
      return options ? options.map((o) => formatZodType(o)).join(' | ') : 'union';
    }
    case 'ZodOptional':
    case 'optional': {
      const inner = def.innerType as any;
      return inner ? `${formatZodType(inner)}?` : 'optional';
    }
    case 'ZodRecord':
    case 'record':
      return 'Record<string, any>';
    default:
      return 'any';
  }
}

/**
 * 从 Zod schema 中提取必填属性示例值
 */
function getExampleProps(def: CatalogComponentDef): Record<string, any> {
  if (!def.props || !def.props._def) return {};

  const defObj = def.props._def as Record<string, any>;
  const typeName = (defObj.typeName as string) || (defObj.type as string) || '';

  if (typeName !== 'ZodObject' && typeName !== 'object') return {};

  const shape =
    typeof defObj.shape === 'function'
      ? (defObj.shape as () => Record<string, any>)()
      : (defObj.shape as Record<string, any>);
  if (!shape) return {};

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(shape)) {
    const innerDef = (value as any)._def as Record<string, any> | undefined;
    if (!innerDef) continue;

    const innerType = (innerDef.typeName as string) || (innerDef.type as string) || '';
    if (innerType === 'ZodOptional' || innerType === 'optional') continue;

    // 为 BoundValue 类型生成示例
    if (innerType === 'ZodUnion' || innerType === 'union') {
      const options = innerDef.options as any[] | undefined;
      if (options && options.length > 0) {
        const firstOption = options[0];
        const firstDef = firstOption?._def as Record<string, any> | undefined;
        const firstType = (firstDef?.typeName as string) || (firstDef?.type as string) || '';
        if (firstType === 'ZodObject' || firstType === 'object') {
          const firstShape = firstDef?.shape as Record<string, any> | undefined;
          if (firstShape && firstShape.literalString) {
            result[key] = { literalString: 'example' };
            continue;
          }
          if (firstShape && firstShape.path) {
            result[key] = { path: `/data/${key}` };
            continue;
          }
        }
      }
      result[key] = 'example';
      continue;
    }

    switch (innerType) {
      case 'ZodString':
      case 'string':
        result[key] = 'example';
        break;
      case 'ZodNumber':
      case 'number':
        result[key] = 0;
        break;
      case 'ZodBoolean':
      case 'boolean':
        result[key] = true;
        break;
      case 'ZodArray':
      case 'array':
        result[key] = [];
        break;
      default:
        result[key] = null;
    }
  }
  return result;
}

// ============================================================
// Prompt 生成
// ============================================================

/**
 * 从 Catalog 生成 AI System Prompt
 *
 * @param catalog Catalog 定义
 * @param options Prompt 选项
 * @returns System Prompt 字符串
 */
export function generatePrompt(catalog: A2UICatalog, options: PromptOptions = {}): string {
  const {
    system = 'You are a UI generation assistant that outputs A2UI v0.8 protocol messages.',
    customRules = [],
    mode = 'standalone',
    includeExamples = true,
  } = options;

  const lines: string[] = [];
  lines.push(system);
  lines.push('');

  // 输出格式说明
  if (mode === 'chat') {
    lines.push('## OUTPUT FORMAT (对话 + JSONL)');
    lines.push('你可以先进行简短的对话说明，然后在需要生成 UI 时输出 JSONL 消息。');
    lines.push('每条消息是一个独立的 JSON 对象，占一行。');
  } else {
    lines.push('## OUTPUT FORMAT (JSONL)');
    lines.push('输出严格的 JSONL（每行一个 JSON 对象），使用 A2UI v0.8 协议格式。');
  }
  lines.push('');

  // 消息类型说明
  lines.push('## A2UI v0.8 MESSAGE TYPES');
  lines.push('');
  lines.push('### 1. surfaceUpdate - 更新组件');
  lines.push('```json');
  lines.push(JSON.stringify({
    surfaceUpdate: {
      surfaceId: 'main',
      components: [
        {
          id: 'title',
          component: {
            Text: {
              text: { literalString: 'Hello World' },
            },
          },
        },
      ],
    },
  }, null, 2));
  lines.push('```');
  lines.push('');

  lines.push('### 2. dataModelUpdate - 更新数据模型');
  lines.push('```json');
  lines.push(JSON.stringify({
    dataModelUpdate: {
      surfaceId: 'main',
      path: 'user',
      contents: [
        { key: 'name', valueString: 'Alice' },
        { key: 'age', valueNumber: 30 },
        { key: 'isActive', valueBoolean: true },
      ],
    },
  }, null, 2));
  lines.push('```');
  lines.push('');

  lines.push('### 3. beginRendering - 开始渲染');
  lines.push('```json');
  lines.push(JSON.stringify({
    beginRendering: {
      surfaceId: 'main',
      root: 'title',
    },
  }, null, 2));
  lines.push('```');
  lines.push('');

  lines.push('### 4. deleteSurface - 删除 Surface');
  lines.push('```json');
  lines.push(JSON.stringify({
    deleteSurface: {
      surfaceId: 'main',
    },
  }, null, 2));
  lines.push('```');
  lines.push('');

  // BoundValue 说明
  lines.push('## BOUND VALUE FORMAT');
  lines.push('组件属性值使用以下格式之一：');
  lines.push('- `{ "literalString": "文本" }` - 字符串字面量');
  lines.push('- `{ "literalNumber": 42 }` - 数字字面量');
  lines.push('- `{ "literalBoolean": true }` - 布尔字面量');
  lines.push('- `{ "path": "/user/name" }` - 数据模型路径绑定（JSON Pointer）');
  lines.push('- `{ "literalString": "默认值", "path": "/user/name" }` - 初始化简写：写入默认值并绑定');
  lines.push('');

  // Children 说明
  lines.push('## CHILDREN FORMAT');
  lines.push('容器组件使用 children 属性定义子元素：');
  lines.push('- `{ "children": { "explicitList": ["child-id-1", "child-id-2"] } }` - 静态子元素列表');
  lines.push('- `{ "children": { "template": { "dataBinding": "/items", "componentId": "item-template" } } }` - 动态列表模板');
  lines.push('');

  // 可用组件
  const componentNames = Object.keys(catalog.components);
  lines.push(`## AVAILABLE COMPONENTS (${componentNames.length})`);
  lines.push('');

  for (const [name, def] of Object.entries(catalog.components)) {
    const propsStr = formatZodType(def.props);
    const eventsStr = def.events && def.events.length > 0
      ? ` [events: ${def.events.join(', ')}]`
      : '';
    const slotsStr = def.slots && def.slots.length > 0
      ? ` [slots: ${def.slots.join(', ')}]`
      : '';
    const descStr = def.description ? ` - ${def.description}` : '';
    lines.push(`### ${name}`);
    lines.push(`Props: ${propsStr}${descStr}${eventsStr}${slotsStr}`);
    lines.push('');
  }

  // 示例
  if (includeExamples && componentNames.length > 0) {
    const firstComp = componentNames[0]!;
    const firstDef = catalog.components[firstComp];
    const exampleProps = firstDef ? getExampleProps(firstDef) : {};

    lines.push('## EXAMPLE');
    lines.push('```jsonl');
    lines.push(JSON.stringify({
      surfaceUpdate: {
        surfaceId: 'main',
        components: [
          {
            id: 'root',
            component: {
              Column: {
                children: { explicitList: [firstComp.toLowerCase()] },
              },
            },
          },
          {
            id: firstComp.toLowerCase(),
            component: {
              [firstComp]: exampleProps,
            },
          },
        ],
      },
    }));
    lines.push(JSON.stringify({
      dataModelUpdate: {
        surfaceId: 'main',
        path: '/',
        contents: [
          { key: 'user', valueMap: [{ key: 'name', valueString: 'Alice' }] },
        ],
      },
    }));
    lines.push(JSON.stringify({
      beginRendering: {
        surfaceId: 'main',
        root: 'root',
      },
    }));
    lines.push('```');
    lines.push('');
  }

  // 规则
  lines.push('## RULES');
  const baseRules = [
    '每条消息必须且只能包含一个顶层键（surfaceUpdate / dataModelUpdate / beginRendering / deleteSurface）',
    '组件 id 必须在同一 surface 内唯一',
    '先发送 surfaceUpdate 定义组件，再发送 beginRendering 指定 root',
    '数据模型使用 dataModelUpdate，path 使用 JSON Pointer 格式（如 "/user/name"）',
    'DataEntry 使用 key + valueString/valueNumber/valueBoolean/valueMap 之一',
    '容器组件使用 children 属性引用子组件 id',
    '组件 type 必须从 AVAILABLE COMPONENTS 列表中选择',
    '属性值优先使用数据绑定（path）而非硬编码字面量',
    '保持组件引用关系无循环',
  ];

  const allRules = [...baseRules, ...customRules];
  allRules.forEach((rule, i) => {
    lines.push(`${i + 1}. ${rule}`);
  });

  return lines.join('\n');
}

/**
 * 快捷方式：从 Catalog 直接生成 prompt
 *
 * @example
 * ```typescript
 * const prompt = catalog.prompt();
 * const promptWithRules = catalog.prompt({ customRules: ['...'] });
 * ```
 */
export function catalogPrompt(catalog: A2UICatalog, options?: PromptOptions): string {
  return generatePrompt(catalog, options);
}
