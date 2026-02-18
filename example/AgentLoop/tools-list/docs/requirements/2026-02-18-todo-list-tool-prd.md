# Todo-List Tool 教学示例 — Product Requirements Document (PRD)

## Document Info
| Field | Value |
|-------|-------|
| Version | v1.0 |
| Created | 2026-02-18 |
| Last Updated | 2026-02-18 |
| Status | Draft |

## 1. Overview

### 1.1 Product/Feature Summary
一个面向 AI Agent 开发学习者的 todo-list 工具教学示例。通过构建一个包含完整 CRUD 操作和状态管理的 todo-list 工具，展示 agent loop 中工具的核心机制：Schema 定义、注册、LLM 调用、状态管理和结果返回。代码精简，注重教学可读性。

### 1.2 Goals
- 帮助学习者理解 agent loop 中工具的完整生命周期（定义 → 注册 → 调用 → 状态管理 → 结果返回）
- 提供一个可独立运行、可测试的完整教学示例
- 代码量控制在 500 行以内，保持简洁可读

### 1.3 Non-Goals (explicitly excluded scope)
- 不包含持久化存储（文件/数据库）
- 不包含 UI 界面
- 不包含用户认证/授权
- 不包含任务优先级、标签、分类功能
- 不追求生产级健壮性和性能

## 2. Users & Scenarios

### 2.1 Target Users
| User Role | Description | Core Need |
|-----------|------------|-----------|
| AI Agent 开发学习者 | 希望理解 agent loop 工具机制的开发者 | 通过教学示例学习工具的定义、注册、调用和状态管理 |
| 教学内容制作者 | 制作 AI Agent 开发教程的人 | 获得一个可直接使用的教学代码示例 |

### 2.2 Core User Story
> As a AI Agent 开发学习者，I want 一个完整的 todo-list 工具教学示例，so that 我能理解 agent loop 中工具注册、调用、状态管理和协作的完整机制。

### 2.3 Use Cases
| ID | Description | Trigger | Expected Outcome |
|----|------------|---------|-----------------|
| UC-001 | 创建一个新任务 | LLM 调用 create_todo 工具，传入标题和可选描述 | 系统返回新创建的任务对象（含自动生成的 ID、时间戳、默认状态） |
| UC-002 | 查看所有任务列表 | LLM 调用 list_todos 工具 | 系统返回所有任务的摘要列表 |
| UC-003 | 查看单个任务详情 | LLM 调用 get_todo 工具，传入任务 ID | 系统返回该任务的完整信息 |
| UC-004 | 更新任务信息 | LLM 调用 update_todo 工具，传入任务 ID 和需要更新的字段 | 系统更新指定字段并返回更新后的任务对象 |
| UC-005 | 删除一个任务 | LLM 调用 delete_todo 工具，传入任务 ID | 系统删除该任务并返回确认信息 |
| UC-006 | 变更任务状态 | LLM 调用 update_todo 工具，传入任务 ID 和新状态 | 系统验证状态转换合法性，更新状态并返回结果 |

## 3. Functional Requirements

### 3.1 Feature List
| ID | Feature Name | Description | Priority |
|----|-------------|------------|----------|
| F-001 | 创建任务 | 创建包含标题和可选描述的 todo 任务 | Must |
| F-002 | 查询任务列表 | 查询所有任务，返回摘要列表 | Must |
| F-003 | 查询单个任务 | 按 ID 查询任务完整详情 | Must |
| F-004 | 更新任务 | 修改任务的标题、描述和/或状态 | Must |
| F-005 | 删除任务 | 按 ID 删除任务 | Must |
| F-006 | 任务状态管理 | 管理 pending/in_progress/completed 三种状态的流转 | Must |
| F-007 | 工具 Schema 定义 | 为每个工具操作提供完整的 JSON Schema | Must |
| F-008 | 工具注册机制 | 提供统一的工具注册接口 | Must |
| F-009 | 结构化结果返回 | 工具调用返回统一的成功/失败结构 | Must |

### 3.2 Feature Details

#### F-001: 创建任务
**Description**: 创建一个新的 todo 任务，系统自动生成唯一 ID 和创建时间戳。

**Input**:
- `title`: string（必填）— 任务标题，1-200 字符
- `description`: string（可选）— 任务描述，0-1000 字符，默认为空字符串

**Output**:
- 成功时返回创建的任务对象：
  ```
  {
    id: string,          // 自动生成的唯一 ID（UUID v4 格式）
    title: string,
    description: string,
    status: "pending",   // 新创建任务固定为 pending
    createdAt: string,   // ISO 8601 格式时间戳
    updatedAt: string    // ISO 8601 格式时间戳，初始等于 createdAt
  }
  ```

**Business Rules**:
1. 每个新任务的初始状态固定为 `pending`
2. ID 由系统自动生成，使用 UUID v4 格式保证唯一性
3. `createdAt` 和 `updatedAt` 由系统自动设置为当前时间

**Error & Exception Scenarios**:
| Scenario | Trigger Condition | Expected Behavior |
|----------|------------------|-------------------|
| 标题为空 | title 为空字符串或仅包含空白字符 | 返回错误：`"Title is required and cannot be empty"` |
| 标题超长 | title 超过 200 字符 | 返回错误：`"Title must not exceed 200 characters"` |
| 描述超长 | description 超过 1000 字符 | 返回错误：`"Description must not exceed 1000 characters"` |

**Boundary Conditions**:
- title 恰好 1 个字符：允许
- title 恰好 200 个字符：允许
- description 恰好 1000 个字符：允许
- description 未提供：使用默认空字符串

**State Behavior**:
- 新任务创建后立即存入内存存储
- 任务创建是原子操作，不存在部分创建的中间状态

---

#### F-002: 查询任务列表
**Description**: 查询所有存储在内存中的 todo 任务，返回摘要列表。

**Input**:
- 无必填参数

**Output**:
- 返回任务摘要数组：
  ```
  {
    todos: [
      { id: string, title: string, status: string, createdAt: string }
    ],
    total: number  // 任务总数
  }
  ```

**Business Rules**:
1. 返回所有任务，按创建时间倒序排列（最新的在前）
2. 摘要信息仅包含 id、title、status、createdAt，不含 description
3. 空列表时返回空数组和 total: 0

**Error & Exception Scenarios**:
| Scenario | Trigger Condition | Expected Behavior |
|----------|------------------|-------------------|
| 无任务 | 内存中没有任何任务 | 返回 `{ todos: [], total: 0 }` |

**Boundary Conditions**:
- 无任务时返回空数组（不是错误）

**State Behavior**:
- 只读操作，不修改任何状态

---

#### F-003: 查询单个任务
**Description**: 按 ID 查询单个任务的完整详细信息。

**Input**:
- `id`: string（必填）— 任务 ID

**Output**:
- 成功时返回完整任务对象：
  ```
  {
    id: string,
    title: string,
    description: string,
    status: string,
    createdAt: string,
    updatedAt: string
  }
  ```

**Business Rules**:
1. 返回任务的所有字段信息

**Error & Exception Scenarios**:
| Scenario | Trigger Condition | Expected Behavior |
|----------|------------------|-------------------|
| 任务不存在 | 提供的 ID 在内存中找不到对应任务 | 返回错误：`"Todo with id '{id}' not found"` |

**Boundary Conditions**:
- ID 格式不匹配任何已存在任务时，视为"任务不存在"

**State Behavior**:
- 只读操作，不修改任何状态

---

#### F-004: 更新任务
**Description**: 修改已存在任务的标题、描述和/或状态。支持部分更新（只更新传入的字段）。

**Input**:
- `id`: string（必填）— 任务 ID
- `title`: string（可选）— 新标题，1-200 字符
- `description`: string（可选）— 新描述，0-1000 字符
- `status`: string（可选）— 新状态，枚举值：`"pending"` | `"in_progress"` | `"completed"`

**Output**:
- 成功时返回更新后的完整任务对象

**Business Rules**:
1. 至少提供一个可选字段（title/description/status），否则报错
2. 仅更新传入的字段，未传入的字段保持不变
3. 更新成功后自动刷新 `updatedAt` 时间戳
4. 状态转换规则：
   - `pending` → `in_progress`：允许
   - `pending` → `completed`：允许
   - `in_progress` → `completed`：允许
   - `in_progress` → `pending`：允许
   - `completed` → `pending`：允许（重新开启）
   - `completed` → `in_progress`：允许（重新开启）
   - 注：所有状态之间均可自由转换，不做严格限制，保持教学简洁性

**Error & Exception Scenarios**:
| Scenario | Trigger Condition | Expected Behavior |
|----------|------------------|-------------------|
| 任务不存在 | 提供的 ID 找不到对应任务 | 返回错误：`"Todo with id '{id}' not found"` |
| 无更新字段 | 未提供任何可选字段 | 返回错误：`"At least one field (title, description, status) must be provided"` |
| 标题为空 | title 为空字符串或仅空白字符 | 返回错误：`"Title is required and cannot be empty"` |
| 标题超长 | title 超过 200 字符 | 返回错误：`"Title must not exceed 200 characters"` |
| 描述超长 | description 超过 1000 字符 | 返回错误：`"Description must not exceed 1000 characters"` |
| 无效状态值 | status 不是三个合法枚举值之一 | 返回错误：`"Invalid status '{status}'. Must be one of: pending, in_progress, completed"` |

**Boundary Conditions**:
- 仅传入 status 不传入其他字段：允许，仅更新状态
- 传入与当前值相同的字段：允许，updatedAt 仍会刷新

**State Behavior**:
- 更新是原子操作
- updatedAt 在任何成功更新后都会刷新

---

#### F-005: 删除任务
**Description**: 按 ID 从内存中永久删除一个任务。

**Input**:
- `id`: string（必填）— 任务 ID

**Output**:
- 成功时返回确认信息：
  ```
  { message: "Todo '{id}' deleted successfully" }
  ```

**Business Rules**:
1. 删除操作是永久的（从内存中移除）
2. 任何状态的任务都可以被删除

**Error & Exception Scenarios**:
| Scenario | Trigger Condition | Expected Behavior |
|----------|------------------|-------------------|
| 任务不存在 | 提供的 ID 找不到对应任务 | 返回错误：`"Todo with id '{id}' not found"` |

**Boundary Conditions**:
- 删除后再次查询该 ID：返回"任务不存在"
- 删除后列表中不再包含该任务

**State Behavior**:
- 删除是原子操作
- 删除后任务立即从内存存储中移除

---

#### F-006: 任务状态管理
**Description**: 管理任务的三种状态及其流转。

**状态定义**:
| Status | Description |
|--------|------------|
| `pending` | 待办状态，任务已创建但未开始 |
| `in_progress` | 进行中，任务正在处理 |
| `completed` | 已完成，任务已结束 |

**状态转换规则**:
- 所有状态之间可自由转换（简化设计，聚焦教学）
- 新建任务的初始状态固定为 `pending`

---

#### F-007: 工具 Schema 定义
**Description**: 为每个工具操作提供符合 JSON Schema 规范的定义。

**每个工具 Schema 包含**:
- `name`: string — 工具名称（如 `create_todo`）
- `description`: string — 工具功能描述（供 LLM 理解调用时机）
- `inputSchema`: object — 输入参数的 JSON Schema，包含：
  - 参数名称和类型
  - 必填/可选标识
  - 参数描述
  - 值约束（最大长度、枚举值等）

**工具清单**:
| Tool Name | Description |
|-----------|------------|
| `create_todo` | 创建一个新的 todo 任务 |
| `list_todos` | 查询所有 todo 任务列表 |
| `get_todo` | 按 ID 查询单个 todo 任务详情 |
| `update_todo` | 更新一个已存在的 todo 任务 |
| `delete_todo` | 删除一个 todo 任务 |

---

#### F-008: 工具注册机制
**Description**: 提供统一的工具注册接口，将所有工具 Schema 和对应的处理函数注册到 agent loop 中。

**注册信息**:
- 工具定义（Schema）：包含名称、描述、输入参数 Schema
- 工具处理函数（Handler）：接收参数、执行操作、返回结果

**注册方式**:
- 通过统一的工具注册表（ToolRegistry）注册
- 支持按名称查找已注册的工具
- 支持获取所有已注册工具的 Schema 列表（用于发送给 LLM）

---

#### F-009: 结构化结果返回
**Description**: 所有工具调用返回统一的结构化结果格式。

**成功响应格式**:
```
{
  success: true,
  data: <具体业务数据>
}
```

**失败响应格式**:
```
{
  success: false,
  error: "<错误描述信息>"
}
```

**规则**:
1. 所有工具统一使用此格式返回结果
2. 不抛出异常，通过 success: false 传递错误信息
3. error 字段使用英文描述

## 4. Non-Functional Requirements

### 4.1 Performance Requirements
| Metric | Requirement | Measurement Method |
|--------|------------|-------------------|
| 代码量 | 源代码 < 500 行（不含测试） | wc -l 统计 |
| 概念覆盖 | 覆盖 5 个核心教学概念 | 清单检查：定义、注册、调用、状态管理、结果返回 |

### 4.2 Security Requirements
- 作为教学示例，无特殊安全要求
- 输入验证用于展示工具参数校验模式，非安全防护目的

### 4.3 Usability Requirements
- 代码结构清晰，关键逻辑有教学注释
- 可通过 `npm install && npm test` 一键运行测试

### 4.4 Compatibility Requirements
- Node.js >= 18
- TypeScript 支持

## 5. Constraints & Dependencies

### 5.1 Constraints
- 仅使用内存存储，会话结束数据消失
- 代码总量控制在 500 行以内
- 作为教学示例，优先简洁可读而非功能完备

### 5.2 External Dependencies
- 无外部服务依赖
- 运行时依赖：Node.js runtime

### 5.3 Assumptions
- 学习者具备 TypeScript/JavaScript 基础知识
- 学习者了解 LLM 和 Agent 的基本概念
- 单用户使用场景，无并发问题

## 6. BDD Testability Check

| Dimension | Verification Question | Status |
|-----------|----------------------|--------|
| Input/Output format | 所有工具的输入参数类型、格式、约束已明确定义；输出结构统一为 `{success, data/error}` | Pass |
| Error & exception scenarios | 每个工具的错误场景已逐一列出（空标题、超长、不存在 ID、无效状态等） | Pass |
| Boundary & priority rules | 边界条件已明确（字符长度边界、空列表、状态转换规则） | Pass |
| State behavior | 状态存储（内存）、初始状态（pending）、更新时间戳刷新规则已明确 | Pass |
| Verifiable granularity | 每个功能点可独立测试，具有明确的输入和预期输出 | Pass |
| Ambiguity check | 状态转换规则明确（所有状态可自由转换）、排序规则明确（创建时间倒序） | Pass |

## 7. Glossary
| Term | Definition |
|------|-----------|
| Agent Loop | AI Agent 的核心执行循环，包含 LLM 推理 → 工具调用 → 结果反馈 → 继续推理的循环过程 |
| Tool / 工具 | Agent 可调用的外部功能单元，包含 Schema 定义和执行逻辑 |
| Schema | 工具的接口描述，定义工具名称、参数类型和约束，供 LLM 理解如何调用 |
| Handler | 工具的执行函数，接收参数执行实际操作 |
| CRUD | Create, Read, Update, Delete 四种基本数据操作的缩写 |
| MoSCoW | 需求优先级分类法：Must have, Should have, Could have, Won't have |
