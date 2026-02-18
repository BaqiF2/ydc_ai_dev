# ADR-005: 使用 npm 作为包管理器

## Status

Accepted

## Context

PRD §4.3 中指定了 `npm install && npm test` 作为一键运行命令，隐含了 npm 作为包管理器的选择。

**PRD Reference**: NFR-002

**Business Driver**: 教学示例需要使用最广泛、最标准化的工具链

## Decision Drivers

- PRD 隐含使用 npm（`npm install && npm test`）
- Node.js 内置，零额外安装
- 学习者最熟悉的包管理器

## Considered Options

### Option A: npm

| Dimension | Assessment |
|-----------|-----------|
| Performance | 足够，项目依赖极少 |
| Learning Curve | Node.js 内置，所有学习者已熟悉 |
| Community & Ecosystem | 最大的 Node.js 包管理器 |
| Operational Complexity | 零额外安装 |
| Cost | 免费 |
| Risk | 无 |

## Decision

**Chosen**: Option A — npm

## Rationale

1. PRD 隐含要求
2. Node.js 内置，零额外安装步骤
3. 教学示例使用最标准化工具链

## Consequences

### Positive
- 学习者无需额外安装任何包管理器

### Negative
- 无

### Neutral
- 项目依赖极少（仅 devDependencies），包管理器差异影响可忽略

## Validation

- [x] PRD 约束确认
