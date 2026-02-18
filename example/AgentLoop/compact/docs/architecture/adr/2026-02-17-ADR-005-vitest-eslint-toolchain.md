# ADR-005: 使用 Vitest 3.x + ESLint 9.x 测试和代码质量工具链

## Status

Accepted

## Context

Context Compact 需要测试框架和代码质量工具，需与现有 Agent Loop 模块保持一致。

**PRD Reference**: NFR-008, NFR-010, NFR-011

**Business Driver**: 模块间一致性和高可测试性

## Decision Drivers

- 现有 context-offload 和 tool-direct-offload 均使用 Vitest 3.x + @vitest/coverage-v8 + ESLint 9.x + typescript-eslint 8.x
- PRD 要求核心函数可独立测试（NFR-011）
- 需要覆盖率报告支持

## Considered Options

### Option A: Vitest 3.x + ESLint 9.x + typescript-eslint 8.x

| Dimension | Assessment |
|-----------|-----------|
| Performance | Vitest 基于 Vite，启动和执行速度快 |
| Learning Curve | 与现有模块一致，零学习成本 |
| Community & Ecosystem | 活跃维护，TypeScript 原生支持 |
| Operational Complexity | 配置可从现有模块复用 |
| Cost | 零 |
| Risk | 无 — 已在现有模块验证 |

## Decision

**Chosen**: Option A — Vitest 3.x + ESLint 9.x + typescript-eslint 8.x

## Rationale

1. 与现有模块完全一致，可复用配置
2. Vitest 原生支持 TypeScript 和 ESM，无需额外配置
3. @vitest/coverage-v8 提供覆盖率报告

## Consequences

### Positive
- 开发者在三个模块间使用相同的测试和代码质量工具
- 配置文件可直接复用

### Negative
- 无显著负面影响

### Neutral
- 技术栈选择受约束
