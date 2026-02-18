# 测试框架 Trade-off Matrix

**PRD Reference**: NFR-002, NFR-005, NFR-001

**Decision Domain**: Testing Framework

## Evaluation Criteria

| Criterion ID | Criterion | Weight (1-5) | Source (PRD Ref) | Description |
|-------------|-----------|--------------|-----------------|-------------|
| C-01 | 教学简洁性 | 5 | NFR-001, NFR-002 | 零配置或最少配置即可运行 TS 测试 |
| C-02 | TypeScript 原生支持 | 5 | NFR-005 | 无需额外转换器/适配器即可测试 TS 文件 |
| C-03 | 执行速度 | 3 | NFR-002 | 测试执行快速，提升开发体验 |
| C-04 | 社区认知度 | 3 | NFR-007 | 学习者对框架的熟悉度 |
| C-05 | API 友好性 | 3 | NFR-001 | API 简洁易懂，降低学习成本 |

## Scoring Matrix

| Criterion | Weight | Vitest (4.0.18) | Jest (30.x) + ts-jest |
|-----------|--------|----------------|----------------------|
| C-01 教学简洁性 | 5 | 5 | 3 |
| C-02 TS 原生支持 | 5 | 5 | 3 |
| C-03 执行速度 | 3 | 5 | 3 |
| C-04 社区认知度 | 3 | 4 | 5 |
| C-05 API 友好性 | 3 | 5 | 4 |
| **Weighted Total** | | **92** | **65** |

## Scoring Justification

### Vitest (4.0.18)
- C-01 scored 5: 几乎零配置，内置 TS 支持
- C-02 scored 5: 基于 esbuild，原生处理 TypeScript
- C-03 scored 5: esbuild 驱动，执行速度极快
- C-04 scored 4: 快速增长，已成为现代 TS 项目的新标准
- C-05 scored 5: API 兼容 Jest，学习者无需额外学习

### Jest (30.x) + ts-jest
- C-01 scored 3: 需要安装和配置 ts-jest 转换器
- C-02 scored 3: 需要 ts-jest 或 @swc/jest 等中间件
- C-03 scored 3: TS 项目中执行较慢
- C-04 scored 5: 最广泛认知的测试框架
- C-05 scored 4: 成熟稳定的 API

## Result

**Recommended option**: Vitest (4.0.18) with weighted total of 92

**Key differentiator**: 原生 TypeScript 支持和零配置的完美组合

**Caveats**: 认知度略低于 Jest，但 API 完全兼容，转换成本极低

## Decision

- [x] Matrix reviewed
- [x] Scores validated
- [x] Result accepted → proceed to ADR documentation
