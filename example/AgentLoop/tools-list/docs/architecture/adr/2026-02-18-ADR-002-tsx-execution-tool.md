# ADR-002: 使用 tsx 作为 TypeScript 执行工具

## Status

Accepted

## Context

项目需要一个 TypeScript 编译/执行工具来运行 .ts 文件。作为教学示例，需要优先考虑零配置、兼容性和简洁性。

**PRD Reference**: NFR-001, NFR-004, NFR-005, NFR-006

**Business Driver**: 教学示例需要最简化的工具链，让学习者聚焦工具机制而非构建配置

## Decision Drivers

- 教学简洁性：零配置或最少配置（NFR-001）
- Node.js 18+ 兼容（NFR-004）
- 完整 TypeScript 语法支持（NFR-005）
- 依赖最少化（NFR-006）

## Considered Options

### Option A: tsx (4.21.0)

| Dimension | Assessment |
|-----------|-----------|
| Performance | esbuild 驱动，编译极快 |
| Learning Curve | 零配置，`tsx file.ts` 直接运行 |
| Community & Ecosystem | npm 周下载量百万级，活跃维护 |
| Operational Complexity | 极低，单个 devDependency |
| Cost | 免费开源 (MIT) |
| Risk | 低 — 成熟稳定 |

### Option B: Node.js 原生 TypeScript (25.x)

| Dimension | Assessment |
|-----------|-----------|
| Performance | 类型剥离，启动极快 |
| Learning Curve | 零安装，但需理解 erasable types 限制 |
| Community & Ecosystem | Node.js 内置，但文档和示例较少 |
| Operational Complexity | 极低，但需 Node 25+ |
| Cost | 免费 |
| Risk | 中 — 要求 Node 25+，大幅缩小兼容范围；不支持 enum 等语法 |

### Option C: tsc + node

| Dimension | Assessment |
|-----------|-----------|
| Performance | 编译较慢，但运行性能好 |
| Learning Curve | 需要配置 tsconfig.json 和两步编译流程 |
| Community & Ecosystem | 最经典的方案 |
| Operational Complexity | 中等 — 需要管理编译输出目录 |
| Cost | 免费开源 |
| Risk | 低 — 最稳定的方案，但配置复杂度与教学目标冲突 |

## Decision

**Chosen**: Option A — tsx (4.21.0)

## Rationale

1. 零配置直接运行 TS 文件，教学简洁性最佳（加权得分 84，领先第二名 17 分）
2. 兼容 Node.js 18+，覆盖最广泛的学习者环境
3. 完整支持所有 TypeScript 语法，无需学习者关注语法限制
4. 虽然引入一个 devDependency，但对教学目标影响极小

## Consequences

### Positive
- 学习者 `npm install` 后即可运行，无额外配置
- 完整 TypeScript 支持，教学代码不受语法限制

### Negative
- 引入一个外部依赖（tsx）— 作为 devDependency 可接受
- 不是 Node.js 内置工具 — 但在 Node 25 普及之前这是最佳折中

### Neutral
- 未来可平滑迁移到 Node.js 原生 TS 支持

## Validation

- [x] Trade-off 矩阵评分完成
- [x] 用户确认选型
