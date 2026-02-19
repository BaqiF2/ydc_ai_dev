# Context Compact v2: Full Compression + File Restoration — Product Requirements Document (PRD)

## Document Info
| Field | Value |
|-------|-------|
| Version | v1.0 |
| Created | 2026-02-19 |
| Last Updated | 2026-02-19 |
| Status | Draft |
| Supersedes | 2026-02-17-context-compact-prd.md (F-003, F-004, F-005, F-006, F-009) |

## 1. Overview

### 1.1 Product/Feature Summary

对 Context Compact 模块的压缩策略进行重大升级：从"保留头尾、摘要中间"改为"全量压缩 + 文件恢复"策略。新策略将 Head（system prompt）之后的所有消息全部压缩为结构化摘要，不再保留尾部消息。同时新增文件恢复机制，压缩前扫描历史消息中的 `read_file` 工具调用，将最近读取的文件内容从磁盘重新注入到压缩后的上下文中，确保 Agent 压缩后仍能访问关键文件内容。

### 1.2 Goals
- 最大化压缩效率，通过全量压缩释放更多 token 空间
- 通过文件恢复机制弥补全量压缩带来的信息损失，确保 Agent 能继续基于文件内容工作
- 调整摘要 Prompt，强化对最近操作和下一步计划的捕获
- 保持架构一致性，新增的 `FileReader` 接口遵循现有的 core/infrastructure 分层

### 1.3 Non-Goals (explicitly excluded scope)
- 不改变压缩触发判断逻辑（阈值机制不变）
- 不改变原始消息持久化逻辑
- 不改变容错与重试逻辑
- 不恢复 `read_file` 以外的工具调用结果
- 不提供向后兼容层（`tailRetentionRatio` 直接移除）

## 2. Users & Scenarios

### 2.1 Target Users
| User Role | Description | Core Need |
|-----------|------------|-----------|
| Agent Loop 开发者 | 构建基于 LLM 的 Agent 系统的开发者 | 在超长会话中自动管理上下文 token 用量，防止 API 调用失败 |
| Agent 框架维护者 | 维护 Agent 基础设施的工程师 | 可组合的上下文管理模块，便于集成和测试 |

### 2.2 Core User Story
> As an Agent Loop developer, I want all conversation history to be fully compressed into a summary while automatically restoring recently-read file contents, so that the agent can continue working with maximum context space and still access critical files.

### 2.3 Use Cases
| ID | Description | Trigger | Expected Outcome |
|----|------------|---------|-----------------|
| UC-001 | 全量压缩 | 消息列表 token 总量 ≥ 阈值 | Head 后所有消息被摘要替换，最近读取的文件内容从磁盘恢复注入 |
| UC-002 | 无文件读取的压缩 | 对话中未使用 read_file 工具 | 正常压缩，不恢复任何文件，只有 Summary |
| UC-003 | 文件已删除 | read_file 读取的文件在压缩时已不存在 | 跳过该文件，继续恢复其他文件 |
| UC-004 | 文件超 token 限制 | 单个文件超过 maxRestoreTokensPerFile | 跳过该文件，继续恢复其他文件 |
| UC-005 | 多次压缩 | 压缩后继续对话，再次触发压缩 | 前次摘要和恢复的文件消息也参与压缩，生成新摘要并重新恢复最新文件 |
| UC-006 | 压缩失败容错 | LLM 摘要调用全部失败 | 跳过压缩，返回原始消息列表 |

## 3. Functional Requirements

### 3.1 Feature List
| ID | Feature Name | Description | Priority | 变更类型 |
|----|-------------|------------|----------|---------|
| F-001 | Token 计数 | 使用分词库精确计算消息列表的 token 总量 | Must | 不变 |
| F-002 | 压缩触发判断 | 判断当前 token 用量是否超过阈值 | Must | 不变 |
| F-003 | 消息分区 | 将消息列表划分为 Head / Rest 两个区域（移除 Tail） | Must | 修改 |
| F-004 | 摘要生成 | 通过独立 LLM 调用将 Rest 区域消息生成结构化摘要，强化最近操作捕获 | Must | 修改 |
| F-005 | 文件恢复 | 扫描历史中的 read_file 调用，从磁盘恢复最近读取的文件内容 | Must | 新增 |
| F-006 | 消息组装 | 将 Head + Summary pair + Restored file pairs 组装为新消息列表 | Must | 修改 |
| F-007 | 原始消息持久化 | 压缩前将 Rest 原始消息保存到本地文件 | Must | 不变 |
| F-008 | 容错与重试 | LLM 调用失败时重试，重试仍失败则跳过 | Must | 不变 |
| F-009 | 统计信息 | 返回压缩统计，新增恢复文件数和恢复 token 数 | Should | 修改 |

### 3.2 Feature Details

#### F-001: Token 计数（不变）

与 2026-02-17-context-compact-prd.md 中的 F-001 定义一致，无变更。

---

#### F-002: 压缩触发判断（不变）

与 2026-02-17-context-compact-prd.md 中的 F-002 定义一致，无变更。

---

#### F-003: 消息分区（修改）

**Description**: 将消息列表划分为 Head（system prompt）和 Rest（压缩目标）两个区域，移除 Tail 概念。

**Input**:
- `messages: Message[]` — 消息列表

**Output**:
- `{ head: Message[], rest: Message[] }`

**Business Rules**:
1. Head：消息列表开头连续的 `role: "system"` 消息
2. Rest：Head 之后的所有消息（全部压缩为摘要）
3. 移除 `tailRetentionRatio` 参数和 `tailRetentionTokens` 计算

**Error & Exception Scenarios**:
| Scenario | Trigger Condition | Expected Behavior |
|----------|------------------|-------------------|
| 无 system 消息 | 消息列表不以 system 角色开头 | Head 为空数组，所有消息归入 Rest |
| 只有 system 消息 | 所有消息都是 system 角色 | Rest 为空数组，不执行压缩 |

**Boundary Conditions**:
- 空消息列表：Head 和 Rest 均为空数组
- 只有一条非 system 消息：该消息归入 Rest

**State Behavior**:
- 纯函数，无状态，无副作用

---

#### F-004: 摘要生成（修改）

**Description**: 将 Rest 区域的消息通过独立 LLM 调用生成结构化摘要，Prompt 强化对最近操作和下一步计划的捕获。

**Input**:
- `restMessages: Message[]` — 需要被压缩的消息列表
- `model: string` — 用于摘要的模型名称

**Output**:
- `string` — 生成的摘要文本

**Business Rules**:
1. 保留现有 5 个维度（Goals & Decisions, File Operations, Tool Calls, Task Status, Errors & Resolutions）
2. 在 Task Status 维度中新增指令：必须详细描述最近一轮交互中正在进行的操作和下一步计划
3. 新增 Prompt 规则：`"Pay special attention to the MOST RECENT messages — summarize the current task state, what was just done, and what the next logical step should be. This information is critical because the original recent messages will NOT be preserved."`
4. `SUMMARY_MAX_WORDS` 默认值从 800 提升到 1200

**Error & Exception Scenarios**:
| Scenario | Trigger Condition | Expected Behavior |
|----------|------------------|-------------------|
| LLM 调用失败 | 网络错误、API 限流、超时等 | 抛出错误，由上层 F-008 处理重试 |
| LLM 返回空内容 | 模型返回空字符串 | 视为调用失败，抛出错误 |

**Boundary Conditions**:
- Rest 消息为空时不应调用此函数（由上层逻辑保证）

**State Behavior**:
- 无状态，每次调用独立

---

#### F-005: 文件恢复（新增）

**Description**: 压缩前扫描历史消息中的 `read_file` 工具调用，从磁盘读取最近访问的文件内容，构建恢复消息列表。

**Input**:
- `messages: Message[]` — 压缩前的完整消息列表（含 Head 和 Rest）
- `options: { maxRestoreFiles, maxRestoreTokensPerFile, maxRestoreTokensTotal, workDir, fileReader }`

**Output**:
- `Message[]` — 恢复消息列表，每条格式为 `{ role: "user", content: "[Restored after compact] {path}:\n{content}" }`

**Business Rules**:
1. 遍历所有 `role: "assistant"` 消息的 `content` 数组
2. 筛选 `type === "tool_use"` 且 `name === "read_file"` 的块
3. 提取 `input.path`，用 Map 记录 `{ path → 访问顺序 }`（同一文件多次读取保留最后一次的顺序号）
4. 按访问顺序降序排列（最近读取的优先）
5. 取前 `maxRestoreFiles`（默认 5）个路径
6. 对每个路径：
   - 解析为绝对路径（相对于 `workDir`，默认 `process.cwd()`）
   - 安全校验：解析后的路径必须在 `workDir` 内（防止路径穿越）
   - 检查文件是否存在
   - 读取内容
   - 用 `estimateTokens` 估算 token 数
   - 超过 `maxRestoreTokensPerFile`（默认 5000）→ 跳过
   - 累计超过 `maxRestoreTokensTotal`（默认 50000）→ 停止
7. 返回恢复消息数组

**Error & Exception Scenarios**:
| Scenario | Trigger Condition | Expected Behavior |
|----------|------------------|-------------------|
| 无 read_file 调用 | 对话中未使用 read_file 工具 | 返回空数组 |
| 文件不存在 | 磁盘上文件已被删除 | 跳过该文件，记录 warn 日志，继续下一个 |
| 文件读取失败 | 权限不足等 OS 错误 | 跳过该文件，记录 warn 日志，继续下一个 |
| 路径穿越 | 解析后路径不在 workDir 内 | 跳过该文件，记录 warn 日志 |
| 所有文件都超 token 限制 | 每个文件都超过 maxRestoreTokensPerFile | 返回空数组 |

**Boundary Conditions**:
- `maxRestoreFiles = 0` → 不恢复任何文件
- 文件内容为空字符串 → 正常恢复（0 token）
- 同一文件被多次 read_file → 只恢复一次，顺序取最后一次访问的位置

**State Behavior**:
- 无状态，每次调用独立
- 通过 `FileReader` 接口读取磁盘，副作用已通过接口隔离

---

#### F-006: 消息组装（修改）

**Description**: 将 Head、Summary pair、Restored file pairs 组装为新的消息列表。

**Input**:
- `head: Message[]` — 头部消息（system prompt）
- `summary: string` — 摘要文本
- `restoredFiles: Message[]` — 文件恢复消息列表

**Output**:
- `Message[]` — 组装后的新消息列表

**Business Rules**:
1. 组装顺序：
   ```
   [...head]
   + { role: "user", content: "[Conversation compressed]\n\n{summary}" }
   + { role: "assistant", content: "Understood. I have the context from the compressed conversation. Continuing work." }
   + for each restoredFile:
       + restoredFile  (role: "user")
       + { role: "assistant", content: "Noted, file content restored." }
   ```
2. 返回新数组，不修改输入参数（不可变性）
3. user/assistant 严格交替，维持合法的轮次顺序

**Error & Exception Scenarios**:
| Scenario | Trigger Condition | Expected Behavior |
|----------|------------------|-------------------|
| 空摘要 | summary 为空字符串 | 不应发生，由上层保证；若发生则记录警告，仍然组装 |
| 空恢复列表 | 无文件恢复 | 组装结果仅含 Head + Summary pair |

**Boundary Conditions**:
- Head 为空时，Summary pair 为列表第一条
- restoredFiles 为空时，列表仅包含 Head + Summary pair

**State Behavior**:
- 纯函数，无状态，不可变

---

#### F-007: 原始消息持久化（不变）

与 2026-02-17-context-compact-prd.md 中的 F-006 定义一致，无变更。持久化目标从 Middle 改为 Rest（仅术语变更，行为一致）。

---

#### F-008: 容错与重试（不变）

与 2026-02-17-context-compact-prd.md 中的 F-007 定义一致，无变更。

---

#### F-009: 统计信息（修改）

**Description**: 返回压缩相关的统计数据，新增文件恢复指标。

**Output**:
- `CompactStats` 对象

**Business Rules**:
1. 统计字段包括：
   - `originalTokenCount: number` — 压缩前 token 总量
   - `compactedTokenCount: number` — 压缩后 token 总量
   - `compactionRatio: number` — 压缩比（compactedTokenCount / originalTokenCount）
   - `compactedMessageCount: number` — 被压缩的消息数量（Rest 区域消息数）
   - `retainedMessageCount: number` — 保留的消息数量（Head）
   - `restoredFileCount: number` — **新增**：恢复的文件数量
   - `restoredTokenCount: number` — **新增**：恢复文件的总 token 数

**Boundary Conditions**:
- 未执行压缩时，统计字段全部为 0 或 null
- 无文件恢复时，`restoredFileCount = 0`，`restoredTokenCount = 0`

**State Behavior**:
- 纯数据对象，无状态

## 4. Non-Functional Requirements

### 4.1 Performance Requirements
| Metric | Requirement | Measurement Method |
|--------|------------|-------------------|
| Token 计数延迟 | 200K token 的消息列表计数 < 500ms | 单元测试计时 |
| 压缩总延迟 | 单次压缩（含 LLM 调用 + 文件恢复）< 30s | 集成测试计时 |
| 文件恢复延迟 | 5 个文件恢复 < 500ms | 单元测试计时（纯磁盘 IO） |
| 内存占用 | 压缩过程中内存峰值不超过原始消息大小的 2 倍 | 内存 profiling |

### 4.2 Security Requirements
- 文件恢复路径必须经过安全校验，解析后的绝对路径必须在 `workDir` 内（防止路径穿越攻击）
- 持久化的原始消息文件不应包含额外敏感信息（仅原始消息的忠实序列化）
- LLM 调用使用调用方提供的 API 凭证，模块本身不存储凭证

### 4.3 Usability Requirements
- 对外 API 简洁，核心场景只需调用 `compactMessages()` 一个函数
- 所有配置参数有合理默认值，零配置即可使用
- 新增参数（maxRestoreFiles, maxRestoreTokensPerFile, maxRestoreTokensTotal, workDir）全部有合理默认值
- 返回值包含足够信息供调用方决策（是否压缩了、压缩了多少、恢复了多少文件）

### 4.4 Compatibility Requirements
- Node.js >= 18
- TypeScript >= 5.0
- **破坏性变更**：移除 `tailRetentionRatio` 参数，使用该参数的调用方需更新代码
- 与 context-offload、tool-direct-offload 模块的 Message 类型兼容

## 5. Constraints & Dependencies

### 5.1 Constraints
- 压缩是有损操作，摘要不可能完全保留原始信息
- LLM 摘要质量取决于所用模型的能力
- 分词库的 token 计数与 Anthropic API 实际计数可能存在微小差异
- 文件恢复依赖磁盘上文件仍然存在且未被修改，恢复的内容可能与压缩前读取时的版本不同

### 5.2 External Dependencies
- 第三方分词库（如 `@anthropic-ai/tokenizer` 或兼容替代）
- Anthropic API（或兼容的 LLM API）用于摘要生成
- Node.js `fs` 模块用于文件持久化
- Node.js `fs/promises` 模块用于文件读取（通过 `FileReader` 接口抽象）

### 5.3 Assumptions
- 调用方负责在 Agent Loop 中正确的时机调用 compact（每轮请求前）
- 调用方负责提供有效的 LLM API 凭证和配置
- 消息列表中的第一条（如有）system 消息即为 system prompt
- `read_file` 工具的 `input` 对象中文件路径字段名为 `path`

## 6. BDD Testability Check

| Dimension | Verification Question | Status |
|-----------|----------------------|--------|
| Input/Output format | 所有输入输出的数据类型、结构已明确定义（Message, CompactResult, CompactOptions, CompactStats, FileReader） | Pass |
| Error & exception scenarios | 文件不存在→跳过、读取失败→跳过、路径穿越→跳过、LLM 失败→重试→跳过、所有文件超限→空恢复 | Pass |
| Boundary & priority rules | 文件按访问顺序降序优先、三层 token 限制、maxRestoreFiles=0 不恢复、同文件取最后访问 | Pass |
| State behavior | 核心函数均为纯函数/无状态；文件 IO 通过 FileReader 接口隔离 | Pass |
| Verifiable granularity | 分区、文件扫描、恢复、组装可独立测试 | Pass |
| Ambiguity check | read_file 的 input.path 字段名已明确、路径归一化规则已明确、轮次交替规则已明确 | Pass |

## 7. Glossary
| Term | Definition |
|------|-----------|
| Agent Loop | 基于 LLM 的智能体循环执行框架，每轮包含用户输入、模型推理、工具调用等步骤 |
| Compact / Compaction | 上下文压缩，将历史消息通过摘要替换以减少 token 用量 |
| Head | 消息列表头部的 system prompt 消息，始终保留 |
| Rest | Head 之后的所有消息，为全量压缩目标区域（替代原有的 Middle + Tail 划分） |
| File Restoration | 文件恢复机制，压缩后从磁盘重新读取最近访问的文件内容并注入上下文 |
| FileReader | 文件读取接口，core 层定义、infrastructure 层实现，用于从磁盘读取文件内容 |
| Path Traversal | 路径穿越攻击，通过 `../` 等方式访问 workDir 之外的文件，本模块需防护 |
| Token | LLM 处理文本的基本单位，一个 token 大约对应 4 个英文字符或 1-2 个中文字符 |
| Offload | 上下文卸载，将大型内容写入外部文件并在消息中替换为引用路径 |
| ContentBlock | 消息内容块，可以是 TextBlock、ToolUseBlock 或 ToolResultBlock |
| ~~Tail~~ | 已废弃，不再使用 |
| ~~Middle~~ | 已废弃，由 Rest 替代 |
