 # Agent Context Compact

Agent Loop 上下文压缩模块 — 当历史消息 token 总量接近上下文窗口上限时，通过独立 LLM 调用将中间历史消息生成结构化摘要，替换原始消息以释放 token 空间。

## 核心特性

- **保留头尾、摘要中间** — system prompt 和最新对话完整保留，仅压缩中间历史
- **多次压缩** — 支持任意长度会话，前次摘要可参与后续压缩
- **原始消息持久化** — 压缩前自动将原始消息保存为 JSON 文件，支持审计和回溯
- **容错与重试** — LLM 调用失败自动重试，全部失败则跳过压缩、返回原始消息
- **零配置可用** — 所有参数有合理默认值，核心场景只需调用 `compactMessages()` 一个函数

## 快速开始

### 安装依赖

```bash
npm install
```

### 基本用法

```typescript
import { compactMessages, shouldCompact, AnthropicLlmClient, NodeFileWriter } from 'agent-context-compact';

const messages = [/* 你的消息列表 */];

// 检测是否需要压缩
if (await shouldCompact(messages)) {
  const result = await compactMessages(messages, {
    llmClient: new AnthropicLlmClient(),
    fileWriter: new NodeFileWriter(),
  });

  console.log(result.compacted);  // true
  console.log(result.stats);      // 压缩统计信息
  // result.messages 为压缩后的消息列表
}
```

### 环境变量配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `CONTEXT_TOKEN_LIMIT` | `200000` | 上下文 token 上限 |
| `COMPACT_THRESHOLD_RATIO` | `0.92` | 触发压缩的阈值比例 |
| `TAIL_RETENTION_RATIO` | `0.15` | 尾部保留的 token 比例 |
| `SUMMARY_MODEL` | `claude-haiku-4-5-20251001` | 用于生成摘要的模型 |
| `COMPACT_MAX_RETRIES` | `2` | LLM 调用失败最大重试次数 |
| `COMPACT_OUTPUT_DIR` | `.compact` | 原始消息持久化目录 |
| `ANTHROPIC_API_KEY` | — | Anthropic API 密钥 |
| `ANTHROPIC_BASE_URL` | — | Anthropic API 自定义 Base URL |

## 示例

`examples/` 目录提供了 4 个可直接运行的示例，覆盖从本地测试到真实 API 调用的完整场景：

| 示例 | 说明 | 命令 |
|------|------|------|
| 01-basic-compact | 基础压缩流程演示 | `npm run example:basic` |
| 02-multi-compact | 多次连续压缩演示 | `npm run example:multi` |
| 03-agent-loop-sim | 模拟 Agent Loop 长会话 | `npm run example:agent-loop` |
| 04-real-api-compact | 使用真实 Anthropic API | `npm run example:real-api` |

示例 01-03 使用 `MockLlmClient`，无需 API Key 即可本地运行。示例 04 需要设置 `ANTHROPIC_API_KEY`。

可通过环境变量调整测试参数：

```bash
# 降低 token 上限，更容易触发压缩
EXAMPLE_TOKEN_LIMIT=500 npm run example:agent-loop

# 使用真实 API
ANTHROPIC_API_KEY=sk-... EXAMPLE_TOKEN_LIMIT=2000 npm run example:real-api
```

## 项目结构

```
src/
├── index.ts                      # 公共 API 导出
├── core/
│   ├── types.ts                  # 类型定义与配置常量
│   ├── token-counter.ts          # Token 计数
│   ├── compact.ts                # 压缩主流程（分区、组装、重试）
│   └── summarizer.ts             # LLM 摘要生成
└── infrastructure/
    ├── llm-client.ts             # Anthropic SDK 实现
    └── file-writer.ts            # Node.js 文件写入实现

examples/
├── mock-llm-client.ts            # 本地 Mock LLM 客户端
├── message-factory.ts            # 测试消息生成工厂
├── 01-basic-compact.ts           # 基础压缩流程
├── 02-multi-compact.ts           # 多次连续压缩
├── 03-agent-loop-sim.ts          # Agent Loop 模拟
└── 04-real-api-compact.ts        # 真实 API 调用

tests/
├── core/                         # 核心逻辑单元测试
│   ├── compact.test.ts
│   ├── summarizer.test.ts
│   └── token-counter.test.ts
└── infrastructure/               # 基础设施集成测试
    ├── file-writer.test.ts
    └── llm-client.test.ts
```

## 开发命令

```bash
npm run build           # TypeScript 编译
npm test                # 运行所有测试
npm run test:unit       # 仅运行核心单元测试
npm run test:integration # 仅运行基础设施测试
npm run test:watch      # 监听模式
npm run test:coverage   # 测试覆盖率报告
npm run lint            # ESLint 检查
npm run lint:fix        # ESLint 自动修复
npm run dep-check       # 依赖关系检查
npm run check           # 完整检查（lint + dep-check + coverage + build）
```

## 技术栈

- **语言**: TypeScript 5.7+ / Node.js 18+
- **LLM SDK**: @anthropic-ai/sdk
- **测试**: Vitest
- **代码质量**: ESLint + dependency-cruiser

## 设计文档

- [PRD 需求文档](docs/requirements/2026-02-17-context-compact-prd.md)
- [架构设计](docs/architecture/architecture.md)
- [BDD 执行计划](docs/plans/bdd-execution-plan.md)
- [ADR 决策记录](docs/architecture/adr/)
