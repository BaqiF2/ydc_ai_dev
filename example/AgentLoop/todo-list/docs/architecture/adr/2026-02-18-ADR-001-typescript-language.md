# ADR-001: 使用 TypeScript 作为开发语言

## Status

Accepted

## Context

PRD §4.4 明确要求 TypeScript 支持，且项目定位为面向 AI Agent 开发学习者的教学示例。TypeScript 的类型系统能为工具 Schema 定义提供天然的类型安全和文档化能力。

**PRD Reference**: NFR-004, NFR-005

**Business Driver**: 教学示例需要类型安全和代码自文档化能力，帮助学习者理解工具接口定义

## Decision Drivers

- PRD §4.4 明确要求 TypeScript 支持
- 类型系统为工具 Schema 定义提供编译时校验
- 接口定义即文档，降低教学注释负担
- AI Agent 生态主流使用 TypeScript

## Considered Options

### Option A: TypeScript

| Dimension | Assessment |
|-----------|-----------|
| Performance | 编译后运行性能与 JavaScript 相同 |
| Learning Curve | 目标受众具备 TS/JS 基础（PRD §5.3） |
| Community & Ecosystem | 极其活跃，Agent 开发生态主流 |
| Operational Complexity | 需要编译工具链 |
| Cost | 免费开源 |
| Risk | 无显著风险 |

### Option B: JavaScript

| Dimension | Assessment |
|-----------|-----------|
| Performance | 直接运行，无编译开销 |
| Learning Curve | 更低的入门门槛 |
| Community & Ecosystem | 极其活跃 |
| Operational Complexity | 无编译步骤 |
| Cost | 免费开源 |
| Risk | 缺失类型安全，工具 Schema 与代码脱节 |

## Decision

**Chosen**: Option A — TypeScript

## Rationale

1. PRD §4.4 明确要求 TypeScript 支持，这是硬性约束
2. 类型接口可直接映射到工具 Schema 定义，展示"类型即 Schema"的教学理念
3. 目标受众已具备 TS 基础，不增加学习负担

## Consequences

### Positive
- 工具接口定义有编译时类型检查
- 代码自文档化程度高

### Negative
- 需要额外的 TS 编译/执行工具链 — 通过选择零配置工具（tsx）缓解

### Neutral
- 代码量可能略多于纯 JS（类型声明），但在 500 行限制内可控

## Validation

- [x] PRD 要求确认
- [x] 目标受众技能匹配确认
