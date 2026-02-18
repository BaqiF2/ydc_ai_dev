# Context Compact — 架构设计文档

> 本文档由开发和测试共同编写，既是代码的地图，也是测试的策略。

## 1. 架构概览

### 1.1 系统简介

Context Compact 是 Agent Loop 系列的第三个上下文管理模块，负责在历史消息 token 总量接近上下文窗口上限时，通过 LLM 调用生成结构化摘要替换中间历史消息，使 Agent 能够持续进行超长会话。

### 1.2 架构风格

单模块库（Library Module），采用分层架构（core / infrastructure），通过依赖注入实现核心逻辑与外部服务的解耦。与 context-offload、tool-direct-offload 保持相同的架构模式。

### 1.3 技术栈摘要

| 类别 | 选型 | 备注 |
|------|------|------|
| 语言 | TypeScript ^5.7.0 | 严格模式，ES2022 target |
| 运行时 | Node.js >= 18 | ESM (Node16 module) |
| LLM SDK | @anthropic-ai/sdk ^0.74.0 | Token 计数 + 摘要生成 |
| 日志 | Console + Logger Interface | 零依赖，可注入替换 |
| 测试 | Vitest ^3.0.0 | @vitest/coverage-v8 |
| Lint | ESLint ^9.0.0 + typescript-eslint ^8.0.0 | |
| 依赖检查 | dependency-cruiser ^16.0.0 | 分层依赖规则强制执行 |

## 2. 包结构与模块依赖

### 2.1 目录结构

```
compact/
├── src/
│   ├── core/
│   │   ├── types.ts              # 类型定义：Message, CompactResult, CompactOptions, CompactStats, Logger
│   │   ├── compact.ts            # 核心压缩算法：shouldCompact, compactMessages, partitionMessages, assembleMessages
│   │   ├── token-counter.ts      # Token 计数封装：countTokens, serializeMessage
│   │   └── summarizer.ts         # 摘要逻辑：summarize, buildSummarizePrompt, serializeForSummary
│   ├── infrastructure/
│   │   ├── llm-client.ts         # Anthropic SDK 封装：AnthropicLlmClient（countTokens + summarize + retry）
│   │   └── file-writer.ts        # 文件持久化：NodeFileWriter（JSON 写入 + 目录创建）
│   └── index.ts                  # 公共 API 导出：compactMessages, shouldCompact, countTokens
├── tests/
│   ├── core/
│   │   ├── compact.test.ts       # 压缩算法单元测试
│   │   ├── token-counter.test.ts # Token 计数单元测试
│   │   └── summarizer.test.ts    # 摘要逻辑单元测试
│   └── infrastructure/
│       ├── llm-client.test.ts    # LLM 客户端集成测试
│       └── file-writer.test.ts   # 文件写入集成测试
├── docs/
│   ├── requirements/             # PRD + BDD 文档（已存在）
│   └── architecture/             # 架构文档 + ADR（已存在）
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── vitest.config.ts
├── eslint.config.js
├── .dependency-cruiser.cjs
└── README.md
```

### 2.2 依赖规则

```
┌──────────────────┐
│    index.ts      │ ── 导出公共 API
└────────┬─────────┘
         │
┌────────▼─────────┐     ┌──────────────────┐
│    core 层        │◀────│ infrastructure 层  │
│ (compact,         │     │ (llm-client,      │
│  token-counter,   │     │  file-writer)     │
│  summarizer)      │     │                   │
└──────────────────┘     └──────────────────┘
```

- **core 层**：不依赖 infrastructure 层。通过接口（`LlmClient`, `FileWriter`, `Logger`）定义外部依赖契约
- **infrastructure 层**：实现 core 层定义的接口
- **index.ts**：组装 core + infrastructure，导出便利函数

### 2.3 核心接口定义

```typescript
// core/types.ts 中定义的接口

interface LlmClient {
  countTokens(messages: Message[], model: string): Promise<number>;
  summarize(prompt: string, model: string): Promise<string>;
}

interface FileWriter {
  write(filePath: string, content: string): Promise<void>;
}

interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}
```

### 2.4 模块间通信

不适用 — 单模块库。

## 3. 外部依赖清单

### 3.1 核心依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| @anthropic-ai/sdk | ^0.74.0 | LLM 摘要调用 + Token 计数 API |

### 3.2 开发依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| typescript | ^5.7.0 | TypeScript 编译 |
| @types/node | ^25.2.3 | Node.js 类型定义 |

### 3.3 测试依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| vitest | ^3.0.0 | 测试框架 |
| @vitest/coverage-v8 | ^3.0.0 | 覆盖率报告 |

### 3.4 代码质量

| 依赖 | 版本 | 用途 |
|------|------|------|
| eslint | ^9.0.0 | 代码规范检查 |
| typescript-eslint | ^8.0.0 | TypeScript ESLint 插件 |
| dependency-cruiser | ^16.0.0 | 依赖规则检查 |

## 4. 测试架构

### 4.1 测试金字塔

| 测试类型 | 目标层级 | 工具/技术 | 编写者 | 执行时机 |
|----------|---------|----------|--------|---------|
| 单元测试 | core 层 | Vitest + mock LlmClient/FileWriter | 开发 | 每次提交 |
| 集成测试 | infrastructure 层 | Vitest + 真实文件系统 / mock API | 开发 | CI 流程 |

注：本项目为库模块，无 API 层和端到端测试。

### 4.2 测试数据管理

| 测试层级 | 数据来源 | 隔离方式 |
|----------|---------|---------|
| 单元测试 | 内存对象 / Mock LlmClient | 完全隔离 |
| 集成测试 | 临时目录 / Mock API 响应 | 文件系统隔离（afterEach 清理） |

### 4.3 覆盖率目标

| 模块 | 行覆盖率 | 分支覆盖率 |
|------|---------|----------|
| core | ≥ 80% | ≥ 70% |
| infrastructure | ≥ 50% | ≥ 40% |
| 整体项目 | ≥ 70% | ≥ 60% |

## 5. 架构适应度函数

### 5.1 依赖规则检查

使用 **dependency-cruiser** 强制执行分层依赖规则：

- `src/core/**` → 禁止导入 `src/infrastructure/**`
- `src/core/**` → 禁止导入 `@anthropic-ai/sdk`（框架无关）
- `src/core/**` → 禁止导入 `node:fs`（无文件 IO 副作用）
- 禁止循环依赖

### 5.2 编码规范检查

ESLint 配置：
- typescript-eslint recommended 规则集
- 严格 TypeScript 检查对齐 tsconfig strict 选项

## 6. 日志与可观测性

### 6.1 日志框架

| 配置项 | 值 | 说明 |
|--------|---|------|
| 日志框架 | Console + Logger Interface | 零依赖，可注入替换 |
| 日志格式 | 人类可读（console 默认） | 学习项目，简洁优先 |
| 日志语言 | English | 所有日志消息统一使用英文 |
| 关联 ID | 不适用 | 库模块，无请求链路 |

### 6.2 日志级别规划

| 级别 | 使用场景 | 示例 |
|------|---------|------|
| ERROR | 持久化失败、LLM 调用全部重试失败 | `"Failed to persist original messages: permission denied"` |
| WARN | 未知 ContentBlock 类型、空摘要、单次 LLM 重试 | `"Unknown content block type, skipping: customBlock"` |
| INFO | 压缩触发、压缩完成、统计信息 | `"Context compaction completed: 190000 -> 60000 tokens (ratio: 0.32)"` |

### 6.3 日志规范

- 使用参数化消息（通过 context 对象传递结构化数据）
- 禁止记录敏感信息（API key、完整消息内容）
- Logger 通过 CompactOptions 注入，默认实现为 console

### 6.4 默认 Logger 实现

```typescript
const defaultLogger: Logger = {
  info: (msg, ctx) => console.log(`[INFO] ${msg}`, ctx ?? ''),
  warn: (msg, ctx) => console.warn(`[WARN] ${msg}`, ctx ?? ''),
  error: (msg, ctx) => console.error(`[ERROR] ${msg}`, ctx ?? ''),
};
```

## 7. CI/CD 流水线

### 7.1 流水线步骤

```
Checkout → Node.js 18 Setup → npm install → Lint → Dep Check → Unit Tests + Coverage → Build
```

### 7.2 质量门禁

- [ ] 单元测试全部通过
- [ ] 覆盖率达到阈值（lines ≥ 70%, branches ≥ 60%）
- [ ] ESLint 零错误
- [ ] dependency-cruiser 规则全部通过
- [ ] TypeScript 编译零错误

## 附录

### A. 架构决策记录索引

| ADR 编号 | 标题 | 状态 |
|---------|------|------|
| ADR-001 | 使用 TypeScript + Node.js 18+ 技术栈 | Accepted |
| ADR-002 | 使用 Anthropic SDK countTokens API 进行 Token 计数 | Accepted |
| ADR-003 | 使用 Anthropic SDK 进行 LLM 摘要调用 | Accepted |
| ADR-004 | 使用 Console + Interface 日志方案 | Accepted |
| ADR-005 | 使用 Vitest 3.x + ESLint 9.x 测试和代码质量工具链 | Accepted |

### B. 术语表

| 术语 | 定义 |
|------|------|
| Agent Loop | 基于 LLM 的智能体循环执行框架 |
| Compact | 上下文压缩，将历史消息通过摘要替换以减少 token 用量 |
| Head | 消息列表头部的 system prompt，始终保留 |
| Middle | Head 和 Tail 之间的消息，压缩目标 |
| Tail | 消息列表尾部的最新消息，根据 token 预算保留 |
| Offload | 上下文卸载，将大型内容写入外部文件并替换为引用 |
