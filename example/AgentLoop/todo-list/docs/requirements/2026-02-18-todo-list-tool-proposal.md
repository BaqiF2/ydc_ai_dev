# Todo-List Tool — Requirement Proposal

## 1. Background & Problem

### 1.1 Problem Description
开发者在学习 Agent Loop 机制时，缺乏一个聚焦且完整的教学示例来理解工具（Tool）在 agent loop 中的完整生命周期——从工具定义、注册、LLM 调用到状态管理和多工具协作。现有学习资源通常是碎片化的，无法一次性覆盖工具开发的关键概念。

### 1.2 Impact Scope
- **Universality assessment**: 通用需求——所有 AI Agent 开发学习者都需要理解工具机制
- **Affected roles/teams**: AI Agent 开发学习者、教学内容制作者
- **Current pain points**:
  - 缺少以教学为目的、代码精简、概念完整的工具示例
  - 现有 todo-list 实现（如 Claude Code 内置的）代码复杂，不适合入门学习
  - 工具注册、状态管理、协作模式等概念散落在不同文档中，缺乏统一展示

### 1.3 Problem Domain Boundary
- **属于问题域**：通过构建 todo-list 工具，展示 agent loop 中工具的核心概念（定义、注册、调用、状态管理、协作）
- **不属于问题域**：生产级 todo 应用开发、UI 设计、持久化存储方案设计

## 2. User Stories

### 2.1 Core User Story
> As a 学习者（开发者），I want 一个完整的 todo-list 工具教学示例，so that 我能理解 agent loop 中工具注册、调用、状态管理和协作的完整机制。

### 2.2 Extended User Stories
1. > As a 学习者，I want 看到工具如何定义 schema 并被 LLM 调用，so that 我能理解工具注册与参数传递机制。
2. > As a 学习者，I want 通过 CRUD 操作观察工具如何维护内存中的状态，so that 我能理解工具的状态管理模式。
3. > As a 学习者，I want 跟随从定义到集成的完整流程，so that 我能独立开发和集成自己的工具。
4. > As a 学习者，I want 观察多个工具之间的协作模式，so that 我能设计工具间的联动方案。

## 3. Requirement Refinement

### 3.1 Functional Requirements
| ID | Description | Priority (MoSCoW) | Source |
|----|------------|-------------------|--------|
| FR-001 | 创建任务：支持创建包含标题和描述的 todo 任务，系统自动生成唯一 ID 和创建时间 | Must have | US-2.1 |
| FR-002 | 查询任务列表：支持查询所有任务，返回任务摘要列表 | Must have | US-2.2 |
| FR-003 | 查询单个任务：支持按 ID 查询单个任务的完整详情 | Must have | US-2.2 |
| FR-004 | 更新任务：支持修改任务的标题、描述和状态 | Must have | US-2.2 |
| FR-005 | 删除任务：支持按 ID 删除任务 | Must have | US-2.2 |
| FR-006 | 任务状态管理：任务包含 pending/in_progress/completed 三种状态，支持状态流转 | Must have | US-2.2 |
| FR-007 | 工具 Schema 定义：每个工具操作都有清晰的 JSON Schema 定义，包含参数类型、必填/可选、描述 | Must have | US-2.1 |
| FR-008 | 工具注册机制：所有工具通过统一的注册接口注册到 agent loop 中 | Must have | US-2.1, US-2.3 |
| FR-009 | 工具调用与结果返回：工具被 LLM 调用后返回结构化结果（成功/失败+数据/错误信息） | Must have | US-2.3 |
| FR-010 | 内存状态存储：所有任务数据存储在内存中，通过工具调用进行读写 | Must have | US-2.2 |

### 3.2 Non-Functional Requirements
| ID | Description | Acceptance Criteria | Priority |
|----|------------|-------------------|----------|
| NFR-001 | 代码可读性：代码结构清晰，关键逻辑有注释说明教学要点 | 代码行数 < 500 行（不含测试），每个概念有对应注释 | Must have |
| NFR-002 | 教学完整性：示例覆盖工具开发的完整生命周期 | 覆盖：定义 → 注册 → 调用 → 状态管理 → 结果返回 5 个阶段 | Must have |
| NFR-003 | 独立运行：示例可以独立运行和测试，不依赖外部服务 | npm install && npm test 即可运行 | Should have |

### 3.3 Key Decision Records
| Decision ID | Question | Conclusion | Rationale |
|------------|----------|-----------|-----------|
| KD-001 | 数据存储方式 | 内存存储（Map/数组） | 教学目的，保持最简单直接，聚焦工具机制而非存储 |
| KD-002 | 功能复杂度 | 基础 CRUD + 状态管理 | 足够展示核心概念，避免复杂度掩盖学习重点 |
| KD-003 | 目标受众 | AI Agent 开发学习者 | 教学示例定位，代码需简洁可读 |

## 4. MoSCoW Priority Overview

### Must Have
- 任务 CRUD（创建、查询、更新、删除）
- 任务状态管理（pending/in_progress/completed）
- 工具 Schema 定义（JSON Schema）
- 工具注册机制
- 工具调用与结构化结果返回
- 内存状态存储

### Should Have
- 独立可运行的测试套件
- 教学注释和文档

### Could Have
- 工具协作示例（如 todo 查询结果传递给其他工具）

### Won't Have (this iteration)
- 持久化存储（文件/数据库）
- UI 界面
- 用户认证
- 任务优先级和标签
- 任务分类和筛选
- 提醒和通知功能

## 5. Constraints & Assumptions

### 5.1 Constraints
- 仅使用内存存储，会话结束数据即消失
- 代码需要保持简洁，总量控制在 500 行以内（不含测试）
- 作为教学示例，不追求生产级健壮性

### 5.2 Assumptions
- 学习者具备 TypeScript/JavaScript 基础
- 学习者了解 LLM/Agent 的基本概念
- 运行环境为 Node.js

## 6. Open Questions
| ID | Question | Status | Owner |
|----|---------|--------|-------|
| - | 无待解决问题 | - | - |
