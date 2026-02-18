# ADR-003: 使用 Vitest 作为测试框架

## Status

Accepted

## Context

项目需要一个测试框架来验证 todo-list 工具的功能正确性。作为教学示例，需要优先考虑 TypeScript 原生支持和零配置能力。

**PRD Reference**: NFR-001, NFR-002, NFR-005

**Business Driver**: 教学示例需要 `npm test` 一键运行，且测试代码本身也是教学内容的一部分

## Decision Drivers

- TypeScript 原生支持，无需额外适配器（NFR-005）
- `npm install && npm test` 一键可用（NFR-002）
- 教学简洁性（NFR-001）
- 测试执行速度快，提升学习体验

## Considered Options

### Option A: Vitest (4.0.18)

| Dimension | Assessment |
|-----------|-----------|
| Performance | esbuild 驱动，极快 |
| Learning Curve | 零配置 TS 支持，API 兼容 Jest |
| Community & Ecosystem | 快速增长，已成现代 TS 项目新标准 |
| Operational Complexity | 极低，内置 TS 支持 |
| Cost | 免费开源 (MIT) |
| Risk | 低 — 活跃维护，版本 4.0 已稳定 |

### Option B: Jest (30.x) + ts-jest

| Dimension | Assessment |
|-----------|-----------|
| Performance | TS 项目中较慢 |
| Learning Curve | 需配置 ts-jest 转换器 |
| Community & Ecosystem | 最广泛认知的测试框架 |
| Operational Complexity | 中等 — 需 jest.config + ts-jest 配置 |
| Cost | 免费开源 |
| Risk | 低 — 成熟稳定，但 TS 支持需依赖第三方 |

## Decision

**Chosen**: Option A — Vitest (4.0.18)

## Rationale

1. 原生 TypeScript 支持，零配置即可测试 .ts 文件（加权得分 92，领先 Jest 27 分）
2. esbuild 驱动的极快执行速度，提升教学体验
3. API 完全兼容 Jest（describe/it/expect），学习者可平滑迁移
4. 与 tsx（同为 esbuild 驱动）在技术栈上保持一致性

## Consequences

### Positive
- 零配置 TypeScript 测试，教学代码不需要额外的框架适配
- 极快的测试执行速度
- API 兼容 Jest，教学知识可迁移

### Negative
- 社区认知度略低于 Jest — 但正快速增长，且 API 兼容性消除了迁移障碍

### Neutral
- 与 tsx 同属 esbuild 生态，工具链一致

## Validation

- [x] Trade-off 矩阵评分完成
- [x] 用户确认选型
