# Todo-List Tool v2（对齐 Anthropic Claude API）— Product Requirements Document (PRD)

## Document Info
| Field | Value |
|-------|-------|
| Version | v2.0 |
| Created | 2026-02-18 |
| Last Updated | 2026-02-18 |
| Status | Draft |
| Previous Version | [v1.0 PRD](2026-02-18-todo-list-tool-prd.md) |

## 1. Overview

### 1.1 Product/Feature Summary
将 todo-list 工具教学示例从自定义 5 工具 CRUD 模式重构为对齐 Anthropic Claude API 标准 + Claude Code TodoWrite/TodoRead 模式。重构后，工具定义采用标准 JSON Schema + `input_schema`（snake_case）格式，工具结果采用 Anthropic `tool_result` 标准格式（`tool_use_id` + `content` 字符串 + `is_error`），Handler 改为异步，让学习者接触到的就是生产环境中的真实格式。

### 1.2 Goals
- 对齐 Anthropic Claude API 的工具定义和结果返回标准格式
- 对齐 Claude Code 的 TodoWrite/TodoRead 两工具整体替换模式
- Handler 异步化，贴近真实 Agent Loop 工具执行模式
- 引入 `tool_use_id` 请求-结果关联机制
- 保持教学简洁性，源代码 < 500 行

### 1.3 Non-Goals (explicitly excluded scope)
- 不包含持久化存储（文件/数据库）
- 不包含 UI 界面
- 不包含用户认证/授权
- 不对接真实 LLM API（仅模拟工具调用流程）
- 不实现 MCP 协议（仅对齐 Anthropic API 格式）

## 2. Users & Scenarios

### 2.1 Target Users
| User Role | Description | Core Need |
|-----------|------------|-----------|
| AI Agent 开发学习者 | 希望理解 agent loop 工具机制的开发者 | 通过标准格式的教学示例学习工具定义、注册、调用和结果返回 |
| 教学内容制作者 | 制作 AI Agent 开发教程的人 | 获得一个对齐 Anthropic API 标准的教学代码示例 |

### 2.2 Core User Story
> As a AI Agent 开发学习者，I want 一个对齐 Anthropic Claude API 标准的 todo-list 工具教学示例，so that 我能学习到生产环境中真实使用的工具定义格式、tool_use_id 关联机制和 tool_result 返回标准。

### 2.3 Use Cases
| ID | Description | Trigger | Expected Outcome |
|----|------------|---------|-----------------|
| UC-001 | 写入任务列表 | LLM 调用 TodoWrite 工具，传入完整 todos 数组 | 系统整体替换当前任务列表，返回写入确认 |
| UC-002 | 读取任务列表 | LLM 调用 TodoRead 工具 | 系统返回当前所有任务的完整列表 |
| UC-003 | 清空任务列表 | LLM 调用 TodoWrite 工具，传入空数组 | 系统清空所有任务，返回写入确认 |
| UC-004 | 调用不存在的工具 | LLM 调用未注册的工具名 | 系统返回错误的 tool_result |

## 3. Functional Requirements

### 3.1 Feature List
| ID | Feature Name | Description | Priority |
|----|-------------|------------|----------|
| F-001 | TodoWrite 工具 | 接收完整 todos 数组，整体替换当前任务列表 | Must |
| F-002 | TodoRead 工具 | 读取当前所有任务，返回完整列表 | Must |
| F-003 | 工具 Schema 定义 | 对齐 Anthropic API 的 input_schema 标准 JSON Schema 格式 | Must |
| F-004 | tool_result 标准返回 | 对齐 Anthropic API 的 tool_result 格式（tool_use_id + content + is_error） | Must |
| F-005 | tool_use_id 关联机制 | executeTool 接收 tool_use_id，在 tool_result 中关联返回 | Must |
| F-006 | 异步 Handler | ToolHandler 返回 Promise，对齐真实异步执行模式 | Must |
| F-007 | 工具注册机制 | ToolRegistry 统一管理工具注册、查找和执行 | Must |
| F-008 | 输入校验 | TodoWrite 对 todos 数组和每个 todo 项做参数校验 | Must |

### 3.2 Feature Details

#### F-001: TodoWrite 工具
**Description**: 接收完整的 todos 数组，整体替换当前内存中的任务列表。采用 Claude Code 的整体替换模式。

**Input**（通过 executeTool 传入的 params）:
- `todos`: array（必填）— Todo 对象数组，每个对象包含：
  - `content`: string（必填）— 任务内容，祈使句形式，不可为空
  - `status`: string（必填）— 枚举值：`"pending"` | `"in_progress"` | `"completed"`
  - `activeForm`: string（必填）— 执行中展示的进行时态文本，不可为空

**Output**（ToolResult 格式）:
```
{
  type: 'tool_result',
  tool_use_id: '<关联的 tool_use_id>',
  content: '{"success":true,"count":<写入的任务数量>}'
}
```

**Business Rules**:
1. 整体替换：写入后 store 中仅保留本次传入的 todos，之前的全部被覆盖
2. 空数组 `[]` 合法，等价于清空所有任务
3. 校验通过后才执行写入，校验失败不修改 store 中任何数据

**Error & Exception Scenarios**:
| Scenario | Trigger Condition | Expected Behavior |
|----------|------------------|-------------------|
| todos 缺失 | params 中没有 todos 字段 | 返回 `is_error: true`，content: `"'todos' array is required"` |
| todos 非数组 | todos 不是数组类型 | 返回 `is_error: true`，content: `"'todos' must be an array"` |
| content 为空 | todo 项的 content 为空字符串或仅空白字符 | 返回 `is_error: true`，content: `"Todo at index {i}: content is required and cannot be empty"` |
| status 无效 | status 不是三个枚举值之一 | 返回 `is_error: true`，content: `"Todo at index {i}: invalid status '{s}'. Must be one of: pending, in_progress, completed"` |
| activeForm 为空 | activeForm 为空字符串或仅空白字符 | 返回 `is_error: true`，content: `"Todo at index {i}: activeForm is required and cannot be empty"` |

**Boundary Conditions**:
- 空数组 `{ todos: [] }`：合法，清空所有任务，返回 `count: 0`
- 单个任务 `{ todos: [{ content: 'x', status: 'pending', activeForm: 'y' }] }`：合法
- content / activeForm 仅一个字符：合法（最小非空）

**State Behavior**:
- 整体替换是原子操作：校验全部通过后一次性替换
- 校验失败时 store 保持不变（不会部分写入）

---

#### F-002: TodoRead 工具
**Description**: 读取当前内存中的所有任务，返回完整列表。

**Input**:
- 无参数

**Output**（ToolResult 格式）:
```
{
  type: 'tool_result',
  tool_use_id: '<关联的 tool_use_id>',
  content: '{"todos":[{"content":"...","status":"...","activeForm":"..."},...]}'
}
```

**Business Rules**:
1. 返回 store 中所有任务
2. 无任务时返回空数组 `{"todos":[]}`

**Error & Exception Scenarios**:
| Scenario | Trigger Condition | Expected Behavior |
|----------|------------------|-------------------|
| 无任务 | store 中没有任何任务 | 正常返回 `{"todos":[]}`（不是错误） |

**Boundary Conditions**:
- 无任务时返回空数组（不是错误）

**State Behavior**:
- 只读操作，不修改任何状态

---

#### F-003: 工具 Schema 定义
**Description**: 工具定义对齐 Anthropic Claude API 格式。

**ToolDefinition 接口**:
```
{
  name: string,               // 工具名称（PascalCase）
  description: string,        // 工具功能描述
  input_schema: {             // 标准 JSON Schema（snake_case 字段名）
    type: 'object',
    properties: { ... },
    required: [ ... ],
    additionalProperties: false
  }
}
```

**TodoWrite Schema**:
- name: `"TodoWrite"`
- input_schema: 包含 `todos` 数组，每个 item 含 `content`（string, minLength: 1）、`status`（enum）、`activeForm`（string, minLength: 1）
- `additionalProperties: false` 在 item 层级

**TodoRead Schema**:
- name: `"TodoRead"`
- input_schema: `{ type: 'object', properties: {} }`

---

#### F-004: tool_result 标准返回
**Description**: 所有工具执行结果采用 Anthropic API `tool_result` 标准格式。

**ToolResult 接口**:
```
{
  type: 'tool_result',          // 固定值
  tool_use_id: string,          // 关联请求的唯一 ID
  content: string,              // 结果内容（JSON 序列化字符串或错误消息）
  is_error?: boolean            // 标记执行错误，默认 false
}
```

**Rules**:
1. `content` 始终为字符串：成功时为 JSON.stringify 的结果对象，失败时为错误消息文本
2. `is_error` 仅在错误时设为 `true`，成功时省略或设为 `false`
3. `tool_use_id` 必须与调用时传入的 ID 一致

---

#### F-005: tool_use_id 关联机制
**Description**: 在 executeTool 流程中引入 tool_use_id，模拟 LLM 工具调用的请求-结果关联。

**executeTool 签名**:
```
executeTool(toolUseId: string, name: string, params: Record<string, unknown>): Promise<ToolResult>
```

**Rules**:
1. `toolUseId` 由调用方（模拟 LLM）传入
2. 返回的 `ToolResult.tool_use_id` 必须等于传入的 `toolUseId`
3. 即使工具执行失败（找不到工具、参数校验失败），`tool_use_id` 仍然正确关联

---

#### F-006: 异步 Handler
**Description**: ToolHandler 返回 Promise，对齐真实异步执行模式。

**ToolHandler 类型**:
```
type ToolHandler = (params: Record<string, unknown>) => Promise<ToolHandlerResult>
```

**ToolHandlerResult**（Handler 内部返回格式，不含 tool_use_id）:
```
{
  content: string,
  is_error?: boolean
}
```

**Rules**:
1. Handler 只负责业务逻辑，不感知 `tool_use_id`
2. `tool_use_id` 由 ToolRegistry.executeTool 在组装 ToolResult 时填入
3. Handler 返回的 content 和 is_error 直接传递到最终 ToolResult

---

#### F-007: 工具注册机制
**Description**: ToolRegistry 统一管理工具注册、查找和执行。

**API**:
| Method | Description |
|--------|------------|
| `register(definition, handler)` | 注册工具（Schema + async Handler） |
| `getTool(name)` | 按名称查找已注册的工具 |
| `getToolDefinitions()` | 获取所有工具 Schema 列表（发给 LLM） |
| `executeTool(toolUseId, name, params)` | 执行指定工具，返回标准 ToolResult |

**executeTool 逻辑**:
1. 按 name 查找工具 → 找不到则返回 `{ type: 'tool_result', tool_use_id, content: "Tool '{name}' not found", is_error: true }`
2. 调用 handler(params) → 获取 ToolHandlerResult
3. 组装 ToolResult：填入 `type: 'tool_result'`、`tool_use_id`、handler 返回的 `content` 和 `is_error`

---

#### F-008: 输入校验
**Description**: TodoWrite 对传入的 todos 数组做完整的参数校验。

**校验顺序**（遇到第一个错误即返回）:
1. 检查 `todos` 字段是否存在
2. 检查 `todos` 是否为数组
3. 遍历数组，对每个 todo 项按顺序检查：
   a. `content` 是否为非空字符串（trim 后）
   b. `status` 是否为合法枚举值
   c. `activeForm` 是否为非空字符串（trim 后）

**Rules**:
1. 遇到第一个校验错误即返回，不继续检查后续项
2. 错误消息中包含 index 信息，帮助调用方定位问题
3. 校验失败不修改 store

## 4. Non-Functional Requirements

### 4.1 Performance Requirements
| Metric | Requirement | Measurement Method |
|--------|------------|-------------------|
| 代码量 | src/ 源代码 < 500 行（不含测试） | wc -l 统计 |
| 概念覆盖 | 覆盖 6 个核心教学概念 | 清单检查：Schema 定义、注册、异步执行、tool_use_id、tool_result、参数校验 |

### 4.2 Security Requirements
- 作为教学示例，无特殊安全要求
- 输入验证用于展示工具参数校验模式，非安全防护目的

### 4.3 Usability Requirements
- 代码结构清晰，关键逻辑有教学注释
- 可通过 `npm install && npm test` 一键运行测试
- 提供可直接运行的示例脚本

### 4.4 Compatibility Requirements
- Node.js >= 18
- TypeScript 5.x 严格模式

## 5. Constraints & Dependencies

### 5.1 Constraints
- 仅使用内存存储，会话结束数据消失
- 零运行时依赖
- 作为教学示例，优先简洁可读而非功能完备

### 5.2 External Dependencies
- 无外部服务依赖
- 运行时依赖：Node.js runtime

### 5.3 Assumptions
- 学习者具备 TypeScript/JavaScript 基础知识
- 学习者了解 LLM 和 Agent 的基本概念
- 学习者了解 Anthropic Claude API 的基本概念（tool_use / tool_result）
- 单用户使用场景，无并发问题

## 6. BDD Testability Check

| Dimension | Verification Question | Status |
|-----------|----------------------|--------|
| Input/Output format | TodoWrite 输入（todos 数组结构）和输出（ToolResult 格式）已完整定义；TodoRead 输入（无参数）和输出已定义 | Pass |
| Error & exception scenarios | TodoWrite 的 5 种校验错误、工具不存在错误已逐一列出，错误消息格式明确 | Pass |
| Boundary & priority rules | 空数组行为已明确（清空任务）；content/activeForm 最小长度（1 字符）已定义；校验顺序（遇首个错误即返回）已定义 | Pass |
| State behavior | 整体替换原子性、校验失败不修改 store、只读操作不修改状态已明确 | Pass |
| Verifiable granularity | 每条校验规则可独立测试；每个工具行为可独立验证 | Pass |
| Ambiguity check | 空数组行为、校验顺序、content trim 规则、tool_use_id 关联规则均已明确 | Pass |

## 7. Glossary
| Term | Definition |
|------|-----------|
| Agent Loop | AI Agent 的核心执行循环：LLM 推理 → 工具调用 → 结果反馈 → 继续推理 |
| tool_use | Anthropic API 中 LLM 发出的工具调用请求，包含 tool_use_id、name、input |
| tool_result | Anthropic API 中返回给 LLM 的工具执行结果，包含 tool_use_id、content、is_error |
| tool_use_id | 唯一标识符，用于关联工具调用请求和结果 |
| input_schema | Anthropic API 中工具定义的输入参数 JSON Schema（snake_case 命名） |
| TodoWrite | Claude Code 的任务写入工具，采用整体替换模式 |
| TodoRead | Claude Code 的任务读取工具，返回完整任务列表 |
| ToolRegistry | 工具注册表，统一管理工具的注册、查找和执行 |
| ToolHandler | 异步工具处理函数，接收参数返回执行结果 |
