# Agent 上下文卸载模块 — 架构设计文档

> 本文档由开发和测试共同编写，既是代码的地图，也是测试的策略。

## 1. 架构概览

### 1.1 系统简介

Agent 上下文卸载模块（Context Offloading Module），用于将 Agent Loop 中历史消息的 tool_result 内容卸载到文件系统，释放上下文窗口空间。面向 Agent 开发者的学习/实验用途模块。

### 1.2 架构风格

**简化单模块架构**：由于项目规模小、功能单一，采用扁平化的单模块结构，但仍保持 core/infrastructure 分层以践行依赖倒置原则。

### 1.3 技术栈摘要

| 类别 | 选型 | 备注 |
|------|------|------|
| 后端语言/框架 | TypeScript 5.x / Node.js 18+ | 零运行时第三方依赖 |
| 前端框架 | N/A | 纯后端模块 |
| 数据库 | N/A | 使用文件系统存储 |
| 缓存 | N/A | |
| 消息队列 | N/A | |
| CI/CD | GitHub Actions | |

> 详见 [技术栈文档](./tech-stack.md)

## 2. 包结构与模块依赖

### 2.1 目录结构

```
project-root/
├── src/
│   ├── core/                          # 纯业务逻辑层（零外部依赖）
│   │   ├── types.ts                   # Anthropic 消息类型定义
│   │   └── offload.ts                 # 卸载算法核心逻辑
│   ├── infrastructure/                # 基础设施层（文件系统操作）
│   │   └── file-writer.ts             # 文件写入实现
│   └── index.ts                       # 公共 API 入口
├── tests/
│   ├── unit/
│   │   └── core/
│   │       └── offload.test.ts        # 核心逻辑单元测试
│   └── integration/
│       └── offload.integration.test.ts # 文件系统集成测试
├── docs/                              # 项目文档
├── .github/workflows/ci.yml           # CI 流水线
├── package.json
├── tsconfig.json
├── eslint.config.mjs
├── vitest.config.ts
└── .dependency-cruiser.cjs            # 依赖规则配置
```

### 2.2 依赖规则

```
┌──────────────────┐
│    index.ts      │ ─── 公共 API 入口
│  (re-export)     │
└────────┬─────────┘
         │ imports
         ▼
┌──────────────────┐     ┌──────────────────┐
│    core 层        │◀────│ infrastructure 层 │
│ (offload.ts)     │     │ (file-writer.ts) │
│ (types.ts)       │     │                  │
└──────────────────┘     └──────────────────┘
```

- **core 层**：不依赖 infrastructure 层，不导入 `node:fs` 或 `node:path` 等 Node.js 模块。仅包含纯业务逻辑和类型定义。通过回调函数/接口接收文件写入能力。
- **infrastructure 层**：实现 core 层定义的 `FileWriter` 接口，依赖 `node:fs/promises` 和 `node:path`。
- **index.ts**：组装 core 和 infrastructure，导出公共 API。

### 2.3 模块间通信

| 源模块 | 目标模块 | 通信方式 | 说明 |
|--------|---------|---------|------|
| N/A | N/A | N/A | 单模块项目，无跨模块通信 |

## 3. 外部依赖清单

### 3.1 核心框架

| 依赖 | 版本 | 用途 |
|------|------|------|
| Node.js | 18+ | 运行时环境 |

> 运行时零第三方依赖。详见 [ADR-003](./adr/ADR-003-zero-runtime-deps.md)

### 3.2 数据层

| 依赖 | 版本 | 用途 |
|------|------|------|
| node:fs/promises | built-in | 文件异步写入 |
| node:path | built-in | 路径拼接 |

### 3.3 工具库

无第三方工具库依赖。

### 3.4 测试依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| vitest | latest | 测试框架 |
| @vitest/coverage-v8 | latest | 覆盖率收集 |

> 详见 [ADR-002](./adr/ADR-002-vitest-testing.md)

### 3.5 代码质量

| 依赖 | 版本 | 用途 |
|------|------|------|
| typescript | 5.x | TypeScript 编译器 |
| eslint | 9.x | 代码规范检查 |
| typescript-eslint | latest | ESLint TypeScript 支持 |
| dependency-cruiser | latest | 架构依赖规则检查 |

## 4. 测试架构

### 4.1 测试金字塔

| 测试类型 | 目标层级 | 工具/技术 | 编写者 | 执行时机 |
|----------|---------|----------|--------|---------|
| 单元测试 | core 层 | Vitest + vi.mock | 开发 | 每次提交 |
| 集成测试 | core + infrastructure | Vitest + 临时目录 | 开发 | CI 流程 |
| 端到端测试 | N/A | N/A | N/A | N/A（模块项目，无 E2E） |

### 4.2 测试数据管理

| 测试层级 | 数据来源 | 隔离方式 |
|----------|---------|---------|
| 单元测试 | 内存构造的 Message[] | 完全隔离，mock FileWriter |
| 集成测试 | 内存构造的 Message[] + 临时目录 | 每测试用例独立临时目录 |

### 4.3 覆盖率目标

| 模块 | 行覆盖率 | 分支覆盖率 |
|------|---------|----------|
| core | ≥ 80% | ≥ 70% |
| infrastructure | ≥ 50% | ≥ 40% |
| 整体项目 | ≥ 70% | ≥ 60% |

## 5. 架构适应度函数

### 5.1 依赖规则检查

使用 **dependency-cruiser** 强制执行以下规则：

1. `src/core/**` 不得导入 `src/infrastructure/**`
2. `src/core/**` 不得导入 `node:fs`、`node:path` 等 Node.js 模块
3. 禁止循环依赖

配置文件：`.dependency-cruiser.cjs`

### 5.2 编码规范检查

使用 **ESLint 9.x** + **typescript-eslint**：

- 严格模式类型检查
- 禁止 `any` 类型
- 强制使用 `const` 优先

配置文件：`eslint.config.mjs`

## 6. 日志与可观测性

### 6.1 日志框架

| 配置项 | 值 | 说明 |
|--------|---|------|
| 日志框架 | console | 学习项目，使用原生 console |
| 日志格式 | 人类可读 | 开发/学习环境 |
| 日志语言 | English | 所有日志消息统一使用英文 |
| 关联 ID | N/A | 无请求链路（纯函数调用） |

### 6.2 日志级别规划

| 级别 | 使用场景 | 示例 |
|------|---------|------|
| ERROR | 文件写入失败等不可恢复错误 | `Failed to write offload file` |
| WARN | 非预期但可处理的情况 | `Duplicate tool_use_id detected` |
| INFO | 关键操作完成 | `Offloaded N tool results, freed M chars` |
| DEBUG | 详细诊断信息 | `Skipping tool_result: content length 50 < 100` |

### 6.3 日志规范

- 使用模板字面量（template literals），避免字符串拼接
- 禁止记录敏感信息
- 日志消息统一使用英文

### 6.4 结构化日志格式

```
[INFO] Offloaded 3 tool results, freed 1500 chars
[DEBUG] Skipping tool_result toolu_abc: content length 50 < threshold 100
[WARN] Duplicate tool_use_id detected: toolu_dup, appending suffix -1
```

## 7. CI/CD 流水线

### 7.1 流水线步骤

```
Checkout → Node.js Setup → Install → Lint → Unit Tests → Integration Tests → Architecture Check → Build
```

### 7.2 质量门禁

- [ ] 单元测试全部通过
- [ ] 集成测试全部通过
- [ ] 覆盖率达到阈值（core ≥ 80%，整体 ≥ 70%）
- [ ] ESLint 零错误
- [ ] dependency-cruiser 零违规
- [ ] TypeScript 编译零错误

## 附录

### A. 架构决策记录索引

| ADR 编号 | 标题 | 状态 |
|---------|------|------|
| ADR-001 | [选择 TypeScript 作为开发语言](./adr/ADR-001-typescript-language.md) | Accepted |
| ADR-002 | [选择 Vitest 作为测试框架](./adr/ADR-002-vitest-testing.md) | Accepted |
| ADR-003 | [零运行时依赖策略](./adr/ADR-003-zero-runtime-deps.md) | Accepted |

### B. 术语表

| 术语 | 定义 |
|------|------|
| Context Offloading | 上下文卸载，将对话历史中的大段内容转移到外部存储以释放上下文空间 |
| tool_result | Anthropic API 中工具调用的返回结果 |
| tool_use_id | 工具调用的唯一标识符 |
| ContentBlock | Anthropic 消息中的内容块 |
| Walking Skeleton | 最小可运行项目骨架，验证所有技术集成能正常协作 |
| Fitness Function | 架构适应度函数，自动化测试保护架构特性不被违反 |
