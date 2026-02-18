# Context Compact — Product Requirements Document (PRD)

## Document Info
| Field | Value |
|-------|-------|
| Version | v1.0 |
| Created | 2026-02-17 |
| Last Updated | 2026-02-17 |
| Status | Draft |

## 1. Overview

### 1.1 Product/Feature Summary

Context Compact 是一个 Agent Loop 上下文压缩模块，当历史消息的 token 总量接近上下文窗口上限时，通过独立 LLM 调用将中间历史消息生成结构化摘要，替换原始消息以释放 token 空间。模块采用"保留头尾、摘要中间"的策略，确保 system prompt 和最新对话上下文完整保留，同时将被压缩的原始消息持久化到本地文件以支持审计和回溯。

### 1.2 Goals
- 使 Agent Loop 能够支持超长会话，避免因 token 超限导致 API 调用失败
- 压缩过程对调用方透明，返回压缩后的消息列表即可无缝继续对话
- 摘要保留关键上下文信息（目标、决策、文件操作、工具调用、任务状态、错误处理），最大程度降低信息损失
- 支持多次压缩，适应任意长度的会话
- 作为独立模块，可与 context-offload、tool-direct-offload 组合使用

### 1.3 Non-Goals (explicitly excluded scope)
- 不负责单条大消息的卸载（由 context-offload / tool-direct-offload 处理）
- 不负责 Agent Loop 的调度逻辑，仅提供压缩能力
- 不负责 token 限额管理或计费
- 不实现流式压缩或增量摘要
- 不修改 system prompt 的内容

## 2. Users & Scenarios

### 2.1 Target Users
| User Role | Description | Core Need |
|-----------|------------|-----------|
| Agent Loop 开发者 | 构建基于 LLM 的 Agent 系统的开发者 | 在超长会话中自动管理上下文 token 用量，防止 API 调用失败 |
| Agent 框架维护者 | 维护 Agent 基础设施的工程师 | 可组合的上下文管理模块，便于集成和测试 |

### 2.2 Core User Story
> As an Agent Loop developer, I want the context to be automatically compacted when it approaches the token limit, so that the agent can continue working on long-running tasks without interruption.

### 2.3 Use Cases
| ID | Description | Trigger | Expected Outcome |
|----|------------|---------|-----------------|
| UC-001 | 长会话自动压缩 | 消息列表 token 总量 ≥ 上下文上限 × 92% | 中间消息被摘要替换，token 总量降至安全范围，对话无缝继续 |
| UC-002 | 多次压缩 | 压缩后继续对话，token 再次逼近阈值 | 再次触发压缩，前次摘要也参与压缩，生成更浓缩的摘要 |
| UC-003 | 压缩前检测 | 调用方仅想判断是否需要压缩 | 返回布尔值，不执行实际压缩 |
| UC-004 | 与 offload 组合使用 | 先 offload 大型 tool_result，再检测是否仍需 compact | offload 后 token 仍超阈值则触发 compact |
| UC-005 | 压缩失败容错 | LLM 摘要调用失败 | 重试后仍失败则跳过本次压缩，返回原始消息列表 |

## 3. Functional Requirements

### 3.1 Feature List
| ID | Feature Name | Description | Priority |
|----|-------------|------------|----------|
| F-001 | Token 计数 | 使用分词库精确计算消息列表的 token 总量 | Must |
| F-002 | 压缩触发判断 | 判断当前 token 用量是否超过阈值 | Must |
| F-003 | 消息分区 | 将消息列表划分为 Head / Middle / Tail 三个区域 | Must |
| F-004 | 摘要生成 | 通过独立 LLM 调用将 Middle 区域消息生成结构化摘要 | Must |
| F-005 | 消息组装 | 将 Head + 摘要消息 + Tail 组装为新的消息列表 | Must |
| F-006 | 原始消息持久化 | 压缩前将被压缩的原始消息保存到本地文件 | Must |
| F-007 | 容错与重试 | LLM 调用失败时重试，重试仍失败则跳过 | Must |
| F-008 | 统计信息 | 返回压缩前后的 token 数、压缩比、被压缩消息数等统计 | Should |

### 3.2 Feature Details

#### F-001: Token 计数

**Description**: 使用第三方分词库精确计算消息列表中所有消息的 token 总量。

**Input**:
- `messages: Message[]` — 消息列表，每条消息包含 `role`（`"system" | "user" | "assistant"`）和 `content`（`string | ContentBlock[]`）

**Output**:
- `number` — 消息列表的 token 总量

**Business Rules**:
1. 遍历所有消息的 content，将 ContentBlock 序列化为文本后计算 token 数
2. ContentBlock 类型包括 TextBlock、ToolUseBlock、ToolResultBlock
3. ToolUseBlock 的 input（JSON 对象）需序列化为字符串后计算
4. ToolResultBlock 的 content（string 或 ContentBlock[]）递归计算

**Error & Exception Scenarios**:
| Scenario | Trigger Condition | Expected Behavior |
|----------|------------------|-------------------|
| 空消息列表 | `messages` 为空数组 | 返回 0 |
| 未知 ContentBlock 类型 | content 中包含未识别的 block 类型 | 跳过该 block，记录警告日志 |

**Boundary Conditions**:
- 空字符串 content 返回 0 token
- 单条超大消息（如 100K+ token）正常计算，不做特殊处理

**State Behavior**:
- 纯函数，无状态，无副作用

---

#### F-002: 压缩触发判断

**Description**: 判断当前消息列表的 token 总量是否达到压缩阈值。

**Input**:
- `messages: Message[]` — 消息列表
- `options?: CompactOptions` — 可选配置（包含 token 上限和阈值比例）

**Output**:
- `boolean` — `true` 表示需要压缩，`false` 表示不需要

**Business Rules**:
1. 计算 token 总量
2. 阈值 = `CONTEXT_TOKEN_LIMIT × COMPACT_THRESHOLD_RATIO`
3. 当 token 总量 ≥ 阈值时返回 `true`

**Error & Exception Scenarios**:
| Scenario | Trigger Condition | Expected Behavior |
|----------|------------------|-------------------|
| 空消息列表 | `messages` 为空数组 | 返回 `false` |

**Boundary Conditions**:
- token 总量恰好等于阈值时，返回 `true`（≥ 语义）

**State Behavior**:
- 纯函数，无状态，无副作用

---

#### F-003: 消息分区

**Description**: 将消息列表划分为 Head（system prompt）、Middle（压缩目标）、Tail（保留尾部）三个区域。

**Input**:
- `messages: Message[]` — 消息列表
- `tailRetentionTokens: number` — 尾部保留的 token 预算

**Output**:
- `{ head: Message[], middle: Message[], tail: Message[] }`

**Business Rules**:
1. Head：消息列表开头连续的 `role: "system"` 消息
2. Tail：从消息列表末尾向前扫描，逐条累加 token 数，直到累计 token ≥ `tailRetentionTokens` 时停止，被扫描到的消息为 Tail
3. Middle：Head 和 Tail 之间的所有消息
4. 尾部保留 token 预算 = `CONTEXT_TOKEN_LIMIT × TAIL_RETENTION_RATIO`

**Error & Exception Scenarios**:
| Scenario | Trigger Condition | Expected Behavior |
|----------|------------------|-------------------|
| 无 system 消息 | 消息列表不以 system 角色开头 | Head 为空数组，所有消息归入 Middle 和 Tail |
| 无 Middle 区域 | Head + Tail 已覆盖全部消息 | Middle 为空数组 |

**Boundary Conditions**:
- 只有一条消息时：该消息归入 Tail，Head 和 Middle 为空
- Tail 扫描时，最后纳入的那条消息即使使累计 token 超过预算，也完整保留（不截断消息）

**State Behavior**:
- 纯函数，无状态，无副作用

---

#### F-004: 摘要生成

**Description**: 将 Middle 区域的消息通过独立 LLM 调用生成结构化摘要。

**Input**:
- `middleMessages: Message[]` — 需要被压缩的消息列表
- `model: string` — 用于摘要的模型名称

**Output**:
- `string` — 生成的摘要文本

**Business Rules**:
1. 将 Middle 消息序列化为可读文本格式，作为 LLM 输入
2. Prompt 要求 LLM 保留以下维度的信息：
   - 对话目标和关键决策
   - 文件操作记录（读取、创建、修改、删除）
   - 工具调用摘要（名称、关键结果、成功/失败）
   - 当前任务状态（进度、待完成项）
   - 错误和解决方案
3. 摘要输出为结构化纯文本

**Error & Exception Scenarios**:
| Scenario | Trigger Condition | Expected Behavior |
|----------|------------------|-------------------|
| LLM 调用失败 | 网络错误、API 限流、超时等 | 抛出错误，由上层 F-007 处理重试 |
| LLM 返回空内容 | 模型返回空字符串 | 视为调用失败，抛出错误 |

**Boundary Conditions**:
- Middle 消息为空时不应调用此函数（由上层逻辑保证）

**State Behavior**:
- 无状态，每次调用独立

---

#### F-005: 消息组装

**Description**: 将 Head、摘要消息、Tail 组装为新的消息列表。

**Input**:
- `head: Message[]` — 头部消息（system prompt）
- `summary: string` — 摘要文本
- `tail: Message[]` — 尾部保留消息

**Output**:
- `Message[]` — 组装后的新消息列表

**Business Rules**:
1. 摘要消息的格式：`{ role: "user", content: summary }`
2. 组装顺序：`[...head, summaryMessage, ...tail]`
3. 返回新数组，不修改输入参数（不可变性）

**Error & Exception Scenarios**:
| Scenario | Trigger Condition | Expected Behavior |
|----------|------------------|-------------------|
| 空摘要 | summary 为空字符串 | 不应发生，由上层保证；若发生则记录警告，仍然组装 |

**Boundary Conditions**:
- Head 为空时，摘要消息为列表第一条
- Tail 为空时（极端情况），列表仅包含 head + 摘要消息

**State Behavior**:
- 纯函数，无状态，不可变

---

#### F-006: 原始消息持久化

**Description**: 压缩前将被压缩的 Middle 区域原始消息保存到本地 JSON 文件。

**Input**:
- `middleMessages: Message[]` — 被压缩的原始消息
- `outputDir: string` — 输出目录
- `sessionId: string` — 会话标识

**Output**:
- `string` — 持久化文件的完整路径

**Business Rules**:
1. 文件路径格式：`<outputDir>/<sessionId>/compact-<timestamp>-<sequence>.json`
2. `timestamp` 为 ISO 8601 格式（精确到秒），用于排序
3. `sequence` 为自增序号（从 1 开始），标识同一会话中的第几次压缩
4. 文件内容为 `middleMessages` 的 JSON 序列化（带缩进，便于阅读）
5. 自动创建不存在的父目录

**Error & Exception Scenarios**:
| Scenario | Trigger Condition | Expected Behavior |
|----------|------------------|-------------------|
| 文件写入失败 | 磁盘满、权限不足等 | 记录错误日志，但不阻塞压缩流程（持久化失败不影响压缩结果） |

**Boundary Conditions**:
- 同一秒内多次压缩通过 sequence 区分

**State Behavior**:
- 有副作用（文件 IO），但不影响消息处理逻辑

---

#### F-007: 容错与重试

**Description**: LLM 摘要调用失败时的重试和降级策略。

**Input**:
- 由 F-004 触发

**Output**:
- 摘要文本（成功时）或跳过压缩（失败时）

**Business Rules**:
1. LLM 调用失败时，最多重试 `COMPACT_MAX_RETRIES` 次（默认 2 次）
2. 重试间隔可采用简单退避策略
3. 所有重试均失败后，跳过本次压缩，返回原始消息列表
4. `CompactResult.compacted` 设为 `false`，表示未执行压缩
5. 所有失败和重试记录日志

**Error & Exception Scenarios**:
| Scenario | Trigger Condition | Expected Behavior |
|----------|------------------|-------------------|
| 全部重试失败 | 连续 N+1 次 LLM 调用失败 | 跳过压缩，返回原始消息列表，`compacted = false` |

**Boundary Conditions**:
- `COMPACT_MAX_RETRIES = 0` 时不重试，失败即跳过

**State Behavior**:
- 重试计数为函数内部局部状态，不跨调用持久化

---

#### F-008: 统计信息

**Description**: 返回压缩相关的统计数据。

**Input**:
- 由压缩流程内部收集

**Output**:
- `CompactStats` 对象

**Business Rules**:
1. 统计字段包括：
   - `originalTokenCount: number` — 压缩前 token 总量
   - `compactedTokenCount: number` — 压缩后 token 总量
   - `compactionRatio: number` — 压缩比（compactedTokenCount / originalTokenCount）
   - `compactedMessageCount: number` — 被压缩的消息数量（Middle 区域消息数）
   - `retainedMessageCount: number` — 保留的消息数量（Head + Tail）

**Error & Exception Scenarios**:
- 无额外错误场景

**Boundary Conditions**:
- 未执行压缩时，统计字段全部为 0 或 null

**State Behavior**:
- 纯数据对象，无状态

## 4. Non-Functional Requirements

### 4.1 Performance Requirements
| Metric | Requirement | Measurement Method |
|--------|------------|-------------------|
| Token 计数延迟 | 200K token 的消息列表计数 < 500ms | 单元测试计时 |
| 压缩总延迟 | 单次压缩（含 LLM 调用）< 30s | 集成测试计时（取决于 LLM 响应速度） |
| 内存占用 | 压缩过程中内存峰值不超过原始消息大小的 2 倍 | 内存 profiling |

### 4.2 Security Requirements
- 持久化的原始消息文件不应包含额外敏感信息（仅原始消息的忠实序列化）
- LLM 调用使用调用方提供的 API 凭证，模块本身不存储凭证

### 4.3 Usability Requirements
- 对外 API 简洁，核心场景只需调用 `compactMessages()` 一个函数
- 所有配置参数有合理默认值，零配置即可使用
- 返回值包含足够信息供调用方决策（是否压缩了、压缩了多少）

### 4.4 Compatibility Requirements
- Node.js >= 18
- TypeScript >= 5.0
- 与 context-offload、tool-direct-offload 模块的 Message 类型兼容（结构相似但独立定义）

## 5. Constraints & Dependencies

### 5.1 Constraints
- 压缩是有损操作，摘要不可能完全保留原始信息
- LLM 摘要质量取决于所用模型的能力
- 分词库的 token 计数与 Anthropic API 实际计数可能存在微小差异

### 5.2 External Dependencies
- 第三方分词库（如 `@anthropic-ai/tokenizer` 或兼容替代）
- Anthropic API（或兼容的 LLM API）用于摘要生成
- Node.js fs 模块用于文件持久化

### 5.3 Assumptions
- 调用方负责在 Agent Loop 中正确的时机调用 compact（每轮请求前）
- 调用方负责提供有效的 LLM API 凭证和配置
- 消息列表中的第一条（如有）system 消息即为 system prompt

## 6. BDD Testability Check

| Dimension | Verification Question | Status |
|-----------|----------------------|--------|
| Input/Output format | 所有输入输出的数据类型、结构已明确定义（Message, CompactResult, CompactOptions, CompactStats） | Pass |
| Error & exception scenarios | LLM 失败重试→跳过、空消息列表、无 Middle 区域、文件写入失败等场景均已定义 | Pass |
| Boundary & priority rules | 阈值边界（≥ 语义）、Tail 扫描溢出规则、无 Middle 时跳过等已定义 | Pass |
| State behavior | 核心函数均为纯函数/无状态；文件 IO 副作用已隔离；重试为局部状态 | Pass |
| Verifiable granularity | 每个 Feature 可独立测试，API 粒度清晰 | Pass |
| Ambiguity check | Message 类型独立定义、system 消息判定规则、持久化文件命名规则均已明确 | Pass |

## 7. Glossary
| Term | Definition |
|------|-----------|
| Agent Loop | 基于 LLM 的智能体循环执行框架，每轮包含用户输入、模型推理、工具调用等步骤 |
| Compact / Compaction | 上下文压缩，将历史消息通过摘要替换以减少 token 用量 |
| Head | 消息列表头部的 system prompt 消息，始终保留 |
| Middle | Head 和 Tail 之间的消息，为压缩目标区域 |
| Tail | 消息列表尾部的最新消息，根据 token 预算保留 |
| Token | LLM 处理文本的基本单位，一个 token 大约对应 4 个英文字符或 1-2 个中文字符 |
| Offload | 上下文卸载，将大型内容写入外部文件并在消息中替换为引用路径 |
| ContentBlock | 消息内容块，可以是 TextBlock、ToolUseBlock 或 ToolResultBlock |
