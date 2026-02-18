# Todo-List Tool 教学示例 — 架构设计文档

> 本文档由开发和测试共同编写，既是代码的地图，也是测试的策略。

## 1. 架构概览

### 1.1 系统简介

面向 AI Agent 开发学习者的 todo-list 工具教学示例。通过构建包含完整 CRUD 操作和状态管理的 todo-list 工具，展示 agent loop 中工具的核心机制：Schema 定义、工具注册、LLM 调用、状态管理和结构化结果返回。

### 1.2 架构风格

**简化单模块架构** — 由于项目定位为教学示例（代码量 < 500 行），采用扁平的单模块结构，但保持清晰的职责分离。每个文件对应一个教学概念，便于学习者逐一理解。

选择理由（参考 ADR-004）：
- 项目只有一个业务域（todo-list），无需多模块拆分
- 教学目标要求代码结构简洁直观
- 过度分层会掩盖核心学习重点

### 1.3 技术栈摘要

| 类别 | 选型 | 版本 | 备注 |
|------|------|------|------|
| 开发语言 | TypeScript | 5.9.3 | 类型系统为工具 Schema 提供编译时校验 |
| 运行时 | Node.js | >= 18.x | 内置 crypto.randomUUID() |
| TS 执行工具 | tsx | 4.21.0 | 零配置运行 TS 文件 |
| 测试框架 | Vitest | 4.0.18 | 原生 TS 支持、零配置 |
| 数据存储 | Map (内存) | 内置 | PRD 要求内存存储 |
| 包管理器 | npm | 内置 | Node.js 标配 |

详细选型记录见：`docs/architecture/2026-02-18-todo-list-tool-tech-stack.md`

## 2. 包结构与模块依赖

### 2.1 目录结构

```
todo-list/
├── src/                           # 源代码
│   ├── types.ts                   # 类型定义：Todo 模型、Tool 接口、响应格式
│   ├── store.ts                   # 内存存储层：TodoStore（Map 封装）
│   ├── handlers.ts                # 工具处理函数：CRUD 业务逻辑
│   ├── tools.ts                   # 工具 Schema 定义：5 个工具的 JSON Schema
│   ├── registry.ts                # 工具注册表：注册、查找、列表获取
│   └── index.ts                   # 入口文件：组装并导出所有模块
├── tests/
│   └── unit/                      # 单元测试
│       ├── store.test.ts          # 存储层测试
│       ├── handlers.test.ts       # 处理函数测试
│       ├── tools.test.ts          # Schema 定义测试
│       └── registry.test.ts       # 注册表测试
├── docs/
│   ├── architecture.md            # 本文档
│   ├── architecture/              # 技术栈和 ADR 文档
│   │   ├── adr/
│   │   └── tradeoff/
│   └── requirements/              # PRD 和 BDD 文档
├── package.json                   # 项目配置和依赖声明
├── tsconfig.json                  # TypeScript 配置
├── vitest.config.ts               # Vitest 测试配置
├── architecture.config.json       # 架构验证配置
└── .gitignore
```

### 2.2 文件职责映射（教学概念对应）

```
教学概念                          文件
─────────────────────────────────────────
1. 类型定义（接口即文档）      → types.ts
2. 工具 Schema 定义            → tools.ts
3. 工具注册机制                → registry.ts
4. 工具调用（业务逻辑）        → handlers.ts
5. 状态管理                    → store.ts
6. 入口组装                    → index.ts
```

### 2.3 依赖规则

```
┌──────────┐     ┌──────────────┐     ┌──────────┐
│ tools.ts │────▶│   types.ts   │◀────│ store.ts │
│ (Schema) │     │ (接口定义)    │     │ (存储)    │
└──────────┘     └──────────────┘     └──────────┘
                        ▲
      ┌─────────────────┤
      │                 │
┌─────────────┐  ┌──────────────┐
│ handlers.ts │  │ registry.ts  │
│ (业务逻辑)   │  │ (注册表)      │
└─────────────┘  └──────────────┘
      │                 ▲
      │                 │
      └─────────────────┘
            index.ts (组装入口)
```

**依赖方向规则**：
- `types.ts`：不依赖任何其他模块（纯类型定义）
- `store.ts`：仅依赖 `types.ts`
- `handlers.ts`：依赖 `types.ts` + `store.ts`
- `tools.ts`：仅依赖 `types.ts`
- `registry.ts`：仅依赖 `types.ts`
- `index.ts`：依赖所有模块，负责组装

### 2.4 模块间通信

本项目为单模块项目，无模块间通信需求。`index.ts` 负责将各部分组装为完整的工具集。

## 3. 外部依赖清单

### 3.1 运行时依赖

无外部运行时依赖（全部使用 Node.js 内置功能）。

### 3.2 开发依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| typescript | 5.9.3 | TypeScript 编译器（类型检查） |
| tsx | 4.21.0 | TypeScript 执行工具（零配置运行 .ts 文件） |
| vitest | 4.0.18 | 测试框架（原生 TS 支持） |
| @types/node | latest | Node.js 类型定义 |

## 4. 测试架构

### 4.1 测试金字塔

本项目为教学示例，仅需单元测试层（无外部依赖，不需要集成测试和端到端测试）：

| 测试类型 | 目标 | 工具 | 编写者 | 执行时机 |
|----------|------|------|--------|---------|
| 单元测试 | 存储层、处理函数、Schema 定义、注册表 | Vitest | 开发 | 每次提交 / `npm test` |

### 4.2 测试数据管理

| 测试层级 | 数据来源 | 隔离方式 |
|----------|---------|---------|
| 单元测试 | 内存 TodoStore 实例 | 每个测试用例创建独立的 store 实例 |

### 4.3 覆盖率目标

| 模块 | 行覆盖率 | 分支覆盖率 |
|------|---------|----------|
| types.ts | N/A（纯类型） | N/A |
| store.ts | ≥ 80% | ≥ 70% |
| handlers.ts | ≥ 80% | ≥ 70% |
| tools.ts | ≥ 60% | ≥ 50% |
| registry.ts | ≥ 80% | ≥ 70% |
| 整体项目 | ≥ 80% | ≥ 70% |

## 5. 架构适应度函数

### 5.1 依赖规则检查

由于项目规模极小（< 500 行），不引入 dependency-cruiser 等重型工具。通过以下方式保护依赖规则：
- TypeScript 编译器的模块系统天然防止循环依赖
- 代码审查检查依赖方向

### 5.2 编码规范检查

教学示例不引入 ESLint 等额外工具，保持最小依赖。TypeScript 编译器的 strict 模式提供基本的代码质量保障。

## 6. 日志与可观测性

### 6.1 日志方案

教学示例不引入日志框架。工具处理函数通过结构化返回值（`{ success, data/error }`）传递信息，这本身就是 agent loop 工具的标准模式。

如需调试，使用 `console.log` 即可。

### 6.2 可观测性

不适用（教学示例无生产部署需求）。

## 7. CI/CD 流水线

### 7.1 流水线步骤（本地开发）

```
npm install → npm test → npm run typecheck
```

### 7.2 质量门禁

- [x] 单元测试全部通过
- [x] 覆盖率达到阈值（≥ 80%）
- [x] TypeScript 类型检查通过（zero errors）

## 附录

### A. 架构决策记录索引

| ADR 编号 | 标题 | 状态 |
|---------|------|------|
| ADR-001 | 使用 TypeScript 作为开发语言 | Accepted |
| ADR-002 | 使用 tsx 作为 TypeScript 执行工具 | Accepted |
| ADR-003 | 使用 Vitest 作为测试框架 | Accepted |
| ADR-004 | 使用内存存储（Map）作为数据存储方案 | Accepted |
| ADR-005 | 使用 npm 作为包管理器 | Accepted |

### B. 术语表

| 术语 | 定义 |
|------|------|
| Agent Loop | AI Agent 的核心执行循环：LLM 推理 → 工具调用 → 结果反馈 → 继续推理 |
| Tool | Agent 可调用的外部功能单元，包含 Schema 定义和执行逻辑 |
| Schema | 工具的接口描述（JSON Schema），供 LLM 理解如何调用 |
| Handler | 工具的执行函数，接收参数执行实际操作 |
| ToolRegistry | 工具注册表，管理所有工具的 Schema 和 Handler |
| Walking Skeleton | 最小可运行的项目骨架，验证技术集成 |
