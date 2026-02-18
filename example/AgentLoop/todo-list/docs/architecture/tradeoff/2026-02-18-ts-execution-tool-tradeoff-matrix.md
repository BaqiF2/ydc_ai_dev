# TypeScript 执行工具 Trade-off Matrix

**PRD Reference**: NFR-004, NFR-005, NFR-006, NFR-001

**Decision Domain**: TypeScript Compilation / Execution Tool

## Evaluation Criteria

| Criterion ID | Criterion | Weight (1-5) | Source (PRD Ref) | Description |
|-------------|-----------|--------------|-----------------|-------------|
| C-01 | 教学简洁性 | 5 | NFR-001, NFR-007 | 零配置或最少配置即可运行 TS 文件 |
| C-02 | 依赖最少化 | 4 | NFR-006 | 尽量减少外部依赖 |
| C-03 | 环境兼容性 | 4 | NFR-004 | 兼容 Node.js 18+ |
| C-04 | TS 特性支持 | 3 | NFR-005 | 支持完整的 TypeScript 语法 |
| C-05 | 社区认知度 | 3 | NFR-007 | 教学示例应使用学习者熟悉的工具 |

## Scoring Matrix

| Criterion | Weight | tsx (4.21.0) | Node.js 原生 TS (25.x) | tsc + node |
|-----------|--------|-------------|----------------------|------------|
| C-01 教学简洁性 | 5 | 5 | 4 | 2 |
| C-02 依赖最少化 | 4 | 3 | 5 | 3 |
| C-03 环境兼容性 | 4 | 5 | 2 | 5 |
| C-04 TS 特性支持 | 3 | 5 | 3 | 5 |
| C-05 社区认知度 | 3 | 4 | 3 | 4 |
| **Weighted Total** | | **84** | **67** | **65** |

## Scoring Justification

### tsx (4.21.0)
- C-01 scored 5: 零配置，直接 `tsx file.ts` 即可运行
- C-02 scored 3: 需安装 tsx 包作为 devDependency
- C-03 scored 5: 支持 Node.js 18+
- C-04 scored 5: 完整支持包括 enum、装饰器等 TS 语法
- C-05 scored 4: 广泛使用，快速增长中

### Node.js 原生 TS (25.x)
- C-01 scored 4: 零安装，但需 Node 25+ 且有语法限制
- C-02 scored 5: 零外部依赖
- C-03 scored 2: 要求 Node.js 25+，大幅缩小学习者兼容范围
- C-04 scored 3: 不支持 enum、装饰器等非可擦除语法
- C-05 scored 3: 较新特性，文档和示例较少

### tsc + node
- C-01 scored 2: 需要 tsconfig.json 配置和两步编译流程
- C-02 scored 3: 需安装 typescript 包
- C-03 scored 5: 支持所有 Node.js 版本
- C-04 scored 5: 完整 TypeScript 支持
- C-05 scored 4: 经典方案，广为人知

## Result

**Recommended option**: tsx (4.21.0) with weighted total of 84

**Key differentiator**: 零配置和 Node 18+ 兼容性的完美平衡

**Caveats**: 引入一个 devDependency，但对教学影响极小

## Decision

- [x] Matrix reviewed
- [x] Scores validated
- [x] Result accepted → proceed to ADR documentation
