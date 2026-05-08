# Streamdown + 自定义渲染器实现生成式 UI 嵌入回复

本文档总结 Morphic 项目如何使用 `streamdown` 配合自定义 `CustomRenderer`，实现将 LLM 生成的交互式组件嵌入到聊天回复中。

---

## 一、架构概览

整个流程分为三层：

```
┌─────────────────┐     ┌──────────────────────┐     ┌────────────────────┐
│  Prompt 工程     │────▶│  LLM 流式生成 Markdown │────▶│  前端流式渲染 + 拦截  │
│                 │     │  内含 ```spec 代码块   │     │  streamdown 自定义    │
│ - 系统提示       │     │                      │     │  renderer 捕获 spec   │
│ - 组件/Action定义│     │  纯文本，无特殊语义    │     │  并渲染为 React 组件  │
│ - 示例 + 规则    │     │  LLM 按指令自觉生成    │     │                     │
└─────────────────┘     └──────────────────────┘     └────────────────────┘
```

---

## 二、核心机制：Prompt 驱动 LLM 生成 spec

项目**没有使用 Function Calling** 或特殊 API，而是完全通过 **系统提示（System Prompt）** 教会 LLM：

1. 什么时候该生成组件
2. 用什么格式（JSON Patch / JSONL）生成
3. 有哪些可用组件和 Action

### 2.1 Prompt 文件位置

- **`lib/render/prompt.ts`** — 定义 spec 生成的 prompt 片段
- **`lib/agents/prompts/search-mode-prompts.ts`** — 将 spec prompt 拼接到系统提示
- **`lib/agents/researcher.ts`** — 通过 `ToolLoopAgent` 将系统提示传给模型

### 2.2 两种 spec 类型

#### A. 相关问题 spec（强制，回复末尾）

`getRelatedQuestionsSpecPrompt()` 指示 LLM 在每次回复末尾生成 3 个跟进问题按钮：

```ts
export function getRelatedQuestionsSpecPrompt(): string {
  return `
RELATED QUESTIONS (MANDATORY):
After your conclusion, you MUST generate exactly 3 follow-up questions in a \`\`\`spec fenced code block.
...
`
}
```

Prompt 中提供：
- **完整示例**（few-shot）：展示确切的 JSON Patch 格式
- **可用组件**：Heading、Stack、Button 及其 props
- **可用 Action**：`submitQuery: { query: string }`
- **严格规则**：必须放末尾、纯 JSONL、无注释、`text` 和 `query` 必须一致

LLM 输出示例：

````markdown
### 总结

富士山是日本最高峰...

```spec
{"op":"add","path":"/root","value":"main"}
{"op":"add","path":"/elements/main","value":{"type":"Stack","props":{"direction":"vertical","gap":"sm"},"children":["header","questions"]}}
{"op":"add","path":"/elements/header","value":{"type":"Heading","props":{"title":"Related","icon":"related"},"children":[]}}
{"op":"add","path":"/elements/q1","value":{"type":"Button","props":{"text":"富士山最佳攀登季节？","variant":"link","icon":"arrow-right"},"on":{"press":{"action":"submitQuery","params":{"query":"富士山最佳攀登季节？"}}},"children":[]}}
```
````

#### B. 图片 spec（可选，内联正文）

`getImageSpecPrompt()` 指示 LLM 在 Markdown 正文中适时嵌入图片组：

```ts
export function getImageSpecPrompt(): string {
  return `
INLINE IMAGE EMBEDDING:
When images would meaningfully enhance the answer,
embed one or more inline image groups anywhere in the markdown body using \`\`\`spec fenced code blocks.
...
`
}
```

提供：
- **使用场景**：搜索结果有图片、视觉主题等
- **可用组件**：Grid、Image 及其 props 映射规则
- **规则**：只能用搜索工具返回的真实 URL、必须包裹在 Grid 中、同一 Grid 内图片使用相同 aspectRatio

LLM 输出示例：

````markdown
## 富士山

富士山是日本最高峰。

```spec
{"op":"add","path":"/root","value":"grid"}
{"op":"add","path":"/elements/grid","value":{"type":"Grid","props":{"columns":2,"gap":"sm"},"children":["img1","img2"]}}
{"op":"add","path":"/elements/img1","value":{"type":"Image","props":{"src":"https://cdn.example.com/fuji-1.jpg","aspectRatio":"4:3"},"children":[]}}
{"op":"add","path":"/elements/img2","value":{"type":"Image","props":{"src":"https://cdn.example.com/fuji-2.jpg","aspectRatio":"4:3"},"children":[]}}
```

它海拔 3,776 米...
````

### 2.3 系统提示组装流程

```
search-mode-prompts.ts
├── getQuickModePrompt() / getAdaptiveModePrompt()
│   ├── 搜索策略、引用格式、输出格式...
│   ├── ${getImageSpecPrompt()}      ← 图片 spec 注入
│   └── ${getRelatedQuestionsSpecPrompt()}  ← 相关问题 spec 注入
│
└── researcher.ts
    └── new ToolLoopAgent({ instructions: `${systemPrompt}...` })
```

---

## 三、前端流式渲染与拦截

### 3.1 streamdown 渲染 Markdown 流

`components/message.tsx` 使用 `streamdown` 的 `<Streamdown>` 组件将 LLM 输出的 Markdown 流式渲染为 React：

```tsx
const streamdownProps = useMemo<Partial<StreamdownProps>>(
  () => ({
    mode: 'streaming' as const,
    plugins: mergeStreamdownSpecRenderer({ math })
  }),
  []
)

<Streamdown {...streamdownProps} rehypePlugins={rehypePlugins} components={customComponents}>
  {processedMessage}
</Streamdown>
```

### 3.2 自定义 CustomRenderer 拦截 spec 代码块

`lib/render/streamdown-spec.tsx` 注册针对 `spec` 语言的自定义渲染器：

```tsx
export function createStreamdownSpecRenderer(): CustomRenderer {
  return {
    language: 'spec',
    component({ code }) {
      return <SpecFenceBlock source={code} />
    }
  }
}
```

`mergeStreamdownSpecRenderer` 确保用户的其他 renderer 不会被覆盖：

```tsx
export function mergeStreamdownSpecRenderer(plugins?: PluginConfig): PluginConfig {
  const userRenderers = plugins?.renderers ?? []
  const filteredRenderers = userRenderers.filter(renderer => {
    const languages = Array.isArray(renderer.language)
      ? renderer.language
      : [renderer.language]
    return !languages.includes('spec')
  })

  return {
    ...plugins,
    renderers: [createStreamdownSpecRenderer(), ...filteredRenderers]
  }
}
```

### 3.3 流式解析 Spec（支持增量渲染）

`lib/render/parse-spec-block.ts` 使用 `@json-render/core` 的 `createSpecStreamCompiler` 实现**增量解析**：

```tsx
export function createPartialSpecParser(): PartialSpecParser {
  let compiler = createCompiler()
  let lastSource = ''

  return {
    parse(source: string): Spec | null {
      // 增量推送：只解析新增的内容
      if (source.startsWith(lastSource)) {
        compiler.push(source.slice(lastSource.length))
        lastSource = source
        return compiler.getResult()
      }
      // 回退：重新全量解析
      compiler = createCompiler()
      compiler.push(source)
      lastSource = source
      return compiler.getResult()
    },
    reset() {
      compiler = createCompiler()
      lastSource = ''
    }
  }
}
```

核心优势：**即使 `spec` 代码块还在逐字输出，增量编译器已经能渲染出部分 UI**，用户无需等待整个响应完成。

### 3.4 渲染为实际 React 组件

`components/spec-fence-block.tsx` 接收源码并评估：

```tsx
export function SpecFenceBlock({ source }: { source: string }) {
  const [evaluator] = useState(() => createSpecFenceEvaluator())
  const result = useMemo(() => evaluator.evaluate(source), [evaluator, source])
  return <SpecBlock result={result} />
}
```

`components/spec-block.tsx` 在 spec 解析完成后，使用 `@json-render/react` 渲染：

```tsx
<JSONUIProvider registry={registry} initialState={result.spec.state}>
  <ActionProvider handlers={handlers}>
    <Renderer spec={result.spec} registry={registry} />
  </ActionProvider>
</JSONUIProvider>
```

### 3.5 组件注册表

`lib/render/registry.tsx` 将 React 组件注册到 `@json-render/react`：

```tsx
export const { registry } = defineRegistry(catalog, {
  components: {
    Heading, Stack, Button, Grid, Image
  },
  actions: {
    submitQuery: async () => {
      // 由 ActionProvider 在运行时处理
    }
  }
})
```

`lib/render/catalog.ts` 使用 Zod 定义组件 props 和 action 的 schema，供 LLM 生成时遵循：

```ts
export const catalog = schema.createCatalog({
  components: {
    Button: {
      props: z.object({
        text: z.string(),
        icon: iconName,
        variant: z.enum(['default', 'outline', 'ghost', 'link', 'secondary']).optional()
      }),
      description: 'A clickable button that emits a press action'
    },
    // ...
  },
  actions: {
    submitQuery: {
      params: z.object({ query: z.string() }),
      description: 'Submit a follow-up query to the chat'
    }
  }
})
```

---

## 四、关键文件索引

| 文件 | 职责 |
|------|------|
| `lib/render/prompt.ts` | 定义 spec 生成的 prompt 片段（相关问题 + 图片） |
| `lib/agents/prompts/search-mode-prompts.ts` | 组装完整系统提示，注入 spec prompt |
| `lib/agents/researcher.ts` | 创建 ToolLoopAgent，将系统提示传给 LLM |
| `app/api/chat/route.ts` | 聊天 API 路由入口 |
| `lib/streaming/create-chat-stream-response.ts` | 构建流式响应，调用 researcher agent |
| `components/message.tsx` | 使用 streamdown 渲染 Markdown，注入 spec renderer |
| `lib/render/streamdown-spec.tsx` | 自定义 CustomRenderer，拦截 `spec` 语言代码块 |
| `lib/render/parse-spec-block.ts` | 增量解析 spec 源码（JSON Patch → Spec 对象） |
| `components/spec-fence-block.tsx` | 接收 spec 源码，调用评估器 |
| `components/spec-block.tsx` | 将解析好的 spec 渲染为交互式 React 组件 |
| `lib/render/registry.tsx` | 注册可用组件和 Action |
| `lib/render/catalog.ts` | 用 Zod 定义组件和 Action 的 schema |
| `lib/render/schema.ts` | 定义 @json-render/core 的 schema 结构 |

---

## 五、设计要点

1. **Prompt 驱动，无特殊 API**：LLM 生成 spec 完全靠系统提示指导，不依赖 Function Calling 或模型级别的特殊协议。

2. **纯文本流，渲染层拦截**：LLM 输出的是标准 Markdown 流，`streamdown` 在渲染阶段通过 `CustomRenderer` 捕获 `spec` 代码块，实现"透明嵌入"。

3. **增量解析，流式感知**：`createSpecStreamCompiler` 支持增量解析，UI 可以随着文本流逐步构建，无需等待整个代码块完成。

4. **声明式 UI（JSON Patch）**：使用 RFC 6902 JSON Patch 格式（JSONL，每行一个操作）描述组件树，天然支持流式增量构建。

5. **组件注册表解耦**：通过 `defineRegistry` + `catalog` 将可用组件和 Action 以声明方式注册，LLM 只需按 catalog 生成对应 `type`，前端自动映射到真实 React 组件。
