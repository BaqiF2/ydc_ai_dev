# ADR-004: 使用内存存储（Map）作为数据存储方案

## Status

Accepted

## Context

PRD §5.1 明确要求仅使用内存存储，会话结束数据消失。作为教学示例，存储方案需要最简化以聚焦工具机制教学。

**PRD Reference**: PRD §5.1, NFR-006

**Business Driver**: 教学目标是展示 agent loop 工具的状态管理，而非持久化存储设计

## Decision Drivers

- PRD 明确排除持久化存储（硬约束）
- 零外部依赖（NFR-006）
- 代码简洁性（NFR-001）

## Considered Options

### Option A: JavaScript Map

| Dimension | Assessment |
|-----------|-----------|
| Performance | O(1) 查找，内存中最优 |
| Learning Curve | JavaScript 内置，学习者已熟悉 |
| Community & Ecosystem | 语言标准，无需额外依赖 |
| Operational Complexity | 零 |
| Cost | 零 |
| Risk | 无 |

## Decision

**Chosen**: Option A — JavaScript Map

## Rationale

1. PRD 硬性约束：仅使用内存存储
2. Map 提供 O(1) 的 get/set/delete 操作，完美匹配 CRUD 场景
3. 零依赖，零配置
4. 学习者可直观理解工具的状态管理本质

## Consequences

### Positive
- 极简实现，学习者可聚焦工具机制
- 零依赖

### Negative
- 会话结束数据消失 — PRD 已明确接受此约束

### Neutral
- 未来如需持久化，可抽象存储接口替换实现

## Validation

- [x] PRD 约束确认
