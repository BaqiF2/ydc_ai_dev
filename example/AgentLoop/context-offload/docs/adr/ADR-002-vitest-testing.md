# ADR-002: 选择 Vitest 作为测试框架

## 状态

ACCEPTED

## 日期

2026-02-17

## 上下文

需要选择测试框架来验证上下文卸载模块的功能正确性。主要考虑：TypeScript 原生支持、执行速度、学习成本。

## 决策

选择 Vitest 作为单元测试和集成测试框架。

## 理由

Vitest 原生支持 TypeScript（无需 ts-jest 等转译层），启动速度快，API 与 Jest 兼容（降低学习成本）。

### 备选方案

| 方案 | 优势 | 劣势 |
|------|------|------|
| Jest | 生态最成熟，社区资源丰富 | TypeScript 需要 ts-jest 或 SWC 转译 |
| Mocha + Chai | 灵活可组合 | 需要多个包配合，配置复杂 |
| **Vitest** | 原生 TypeScript、快速、Jest 兼容 API | 相对较新 |

## 后果

### 正面影响

- 零配置即可测试 TypeScript 代码
- 内置覆盖率支持（c8/v8）
- 与 Jest API 兼容，迁移成本低

### 负面影响

- 生态相比 Jest 稍小（对本项目无影响）

### 对测试的影响

- 单元测试：使用 vi.mock 模拟文件系统
- 集成测试：使用临时目录进行真实文件系统操作
- 覆盖率：使用 @vitest/coverage-v8 收集
