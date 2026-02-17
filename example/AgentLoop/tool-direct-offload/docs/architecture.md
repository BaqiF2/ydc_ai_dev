# Tool Direct Offload — 架构设计文档

> 本文档由开发和测试共同编写，既是代码的地图，也是测试的策略。

## 1. 架构概览

### 1.1 系统简介

Tool Direct Offload 是 Agent Loop 中的中间件模块，在工具执行结果返回给 LLM 之前，将过长的 `tool_result` 内容自动卸载到本地文件，并将消息中的原内容替换为文件路径引用。面向 Agent 开发者，用于减少无效 token 消耗。

### 1.2 架构风格

单模块简化架构，遵循依赖倒置原则。项目规模小、功能单一，不需要多模块拆分，但仍保持 core/infrastructure 分层以确保核心逻辑可测试性。

### 1.3 技术栈摘要

| 类别 | 选型 | 备注 |
|------|------|------|
| 开发语言 | TypeScript 5.x | 严格模式 |
| 运行时 | Node.js 18+ | 仅使用标准库 |
| 构建工具 | tsc | ES2022 + ESM |
| 测试框架 | Vitest | 原生 TypeScript 支持 |
| 代码规范 | ESLint 9.x | Flat config |
| 架构检查 | dependency-cruiser | 依赖规则自动检查 |
| CI/CD | GitHub Actions | Node.js 18/20/22 矩阵 |

> 详见 [技术栈文档](tech-stack.md)

## 2. 包结构与模块依赖

### 2.1 目录结构

```
tool-direct-offload/
├── src/
│   ├── core/                  # 纯业务逻辑（无框架依赖）
│   │   ├── types.ts           # 类型定义（Message, ContentBlock, FileWriter 等）
│   │   └── offload.ts         # 卸载算法核心实现
│   ├── infrastructure/        # 基础设施实现
│   │   └── file-writer.ts     # NodeFileWriter（node:fs 实现）
│   └── index.ts               # 公共 API 入口
├── tests/
│   ├── unit/
│   │   ├── core/
│   │   │   └── offload.test.ts
│   │   └── infrastructure/
│   │       └── file-writer.test.ts
│   └── integration/
│       └── offload.integration.test.ts
├── docs/
│   ├── architecture.md        # 本文档
│   ├── tech-stack.md          # 技术栈确认文档
│   ├── adr/                   # 架构决策记录
│   └── requirements/          # PRD + BDD 文档
├── .github/workflows/ci.yml   # CI 流水线
├── .dependency-cruiser.cjs    # 架构依赖规则
├── eslint.config.mjs          # ESLint 配置
├── vitest.config.ts           # 测试配置
├── tsconfig.json              # TypeScript 配置（开发）
├── tsconfig.build.json        # TypeScript 配置（构建）
└── package.json               # 项目配置
```

### 2.2 依赖规则

```
┌─────────────┐     ┌──────────────────┐
│  index.ts   │────▶│     core 层       │◀────┐
│ (公共 API)   │     │ types + offload  │     │
└─────────────┘     └──────────────────┘     │
                                              │
                    ┌──────────────────┐      │
                    │ infrastructure 层 │──────┘
                    │  (FileWriter)    │ 实现 core 定义的接口
                    └──────────────────┘
```

- **core 层**：不依赖 infrastructure 层，不导入 `node:fs`、`node:path` 等 Node.js 模块，仅包含纯业务逻辑和类型定义
- **infrastructure 层**：实现 core 层定义的 `FileWriter` 接口
- **index.ts**：组装层，将 core 和 infrastructure 连接起来，对外暴露便捷 API

### 2.3 模块间通信

本项目为单模块架构，无跨模块通信需求。core 层通过 `FileWriter` 接口与 infrastructure 层交互（依赖注入）。

## 3. 外部依赖清单

### 3.1 运行时依赖

无。仅使用 Node.js 标准库（`node:fs/promises`、`node:path`）。

### 3.2 测试依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| vitest | ^3.0.0 | 测试框架 |
| @vitest/coverage-v8 | ^3.0.0 | 覆盖率收集 |

### 3.3 代码质量

| 依赖 | 版本 | 用途 |
|------|------|------|
| typescript | ^5.7.0 | TypeScript 编译器 |
| eslint | ^9.0.0 | 代码规范检查 |
| typescript-eslint | ^8.0.0 | ESLint TypeScript 支持 |
| dependency-cruiser | ^16.0.0 | 架构依赖规则检查 |
| @types/node | ^25.2.3 | Node.js 类型定义 |

## 4. 测试架构

### 4.1 测试金字塔

| 测试类型 | 目标层级 | 工具/技术 | 编写者 | 执行时机 |
|----------|---------|----------|--------|---------|
| 单元测试 | core 层 | Vitest + mock FileWriter | 开发 | 每次提交 |
| 单元测试 | infrastructure 层 | Vitest + 临时目录 | 开发 | 每次提交 |
| 集成测试 | 公共 API（index.ts） | Vitest + 真实文件系统 | 开发 | CI 流程 |

### 4.2 测试数据管理

| 测试层级 | 数据来源 | 隔离方式 |
|----------|---------|---------|
| 单元测试 | 内存对象 / Mock FileWriter | 完全隔离 |
| 集成测试 | 临时目录（os.tmpdir） | 文件系统隔离，测试后清理 |

### 4.3 覆盖率目标

| 模块 | 行覆盖率 | 分支覆盖率 |
|------|---------|----------|
| core | ≥ 80% | ≥ 70% |
| infrastructure | ≥ 50% | ≥ 40% |
| 整体项目 | ≥ 70% | ≥ 60% |

## 5. 架构适应度函数

### 5.1 依赖规则检查

使用 **dependency-cruiser** 在构建/测试时强制执行：

| 规则 | 说明 |
|------|------|
| core-must-not-depend-on-infrastructure | core 层不得导入 infrastructure 层 |
| core-must-not-import-node-fs | core 层不得直接导入 node:fs |
| core-must-not-import-node-path | core 层不得直接导入 node:path |
| no-circular-dependencies | 禁止循环依赖 |

### 5.2 编码规范检查

使用 **ESLint 9.x** + **typescript-eslint**（strict 配置）：

- 禁止 `any` 类型（`@typescript-eslint/no-explicit-any: error`）
- 强制 `const`（`prefer-const: error`）
- TypeScript 严格模式全开

## 6. 日志与可观测性

### 6.1 日志框架

| 配置项 | 值 | 说明 |
|--------|---|------|
| 日志框架 | console | 学习项目，零依赖策略（参见 ADR-003） |
| 日志格式 | 纯文本 | 开发环境人类可读 |
| 日志语言 | English | 所有日志消息统一使用英文 |
| 关联 ID | N/A | 单次函数调用，无需请求追踪 |

### 6.2 日志级别规划

| 级别 | 使用场景 | 示例 |
|------|---------|------|
| ERROR | 不可恢复的错误 | 文件写入失败（直接抛异常，不记日志） |
| WARN | N/A | 本模块无 warn 场景 |
| INFO | N/A | 本模块无状态，不记录业务事件 |
| DEBUG | N/A | 学习项目不需要 debug 日志 |

> 注：本模块为无状态的纯函数式中间件，错误通过异常传播，不主动记录日志。

## 7. CI/CD 流水线

### 7.1 流水线步骤

```
Checkout → Node.js 环境设置 → 依赖安装 → Lint → 架构依赖检查 → 单元测试 → 集成测试 → 覆盖率检查 → 构建
```

### 7.2 质量门禁

- [x] 单元测试全部通过
- [x] 集成测试全部通过
- [x] 覆盖率达到阈值（行 ≥ 70%，分支 ≥ 60%）
- [x] 架构依赖规则检查通过
- [x] ESLint 代码规范检查通过
- [x] TypeScript 编译成功

### 7.3 测试矩阵

| Node.js 版本 | 说明 |
|--------------|------|
| 18 | 最低支持版本 |
| 20 | 当前 LTS |
| 22 | 最新 LTS |

## 附录

### A. 架构决策记录索引

| ADR 编号 | 标题 | 状态 |
|---------|------|------|
| ADR-001 | [选择 TypeScript 作为开发语言](adr/ADR-001-typescript-language.md) | ACCEPTED |
| ADR-002 | [选择 Vitest 作为测试框架](adr/ADR-002-vitest-testing.md) | ACCEPTED |
| ADR-003 | [零运行时依赖策略](adr/ADR-003-zero-runtime-deps.md) | ACCEPTED |

### B. 术语表

| 术语 | 定义 |
|------|------|
| Tool Result | LLM Agent 调用工具后返回的结果内容 |
| Offload | 将内容从内存/上下文转移到文件存储 |
| Agent Loop | LLM Agent 的执行循环，包含"推理 → 工具调用 → 结果处理"的迭代过程 |
| tool_use_id | Anthropic API 中工具调用的唯一标识符 |
| FileWriter | 文件写入的抽象接口，用于依赖倒置和测试 mock |
