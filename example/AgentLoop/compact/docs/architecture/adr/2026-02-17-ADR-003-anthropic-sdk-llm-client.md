# ADR-003: 使用 Anthropic SDK 进行 LLM 摘要调用

## Status

Accepted

## Context

Context Compact 需要通过独立 LLM 调用将历史消息生成结构化摘要。需要选择 LLM 客户端库。

**PRD Reference**: F-004, NFR-005

**Business Driver**: 摘要生成是压缩流程的核心步骤，需要可靠的 LLM 调用能力

## Decision Drivers

- 用户明确指定使用 Anthropic SDK
- PRD 要求模块不存储 API 凭证，通过调用方注入（NFR-005）
- PRD 要求支持重试机制（F-007）

## Considered Options

### Option A: `@anthropic-ai/sdk`

| Dimension | Assessment |
|-----------|-----------|
| Performance | 直连 Anthropic API，延迟最优 |
| Learning Curve | 官方 SDK，文档完善 |
| Community & Ecosystem | Anthropic 官方维护，TypeScript 原生支持 |
| Operational Complexity | 需管理 API key |
| Cost | API 调用按量计费 |
| Risk | 低 — 成熟稳定的 SDK |

## Decision

**Chosen**: Option A — `@anthropic-ai/sdk`

## Rationale

1. 用户明确指定使用 Anthropic SDK
2. 同时满足 Token 计数（ADR-002）和摘要生成两个需求，一个依赖解决两个问题
3. 官方 SDK，TypeScript 类型完善，与项目技术栈完美匹配

## Consequences

### Positive
- 单一 SDK 同时提供 Token 计数和 LLM 摘要调用能力
- 官方维护，API 变更时第一时间适配

### Negative
- 绑定 Anthropic API — 缓解：通过接口抽象，未来可扩展支持其他 LLM

### Neutral
- SDK 版本需与项目 Node.js 和 TypeScript 版本兼容
