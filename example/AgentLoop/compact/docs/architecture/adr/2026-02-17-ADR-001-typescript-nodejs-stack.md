# ADR-001: 使用 TypeScript + Node.js 18+ 技术栈

## Status

Accepted

## Context

Context Compact 是 Agent Loop 系列中的第三个上下文管理模块，需要与 context-offload 和 tool-direct-offload 保持技术栈一致性。

**PRD Reference**: NFR-008, NFR-009, NFR-010

**Business Driver**: 模块间一致性和可组合性

## Decision Drivers

- 现有 context-offload 和 tool-direct-offload 模块均使用 TypeScript + Node.js 18+ + ES2022 + Node16 模块系统
- PRD 明确要求与现有模块兼容（NFR-010）
- PRD 要求 Node.js >= 18 和 TypeScript >= 5.0（NFR-008, NFR-009）

## Considered Options

### Option A: TypeScript 5.7+ / Node.js 18+ / ES2022 / Node16 Module

| Dimension | Assessment |
|-----------|-----------|
| Performance | ES2022 target 提供现代 JS 特性，运行效率高 |
| Learning Curve | 与现有模块完全一致，零学习成本 |
| Community & Ecosystem | TypeScript 生态成熟，社区活跃 |
| Operational Complexity | 与现有模块共享构建和部署流程 |
| Cost | 无额外许可费用 |
| Risk | 无 — 已在现有模块验证 |

### Option B: 其他语言/运行时

不适用 — 被现有模块技术栈约束排除。

## Decision

**Chosen**: Option A — TypeScript 5.7+ / Node.js 18+ / ES2022 / Node16 Module

## Rationale

1. 与现有 context-offload 和 tool-direct-offload 模块保持完全一致，便于未来组合和统一维护
2. 团队已有该技术栈的经验，无额外学习成本
3. PRD 明确要求兼容性（NFR-008, NFR-009, NFR-010）

## Consequences

### Positive
- 三个模块共享相同的构建配置、测试框架和代码风格
- 开发者可以在模块间无缝切换

### Negative
- 无显著负面影响

### Neutral
- 技术栈选择受约束，无需额外评估
