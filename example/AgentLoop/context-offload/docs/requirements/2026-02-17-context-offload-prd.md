# Agent 上下文卸载模块 — Product Requirements Document (PRD)

## Document Info
| Field | Value |
|-------|-------|
| Version | v1.0 |
| Created | 2026-02-17 |
| Last Updated | 2026-02-17 |
| Status | Draft |

## 1. Overview

### 1.1 Product/Feature Summary
实现 Agent Loop 中的上下文卸载（Context Offloading）方法。当 Agent 对话上下文接近 token 上限时，该方法将历史消息中工具调用返回（tool_result）的大段内容写入文件，并在消息中替换为文件路径引用，从而释放上下文空间。本模块采用 Anthropic 风格的消息结构，作为学习/实验用途的独立模块实现。

### 1.2 Goals
- 提供一个可复用的 `offloadToolResults` 方法，自动将符合条件的 tool_result 内容卸载到文件
- 卸载后返回新的消息列表，原消息中的大段 tool_result 被替换为文件路径引用
- 支持字符数阈值过滤：仅卸载字符数 ≥ 100 的 tool_result

### 1.3 Non-Goals (explicitly excluded scope)
- 不实现完整的 Agent Loop
- 不实现 token 计算或上下文长度判断逻辑（由调用方判断何时触发卸载）
- 不实现卸载文件的回加载（reload）功能
- 不实现摘要生成（卸载后仅使用文件路径引用，不生成内容摘要）

## 2. Users & Scenarios

### 2.1 Target Users
| User Role | Description | Core Need |
|-----------|------------|-----------|
| Agent 开发者 | 学习/实验 Agent 上下文管理机制的开发者 | 理解并实践上下文卸载的实现方式 |

### 2.2 Core User Story
> As an Agent developer, I want to offload large tool_result content from conversation history to files, so that the context window is freed up while preserving a reference to the original content.

### 2.3 Use Cases
| ID | Description | Trigger | Expected Outcome |
|----|------------|---------|-----------------|
| UC-001 | 卸载大段 tool_result | 调用 offloadToolResults，消息中包含字符数 ≥ 100 的 tool_result | tool_result 内容写入文件，消息中替换为文件路径引用 |
| UC-002 | 跳过小段 tool_result | 调用 offloadToolResults，消息中包含字符数 < 100 的 tool_result | tool_result 保持不变，不写入文件 |
| UC-003 | 混合场景 | 消息数组中同时包含大段和小段 tool_result | 仅大段被卸载，小段保持不变 |
| UC-004 | 无 tool_result | 消息数组中没有任何 tool_result | 消息原样返回，不写入任何文件 |

## 3. Functional Requirements

### 3.1 Feature List
| ID | Feature Name | Description | Priority |
|----|-------------|------------|----------|
| F-001 | tool_result 内容卸载 | 将符合条件的 tool_result 内容写入文件 | Must |
| F-002 | 字符数阈值过滤 | 字符数 < 100 的 tool_result 不卸载 | Must |
| F-003 | 消息路径引用替换 | 卸载后的 tool_result 替换为文件路径引用字符串 | Must |
| F-004 | 卸载结果统计 | 返回卸载数量、释放字符数、文件路径列表 | Should |
| F-005 | 自动创建输出目录 | outputDir 不存在时自动递归创建 | Must |

### 3.2 Feature Details

#### F-001: tool_result 内容卸载

**Description**: 遍历消息数组（从最早到最新），找到 `type: "tool_result"` 的 content block，将其内容写入文件。

**Input**:
- `messages: Message[]` — Anthropic 风格的消息数组
  - `Message = { role: "user" | "assistant", content: ContentBlock[] }`
  - `ContentBlock` 类型包括：
    - `{ type: "text", text: string }`
    - `{ type: "tool_use", id: string, name: string, input: object }`
    - `{ type: "tool_result", tool_use_id: string, content: string | ContentBlock[] }`
- `options: { outputDir: string }` — 卸载文件的输出目录

**Output**:
- `OffloadResult` 对象：
  - `messages: Message[]` — 卸载后的新消息列表
  - `offloadedCount: number` — 卸载的 tool_result 数量
  - `freedChars: number` — 释放的字符总数
  - `files: string[]` — 写入的文件路径列表

**Business Rules**:
1. 从消息数组的第一条（最早）开始遍历
2. 对每条消息的 content 数组，检查每个 block
3. 仅处理 `type: "tool_result"` 的 block
4. 卸载文件命名格式：`tool-result-{tool_use_id}.md`
5. 返回新的 Message[] 列表（深拷贝被修改的消息，未修改的保持原引用）

**Error & Exception Scenarios**:
| Scenario | Trigger Condition | Expected Behavior |
|----------|------------------|-------------------|
| 输出目录不存在 | outputDir 路径不存在 | 自动递归创建目录（mkdir -p） |
| tool_use_id 重复 | 多个 tool_result 的 tool_use_id 相同 | 文件名追加序号，如 `tool-result-{id}-1.md`、`tool-result-{id}-2.md` |
| 空消息数组 | messages 为空数组 `[]` | 返回 `{ messages: [], offloadedCount: 0, freedChars: 0, files: [] }` |
| 文件写入失败 | 磁盘空间不足或权限不够 | 抛出异常，由调用方处理 |

**Boundary Conditions**:
- 字符数恰好为 100：**应卸载**（≥ 100）
- 字符数为 99：**不卸载**（< 100）
- tool_result.content 为空字符串 `""`：字符数为 0，不卸载

**State Behavior**:
- 无状态方法，每次调用独立
- 唯一副作用：在 outputDir 目录下写入文件
- 不修改输入的 messages 数组（返回新数组）

#### F-002: 字符数阈值过滤

**Description**: 根据 tool_result.content 的字符数决定是否卸载。

**Business Rules**:
1. 当 `content` 为 `string` 类型时：直接使用 `content.length` 计算字符数
2. 当 `content` 为 `ContentBlock[]` 类型时：使用 `JSON.stringify(content).length` 计算字符数
3. 字符数 **< 100** 时，跳过不卸载
4. 字符数 **≥ 100** 时，执行卸载

#### F-003: 消息路径引用替换

**Description**: 卸载后，将原 tool_result 的 content 替换为文件路径引用字符串。

**Business Rules**:
1. 替换格式：`"[Content offloaded to: {filePath}]"`
2. `filePath` 为相对于 outputDir 的文件路径，如 `./tool-result-toolu_01abc.md`
3. 替换后 content 类型统一为 `string`（即使原始 content 是 ContentBlock[]）

#### F-004: 卸载结果统计

**Description**: 返回卸载操作的统计信息。

**Business Rules**:
1. `offloadedCount`：成功卸载的 tool_result 数量
2. `freedChars`：所有卸载内容的原始字符数总和
3. `files`：所有写入的文件绝对路径列表

#### F-005: 自动创建输出目录

**Description**: 当 outputDir 不存在时，自动递归创建。

**Business Rules**:
1. 使用 `fs.mkdir` 的 `{ recursive: true }` 选项
2. 如果目录已存在，不报错

## 4. Non-Functional Requirements

### 4.1 Performance Requirements
| Metric | Requirement | Measurement Method |
|--------|------------|-------------------|
| 处理速度 | 无特殊要求（学习/实验用途） | N/A |

### 4.2 Security Requirements
- 不涉及敏感数据处理，无特殊安全要求

### 4.3 Usability Requirements
- 代码结构清晰易懂，适合学习
- 类型定义完整，IDE 友好

### 4.4 Compatibility Requirements
- TypeScript 5.x
- Node.js 18+

## 5. Constraints & Dependencies

### 5.1 Constraints
- 学习/实验用途，代码清晰度优先于性能优化
- 不依赖第三方库，仅使用 Node.js 标准库（fs, path）

### 5.2 External Dependencies
- Node.js `fs/promises` 模块
- Node.js `path` 模块

### 5.3 Assumptions
- 调用方负责判断何时触发卸载（如 token 计数接近上限时）
- 调用方负责处理文件写入异常
- tool_use_id 在绝大多数情况下是唯一的

## 6. BDD Testability Check

| Dimension | Verification Question | Status |
|-----------|----------------------|--------|
| Input/Output format | 输入 Message[] + { outputDir }，输出 OffloadResult，类型明确 | Pass |
| Error & exception scenarios | 目录不存在/tool_use_id 重复/空数组/写入失败均已描述 | Pass |
| Boundary & priority rules | < 100 不卸载，≥ 100 卸载，从最早消息开始 | Pass |
| State behavior | 无状态方法，不修改输入，唯一副作用为写文件 | Pass |
| Verifiable granularity | 每个行为可独立测试 | Pass |
| Ambiguity check | 字符数计算方式（string vs array）已明确 | Pass |

## 7. Glossary
| Term | Definition |
|------|-----------|
| Context Offloading | 上下文卸载，将对话历史中的大段内容转移到外部存储以释放上下文空间 |
| tool_result | Anthropic API 中工具调用的返回结果，包含在 user 消息的 content 数组中 |
| tool_use_id | 工具调用的唯一标识符，用于关联 tool_use 和 tool_result |
| ContentBlock | Anthropic 消息中的内容块，可以是 text、tool_use、tool_result 等类型 |
