# ADR-002: 使用 Anthropic SDK countTokens API 进行 Token 计数

## Status

Accepted

## Context

Context Compact 需要精确计算消息列表的 token 数量以判断是否触发压缩。Claude 3+ 模型的分词器与早期版本不同，现有本地分词库（如 `@anthropic-ai/tokenizer`）已不再准确。

**PRD Reference**: F-001, NFR-001

**Business Driver**: Token 计数精度直接影响压缩触发时机的准确性

## Decision Drivers

- PRD 要求精确计算 token 数（F-001）
- `@anthropic-ai/tokenizer` 官方包已 3 年未更新，明确声明对 Claude 3+ 不准确
- 社区分词库精度未经验证
- 项目已引入 Anthropic SDK 用于 LLM 摘要调用
- Anthropic SDK 提供 `client.messages.countTokens()` API，与最新模型 100% 一致

## Considered Options

### Option A: Anthropic SDK `countTokens` API

| Dimension | Assessment |
|-----------|-----------|
| Performance | 需网络往返 ~200-500ms，每轮 Agent Loop 调用一次 |
| Learning Curve | 已使用 Anthropic SDK，无额外学习 |
| Community & Ecosystem | Anthropic 官方维护，持续更新 |
| Operational Complexity | 需网络连接，但 Agent Loop 本身就需要网络 |
| Cost | 计入 API 调用量，但 countTokens 不消耗推理 token |
| Risk | 网络延迟可能接近 500ms 阈值 |

### Option B: `@anthropic-ai/tokenizer` 本地分词库

| Dimension | Assessment |
|-----------|-----------|
| Performance | 本地计算 ~10ms，极快 |
| Learning Curve | 简单 API |
| Community & Ecosystem | 3 年未更新，v0.0.4，已停止维护 |
| Operational Complexity | 离线可用 |
| Cost | 零成本 |
| Risk | 对 Claude 3+ 模型不准确，可能导致压缩时机错误 |

### Option C: `@lenml/tokenizer-claude` 社区分词库

| Dimension | Assessment |
|-----------|-----------|
| Performance | 本地计算 ~10ms，极快 |
| Learning Curve | 简单 API |
| Community & Ecosystem | 社区维护，v3.7.2，5 个月前更新 |
| Operational Complexity | 离线可用 |
| Cost | 零成本 |
| Risk | 精度未经官方验证，长期维护不确定 |

## Decision

**Chosen**: Option A — Anthropic SDK `countTokens` API

## Rationale

1. 精度是 token 计数的核心要求 — 不准确的计数会导致压缩过早（浪费上下文）或过晚（API 调用失败）
2. 项目已引入 Anthropic SDK，无额外依赖
3. Agent Loop 每轮本身就需要 API 调用，额外一次 countTokens 的网络开销可接受
4. 本地分词库对 Claude 3+ 均存在精度问题，无法满足"精确计算"要求

## Consequences

### Positive
- 100% 精确的 token 计数，与 Anthropic API 实际消耗完全一致
- 无额外依赖，复用已有 SDK
- 自动跟随模型更新，无需手动升级分词库

### Negative
- 每次计数需要网络调用，延迟 ~200-500ms — 缓解：每轮仅调用一次，可接受
- 离线环境无法使用 — 缓解：Agent Loop 本身就需要网络

### Neutral
- countTokens API 不消耗推理 token，但计入 API 调用次数
