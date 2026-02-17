# Tool Direct Offload — Product Requirements Document (PRD)

## Document Info
| Field | Value |
|-------|-------|
| Version | v1.0 |
| Created | 2026-02-17 |
| Last Updated | 2026-02-17 |
| Status | Draft |

## 1. Overview

### 1.1 Product/Feature Summary
Tool Direct Offload 是一个 Agent Loop 中间件模块，在工具执行结果返回给 LLM 之前，将过长的 `tool_result` 内容自动卸载到本地文件，并将消息中的原内容替换为文件路径引用。这样可以有效减少传递给 LLM 的上下文长度，避免因单次工具返回结果过大而浪费 token。

### 1.2 Goals
- 减少传递给 LLM 的无效 token 消耗，降低 API 调用成本
- 保留完整的工具返回内容供后续检索和审计
- 提供简洁的中间件接口，易于集成到现有 Agent Loop 中

### 1.3 Non-Goals (explicitly excluded scope)
- 不负责阈值判断（调用方在调用前已完成判断）
- 不负责从文件中读回卸载的内容
- 不管理文件的生命周期（清理、过期等）
- 不处理消息数组级别的批量卸载（仅处理单条消息）

## 2. Users & Scenarios

### 2.1 Target Users
| User Role | Description | Core Need |
|-----------|------------|-----------|
| Agent 开发者 | 构建基于 LLM 的 Agent Loop 的开发者 | 在工具返回结果过长时自动卸载内容，节省 token |

### 2.2 Core User Story
> As an Agent developer, I want tool results exceeding 1000 characters to be automatically offloaded to files, so that my Agent Loop uses fewer tokens while preserving the full tool output.

### 2.3 Use Cases
| ID | Description | Trigger | Expected Outcome |
|----|------------|---------|-----------------|
| UC-001 | 卸载字符串类型的长 tool_result | 调用方判断 tool_result 的 content（string 类型）>= 1000 字符后调用本模块 | 完整内容写入文件，消息中的 content 替换为文件路径提示字符串 |
| UC-002 | 卸载 ContentBlock[] 类型的长 tool_result | 调用方判断 tool_result 的 content（ContentBlock[] 类型）序列化后 >= 1000 字符后调用本模块 | 整个 content 数组 JSON 序列化后写入文件，消息中的 content 替换为文件路径提示字符串 |
| UC-003 | 文件写入失败 | 磁盘空间不足、权限错误等导致写入失败 | 模块抛出异常，由上层 Agent Loop 处理 |

## 3. Functional Requirements

### 3.1 Feature List
| ID | Feature Name | Description | Priority |
|----|-------------|------------|----------|
| F-001 | Tool Result 文件卸载 | 将单条 tool_result 消息的内容写入文件，替换为路径提示 | Must |
| F-002 | 文件路径生成 | 基于 sessionId 和 tool_use_id 生成唯一的文件路径 | Must |
| F-003 | 不可变消息处理 | 不修改原始消息对象，返回新的消息 | Must |
| F-004 | 便捷 API | 提供使用默认 FileWriter 的简化接口 | Should |

### 3.2 Feature Details

#### F-001: Tool Result 文件卸载

**Description**: 接收单条 `tool_result` 类型的消息，将其 `content` 完整写入本地文件，并返回一个新消息，其 `content` 被替换为包含文件路径的提示字符串。

**Input**:
- `message: Message` — 单条消息，`role` 为 tool 相关角色，`content` 包含 `tool_result` 类型的内容块
- `sessionId: string` — 当前 Agent 会话的唯一标识
- `outputDir: string` — 输出文件的根目录
- `writer: FileWriter` — 文件写入器接口实例（依赖注入）

**Output**:
- `OffloadResult` 对象：
  - `message: Message` — 处理后的新消息，`content` 已替换为路径提示
  - `freedChars: number` — 释放的字符数（原内容长度 - 替换后提示字符串长度）
  - `file: string` — 写入的文件绝对路径

**Business Rules**:
1. 当 `content` 为 `string` 类型时，直接将字符串写入文件
2. 当 `content` 为 `ContentBlock[]` 类型时，使用 `JSON.stringify` 将整个数组序列化后写入文件
3. 替换后的提示字符串格式为：`[Tool result offloaded to file: <文件绝对路径>]`
4. 不修改原始 `message` 对象，返回深拷贝后的新消息

**Error & Exception Scenarios**:
| Scenario | Trigger Condition | Expected Behavior |
|----------|------------------|-------------------|
| 文件写入失败 | 磁盘空间不足、权限不足、路径无效 | 抛出异常（Error），包含原始错误信息 |

**Boundary Conditions**:
- 调用方保证传入的消息内容已超过阈值，本模块不做阈值检查
- `tool_use_id` 在同一个 session 中应唯一，若重复则文件会被覆盖

**State Behavior**:
- 本模块无状态，不维护任何内部计数器或缓存
- 每次调用独立，不依赖前次调用的结果

#### F-002: 文件路径生成

**Description**: 基于 sessionId 和 tool_use_id 生成确定性的文件存储路径。

**路径规则**:
- 目录：`<outputDir>/<sessionId>/`
- 文件名：`<tool_use_id>.md`
- 完整路径示例：`.offload/session-abc123/toolu_xyz.md`

**Business Rules**:
1. 目录不存在时自动创建（递归创建）
2. 文件名直接使用 `tool_use_id`，不做额外转换

#### F-003: 不可变消息处理

**Description**: 确保原始输入消息不被修改。

**Business Rules**:
1. 返回的 `message` 是原始消息的深拷贝
2. 原始消息的 `content` 字段在函数调用前后保持不变

#### F-004: 便捷 API

**Description**: 提供一个简化的入口函数，内部使用默认的 `NodeFileWriter` 实现。

**Input**:
- `message: Message` — 单条 tool_result 消息
- `options: { sessionId: string; outputDir: string }` — 配置选项

**Output**:
- `OffloadResult` — 与核心 API 相同的返回类型

## 4. Non-Functional Requirements

### 4.1 Performance Requirements
| Metric | Requirement | Measurement Method |
|--------|------------|-------------------|
| 单次卸载延迟 | < 100ms（不含磁盘 I/O 等待） | 单元测试计时 |

### 4.2 Security Requirements
- 文件写入路径由调用方控制，模块不做路径校验（信任内部调用方）

### 4.3 Usability Requirements
- 提供便捷 API，降低集成复杂度
- 通过依赖注入支持测试 mock

### 4.4 Compatibility Requirements
- Node.js >= 18.0.0
- ESM 模块系统
- 零运行时依赖

## 5. Constraints & Dependencies

### 5.1 Constraints
- 仅使用 Node.js 标准库（`fs/promises`、`path`）
- `core` 层不得直接依赖 `infrastructure` 层（依赖倒置）

### 5.2 External Dependencies
- 无外部依赖

### 5.3 Assumptions
- 调用方在调用前已完成阈值判断（>= 1000 字符）
- `tool_use_id` 在同一 session 内唯一
- 输出目录的上级目录存在且可写

## 6. BDD Testability Check

| Dimension | Verification Question | Status |
|-----------|----------------------|--------|
| Input/Output format | 输入为单条 Message，输出为 OffloadResult，类型和字段均已明确定义 | Pass |
| Error & exception scenarios | 文件写入失败时抛出异常，已明确描述 | Pass |
| Boundary & priority rules | 阈值判断在调用方，tool_use_id 重复时覆盖文件，规则明确 | Pass |
| State behavior | 无状态模块，每次调用独立 | Pass |
| Verifiable granularity | 每个功能点可独立测试 | Pass |
| Ambiguity check | content 的两种类型处理方式已分别定义，替换格式已固定 | Pass |

## 7. Glossary
| Term | Definition |
|------|-----------|
| Tool Result | LLM Agent 调用工具后返回的结果内容 |
| Offload | 将内容从内存/上下文转移到文件存储 |
| Agent Loop | LLM Agent 的执行循环，包含"推理 → 工具调用 → 结果处理"的迭代过程 |
| tool_use_id | Anthropic API 中工具调用的唯一标识符 |
| sessionId | Agent 会话的唯一标识，用于隔离不同会话的卸载文件 |
| FileWriter | 文件写入的抽象接口，用于依赖倒置和测试 mock |
