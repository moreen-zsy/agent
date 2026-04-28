# A2UI (Agent to UI) Protocol v0.8 协议总览

> 本文档整合自 `specification/v0_8/` 目录下的所有协议文件、Schema 和示例。
> A2UI 是由 Google 提出的 Agent-to-Agent UI 协议，用于 LLM 向客户端流式传输可交互的抽象 UI。

---

## 1. 协议简介

A2UI（Agent to UI）是一个基于 **JSON Lines (JSONL)** 的流式 UI 协议。其核心目标是让 LLM 能够以声明式方式生成平台无关的 UI 定义，客户端接收到后使用原生组件渐进式渲染。

### 1.1 核心设计原则

| 原则 | 说明 |
|------|------|
| **LLM 友好** | 使用声明式扁平结构（非命令式），降低 LLM 生成错误的概率 |
| **渐进渲染** | 通过 JSONL/SSE 流式传输，客户端无需等待完整 payload 即可开始渲染 |
| **平台无关** | 组件类型由客户端 Catalog 定义，服务端只发送抽象组件名 |
| **数据与结构分离** | UI 结构（组件树）和动态数据（数据模型）独立更新，避免重复发送完整 UI |
| **单向 UI 流** | 服务端→客户端的 UI 更新是单向 SSE 流；用户交互通过单独的 A2A 消息回传 |

---

## 2. 核心架构

### 2.1 三大解耦元素

1. **组件树（结构）**：由 `surfaceUpdate` 消息定义的抽象组件树
2. **数据模型（状态）**：由 `dataModelUpdate` 消息管理的动态 JSON 数据
3. **组件目录（Catalog）**：客户端定义的组件名称到原生控件的映射表

### 2.2 Surface：多区域 UI 管理

**Surface** 是屏幕上的一个独立渲染区域，通过 `surfaceId` 标识。一个 A2UI 流可同时控制多个 surface（如聊天中的每条消息、侧边栏等）。每个 surface 拥有独立的组件树和数据模型。

### 2.3 数据流

```
Server ──SSE(JSONL)──► Client
  │                      │
  │                      ├─ 缓冲 surfaceUpdate（组件）
  │                      ├─ 缓冲 dataModelUpdate（数据）
  │                      ├─ 收到 beginRendering → 开始渲染
  │                      ├─ 用户交互 → 构造 userAction
  │                      └─ A2A 消息回传 Server ◄──────┘
```

### 2.4 完整流示例（用户资料卡片）

```jsonl
{"surfaceUpdate": {"components": [{"id": "root", "component": {"Column": {"children": {"explicitList": ["profile_card"]}}}}]}}
{"surfaceUpdate": {"components": [{"id": "profile_card", "component": {"Card": {"child": "card_content"}}}]}}
{"surfaceUpdate": {"components": [{"id": "card_content", "component": {"Column": {"children": {"explicitList": ["header_row", "bio_text"]}}}}]}}
{"surfaceUpdate": {"components": [{"id": "header_row", "component": {"Row": {"alignment": "center", "children": {"explicitList": ["avatar", "name_column"]}}}}]}}
{"surfaceUpdate": {"components": [{"id": "avatar", "component": {"Image": {"url": {"literalString": "https://www.example.com/profile.jpg"}}}}]}}
{"surfaceUpdate": {"components": [{"id": "name_column", "component": {"Column": {"alignment": "start", "children": {"explicitList": ["name_text", "handle_text"]}}}}]}}
{"surfaceUpdate": {"components": [{"id": "name_text", "component": {"Text": {"usageHint": "h3", "text": {"literalString": "A2A Fan"}}}}]}}
{"surfaceUpdate": {"components": [{"id": "handle_text", "component": {"Text": {"text": {"literalString": "@a2a_fan"}}}}]}}
{"surfaceUpdate": {"components": [{"id": "bio_text", "component": {"Text": {"text": {"literalString": "Building beautiful apps from a single codebase."}}}}]}}
{"dataModelUpdate": {"contents": {}}}
{"beginRendering": {"root": "root"}}
```

---

## 3. 服务器→客户端消息

所有消息通过 **JSONL** 流传输（每行一个独立 JSON 对象）。一条消息必须且只能包含以下四个键之一：

### 3.1 `surfaceUpdate` — 更新组件

定义 UI 结构，包含一个组件列表。客户端将所有组件存入按 `id` 索引的 Map 中。

```json
{
  "surfaceUpdate": {
    "surfaceId": "main_content_area",
    "components": [
      {
        "id": "unique-component-id",
        "component": {
          "Text": {
            "text": { "literalString": "Hello, World!" }
          }
        }
      }
    ]
  }
}
```

- `surfaceId`（必需）：目标 surface 标识
- `components`（必需）：组件实例数组，每项包含 `id` 和 `component`
- `weight`（可选，number）：在 Row/Column 中的相对权重（类似 CSS flex-grow）

### 3.2 `dataModelUpdate` — 更新数据模型

修改 surface 的数据模型，支持路径更新。

```json
{
  "dataModelUpdate": {
    "surfaceId": "main_content_area",
    "path": "user",
    "contents": [
      { "key": "name", "valueString": "Bob" },
      { "key": "isVerified", "valueBoolean": true },
      {
        "key": "address",
        "valueMap": [
          { "key": "street", "valueString": "123 Main St" },
          { "key": "city", "valueString": "Anytown" }
        ]
      }
    ]
  }
}
```

- `surfaceId`（必需）：目标 surface
- `path`（可选）：数据模型内的路径（如 `"user"`）。省略则替换根
- `contents`（必需）：数据条目数组，每项含 `key` 和一个 `value*` 属性：
  - `valueString` / `valueNumber` / `valueBoolean`：基本类型
  - `valueMap`：嵌套对象（递归的 adjacency list）

### 3.3 `beginRendering` — 开始渲染

通知客户端可以开始渲染，防止"不完整内容闪烁"。

```json
{
  "beginRendering": {
    "surfaceId": "unique-surface-1",
    "catalogId": "https://a2ui.org/specification/v0_8/standard_catalog_definition.json",
    "root": "root-component-id",
    "styles": { "primaryColor": "#00BFFF" }
  }
}
```

- `surfaceId`（必需）：目标 surface
- `root`（必需）：根组件的 `id`
- `catalogId`（可选）：所选 Catalog ID。省略则默认使用标准 Catalog
- `styles`（可选）：样式配置

### 3.4 `deleteSurface` — 删除 Surface

```json
{
  "deleteSurface": {
    "surfaceId": "unique-surface-1"
  }
}
```

---

## 4. 组件模型

### 4.1 邻接列表模型

A2UI 使用**扁平列表**而非嵌套 JSON 树。组件之间的父子关系通过字符串 `id` 引用实现。这极大降低了 LLM 生成嵌套结构的出错概率。

```
Server Stream                Client Buffer (Map)              Rendered Tree
─────────────                ───────────────────              ─────────────
surfaceUpdate: [root,        root → Column(children:[title,   Column
                title,       title → Text("Welcome")          ├── Text: "Welcome"
                button,      button → Button(child:btn_text)  └── Button
                btn_text]    btn_text → Text("Go")                 └── Text: "Go"

beginRendering: root ──────► 触发从 root 递归构建控件树
```

### 4.2 容器子元素：`explicitList` vs `template`

容器组件（Row、Column、List）的 `children` 属性必须且只能包含以下之一：

- **`explicitList`**：组件 `id` 字符串数组，用于静态子元素
  ```json
  { "children": { "explicitList": ["child1", "child2"] } }
  ```

- **`template`**：动态列表模板，从数据模型绑定数组生成子元素
  ```json
  {
    "children": {
      "template": {
        "dataBinding": "/user/posts",
        "componentId": "post_item_template"
      }
    }
  }
  ```

---

## 5. Catalog 协商机制

Catalog 定义了服务端和客户端之间的组件契约（支持哪些组件、属性、样式）。v0.8 支持**动态协商**。

### 5.1 标准 Catalog ID

```
https://a2ui.org/specification/v0_8/standard_catalog_definition.json
```

### 5.2 协商流程

1. **服务端在 Agent Card 中宣告能力**：
   ```json
   {
     "capabilities": {
       "extensions": [
         {
           "uri": "https://a2ui.org/a2a-extension/a2ui/v0.8",
           "params": {
             "supportedCatalogIds": [
               "https://a2ui.org/specification/v0_8/standard_catalog_definition.json"
             ],
             "acceptsInlineCatalogs": true
           }
         }
       ]
     }
   }
   ```

2. **客户端在每条 A2A 消息中声明能力**（通过 `metadata.a2uiClientCapabilities`）：
   ```json
   {
     "metadata": {
       "a2uiClientCapabilities": {
         "supportedCatalogIds": [
           "https://a2ui.org/specification/v0_8/standard_catalog_definition.json"
         ],
         "inlineCatalogs": [
           {
             "catalogId": "https://my-company.com/inline_catalogs/custom",
             "components": { ... },
             "styles": { ... }
           }
         ]
       }
     }
   }
   ```

3. **服务端选择 Catalog 并在 `beginRendering` 中指定**。

---

## 6. 标准 Catalog 组件清单

### 6.1 内容组件

| 组件 | 必需属性 | 可选属性 | 说明 |
|------|----------|----------|------|
| **Text** | `text` | `usageHint` (h1~h5, caption, body) | 文本显示，支持简单 Markdown |
| **Image** | `url` | `fit` (contain/cover/fill/none/scale-down), `usageHint` (icon/avatar/smallFeature/mediumFeature/largeFeature/header) | 图片 |
| **Icon** | `name` | — | 图标，内置 46 种标准图标名 |
| **Video** | `url` | — | 视频播放器 |
| **AudioPlayer** | `url` | `description` | 音频播放器 |

### 6.2 布局容器

| 组件 | 必需属性 | 可选属性 | 说明 |
|------|----------|----------|------|
| **Row** | `children` | `distribution` (CSS justify-content), `alignment` (CSS align-items) | 水平布局 |
| **Column** | `children` | `distribution`, `alignment` | 垂直布局 |
| **List** | `children` | `direction` (vertical/horizontal), `alignment` | 列表 |
| **Card** | `child` | — | 卡片容器 |
| **Tabs** | `tabItems` | — | 标签页，每项含 `title` 和 `child` |
| **Divider** | — | `axis` (horizontal/vertical) | 分隔线 |
| **Modal** | `entryPointChild`, `contentChild` | — | 弹窗（触发组件 + 内容组件） |

### 6.3 交互组件

| 组件 | 必需属性 | 可选属性 | 说明 |
|------|----------|----------|------|
| **Button** | `child`, `action` | `primary` | 按钮，`action` 含 `name` 和可选 `context` |
| **CheckBox** | `label`, `value` | — | 复选框 |
| **TextField** | `label` | `text`, `textFieldType` (date/longText/number/shortText/obscured), `validationRegexp` | 文本输入 |
| **DateTimeInput** | `value` | `enableDate`, `enableTime` | 日期时间选择器 |
| **MultipleChoice** | `selections`, `options` | `maxAllowedSelections`, `variant` (checkbox/chips), `filterable` | 多选 |
| **Slider** | `value` | `minValue`, `maxValue` | 滑动条 |

### 6.4 内置图标名（Icon 组件）

`accountCircle`, `add`, `arrowBack`, `arrowForward`, `attachFile`, `calendarToday`, `call`, `camera`, `check`, `close`, `delete`, `download`, `edit`, `event`, `error`, `favorite`, `favoriteOff`, `folder`, `help`, `home`, `info`, `locationOn`, `lock`, `lockOpen`, `mail`, `menu`, `moreVert`, `moreHoriz`, `notificationsOff`, `notifications`, `payment`, `person`, `phone`, `photo`, `print`, `refresh`, `search`, `send`, `settings`, `share`, `shoppingCart`, `star`, `starHalf`, `starOff`, `upload`, `visibility`, `visibilityOff`, `warning`

### 6.5 样式

| 样式名 | 类型 | 说明 |
|--------|------|------|
| `font` | string | 主字体 |
| `primaryColor` | string (#RRGGBB) | 主题主色 |

---

## 7. 数据绑定（BoundValue）

组件属性通过 `BoundValue` 对象连接数据模型，支持三种模式：

### 7.1 纯字面量
```json
{ "text": { "literalString": "Hello" } }
{ "value": { "literalNumber": 42 } }
{ "value": { "literalBoolean": true } }
```

### 7.2 纯数据绑定
```json
{ "text": { "path": "/user/name" } }
```

### 7.3 初始化简写（path + literal）

同时提供 `path` 和 `literal*` 时，客户端会：
1. 将 `literal*` 值写入数据模型的指定路径
2. 将组件属性绑定到该路径

```json
// 初始化 /user/name 为 "Guest"，同时绑定到该路径
{ "text": { "path": "/user/name", "literalString": "Guest" } }
```

---

## 8. 客户端→服务器事件

用户交互通过 **A2A 消息**回传（非 SSE 流），A2UI 数据以 `DataPart` 编码：

```json
{
  "data": {
    "userAction": {
      "name": "submit_form",
      "surfaceId": "main_content_area",
      "sourceComponentId": "submit_btn",
      "timestamp": "2025-09-19T17:05:00Z",
      "context": {
        "userInput": "User input text",
        "formId": "f-123"
      }
    }
  },
  "kind": "data",
  "metadata": { "mimeType": "application/json+a2ui" }
}
```

### 8.1 `userAction`

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 动作名（来自组件 `action.name`） |
| `surfaceId` | string | 事件来源 surface |
| `sourceComponentId` | string | 触发事件的组件 ID |
| `timestamp` | string (ISO 8601) | 事件发生时间 |
| `context` | object | 解析后的 `action.context`，所有 BoundValue 已解析为实际值 |

### 8.2 `error`

客户端渲染或数据绑定出错时发送，内容灵活。

---

## 9. 示例详解

### 9.1 登录表单（Minimal Catalog）

```json
[
  {
    "dataModelUpdate": {
      "surfaceId": "4_login_form",
      "path": "/",
      "contents": [
        { "key": "username", "valueString": "" },
        { "key": "password", "valueString": "" }
      ]
    }
  },
  {
    "surfaceUpdate": {
      "surfaceId": "4_login_form",
      "components": [
        { "id": "root", "component": { "Column": { "children": { "explicitList": ["form_title","username_field","password_field","submit_button"] }, "distribution": "start", "alignment": "stretch" } } },
        { "id": "form_title", "component": { "Text": { "text": { "literalString": "Login" }, "usageHint": "h2" } } },
        { "id": "username_field", "component": { "TextField": { "label": { "literalString": "Username" }, "text": { "path": "/username" }, "textFieldType": "shortText" } } },
        { "id": "password_field", "component": { "TextField": { "label": { "literalString": "Password" }, "text": { "path": "/password" }, "textFieldType": "obscured" } } },
        { "id": "submit_button", "component": { "Button": { "child": "submit_label", "primary": true, "action": { "name": "login_submitted", "context": [{ "key": "user", "value": { "path": "/username" } }, { "key": "pass", "value": { "path": "/password" } }] } } } },
        { "id": "submit_label", "component": { "Text": { "text": { "literalString": "Sign In" } } } }
      ]
    }
  },
  {
    "beginRendering": {
      "surfaceId": "4_login_form",
      "root": "root",
      "catalogId": "https://a2ui.org/specification/v0_8/catalogs/minimal/minimal_catalog.json"
    }
  }
]
```

**要点**：
- 先发送 `dataModelUpdate` 初始化数据（空用户名/密码）
- `TextField` 的 `text` 绑定到数据路径，用户输入会更新数据模型
- 按钮 `context` 中的 `path` 会在点击时解析为当前数据模型值
- 指定了 `catalogId` 使用 Minimal Catalog

### 9.2 产品卡片（Standard Catalog）

核心结构：`Card → Column → [Image, Column → [Text, Row, Row, Row]]`

```json
{
  "surfaceUpdate": {
    "surfaceId": "gallery-product-card",
    "components": [
      { "id": "root", "component": { "Card": { "child": "main-column" } } },
      { "id": "main-column", "component": { "Column": { "children": { "explicitList": ["image","details"] } } } },
      { "id": "image", "component": { "Image": { "url": { "path": "/imageUrl" }, "fit": "cover" } } },
      { "id": "details", "component": { "Column": { "children": { "explicitList": ["name","rating-row","price-row","actions"] } } } },
      { "id": "name", "component": { "Text": { "text": { "path": "/name" }, "usageHint": "h3" } } },
      { "id": "rating-row", "component": { "Row": { "children": { "explicitList": ["stars","reviews"] }, "alignment": "center" } } },
      { "id": "stars", "component": { "Text": { "text": { "path": "/stars" }, "usageHint": "body" } } },
      { "id": "reviews", "component": { "Text": { "text": { "path": "/reviews" }, "usageHint": "caption" } } },
      { "id": "price-row", "component": { "Row": { "children": { "explicitList": ["price","original-price"] }, "alignment": "start" } } },
      { "id": "price", "component": { "Text": { "text": { "path": "/price" }, "usageHint": "h2" } } },
      { "id": "original-price", "component": { "Text": { "text": { "path": "/originalPrice" }, "usageHint": "caption" } } },
      { "id": "actions", "component": { "Row": { "children": { "explicitList": ["add-cart-btn"] } } } },
      { "id": "add-cart-btn-text", "component": { "Text": { "text": { "literalString": "Add to Cart" } } } },
      { "id": "add-cart-btn", "component": { "Button": { "child": "add-cart-btn-text", "action": { "name": "addToCart", "context": [] } } } }
    ]
  }
}
```

### 9.3 音乐播放器（含 Slider、Icon、动态数据）

```json
// Slider 绑定到播放进度
{ "id": "progress", "component": { "Slider": { "value": { "path": "/progress" }, "maxValue": 1 } } }

// Icon 名称可从数据模型动态绑定
{ "id": "play-btn-icon", "component": { "Icon": { "name": { "path": "/playIcon" } } } }
```

---

## 10. JSON Schema 文件说明

| 文件 | 说明 |
|------|------|
| `server_to_client.json` | 核心消息 Schema（Catalog 无关），定义四种消息类型 |
| `client_to_server.json` | 客户端事件 Schema，定义 `userAction` 和 `error` |
| `catalog_description_schema.json` | Catalog 元 Schema，定义 Catalog 文档的结构 |
| `standard_catalog_definition.json` | 标准 Catalog 实现，包含所有标准组件和样式定义 |
| `server_to_client_with_standard_catalog.json` | 已解析的完整 Schema（server_to_client + standard catalog），适合直接给 LLM 做结构化输出约束 |
| `a2ui_client_capabilities_schema.json` | 客户端能力声明 Schema |
| `catalogs/minimal/minimal_catalog.json` | 最小 Catalog（Text, Row, Column, Button, TextField），用于测试新渲染器 |
| `catalogs/basic/examples/` | 29 个标准 Catalog 示例（航班状态、邮件、日历、天气、产品卡片、音乐播放器、登录表单等） |
| `catalogs/minimal/examples/` | 5 个 Minimal Catalog 示例 |

---

## 11. 客户端实现要点

一个完整的 A2UI 客户端应包含以下模块：

1. **JSONL 解析器**：逐行解析 SSE 流
2. **消息分发器**：识别消息类型并路由到对应处理器
3. **组件缓冲区**：`Map<String, Component>`，按 `id` 存储所有组件
4. **数据模型存储**：管理每个 surface 的 JSON 数据状态
5. **渲染状态机**：`_isReadyToRender`，由 `beginRendering` 触发
6. **组件注册表（Widget Registry）**：将组件类型名映射到原生控件构建器
7. **绑定解析器**：将 `BoundValue` 解析为数据模型中的实际值
8. **Surface 管理器**：创建、更新、删除 surface
9. **事件处理器**：构造并发送 `userAction` A2A 消息

---

## 12. 目录结构

```
specification/v0_8/
├── README.md                           # v0.8.2 入口说明
├── docs/
│   ├── a2ui_protocol.md                # 完整协议文档（核心）
│   ├── a2ui_extension_specification.md # A2A 扩展规范
│   └── custom_catalog_changes.md       # Catalog 协商变更说明
├── json/
│   ├── README.md                       # Schema 文件说明
│   ├── server_to_client.json           # 服务端消息 Schema
│   ├── client_to_server.json           # 客户端事件 Schema
│   ├── catalog_description_schema.json # Catalog 元 Schema
│   ├── standard_catalog_definition.json# 标准 Catalog 定义
│   ├── server_to_client_with_standard_catalog.json # 解析后完整 Schema
│   ├── a2ui_client_capabilities_schema.json # 客户端能力 Schema
│   └── catalogs/
│       ├── basic/examples/             # 29 个标准示例
│       └── minimal/                    # 最小 Catalog + 5 个示例
└── eval/                               # Genkit 评估框架（测试 LLM UI 生成能力）
```

---

## 13. 协议扩展 URI

```
https://a2ui.org/a2a-extension/a2ui/v0.8
```

此 URI 是 A2UI v0.8 扩展的唯一标识，用于 A2A 协议的扩展协商机制（如 HTTP 头 `X-A2A-Extensions`）。
