# Tool Direct Offload — 技术栈确认文档

## Document Info
| Field | Value |
|-------|-------|
| Version | v1.0 |
| Created | 2026-02-17 |
| Status | Confirmed |
| PRD Reference | docs/requirements/2026-02-17-tool-direct-offload-prd.md |

## 1. 项目概况

学习/实验用途的 TypeScript 模块，实现 Agent Loop 中的工具结果直接卸载中间件。当工具返回结果超过阈值时，将内容写入文件并替换为路径引用。项目规模小，单模块，无外部服务依赖。

## 2. 技术栈总览

| 类别 | 选型 | 版本 | 备注 |
|------|------|------|------|
| 开发语言 | TypeScript | 5.x | 类型安全，学习友好 |
| 运行时 | Node.js | 18+ | LTS，原生支持 fs/promises |
| 构建工具 | tsc (TypeScript Compiler) | 5.x | 零额外依赖，直接编译 |
| 测试框架 | Vitest | latest | 原生 TypeScript 支持，速度快 |
| 覆盖率工具 | c8 (via Vitest) | built-in | Vitest 内置覆盖率 |
| 代码规范 | ESLint | 9.x | Flat config，TypeScript 支持 |
| 架构检查 | dependency-cruiser | latest | 依赖规则自动检查 |
| CI/CD | GitHub Actions | N/A | 标准 CI 流水线 |

## 3. 开发栈详情

### 3.1 语言与运行时

- **TypeScript 5.x**：严格模式启用，所有类型显式声明
- **Node.js 18+**：使用 `fs/promises` 和 `path` 标准库，无第三方运行时依赖

### 3.2 构建

- 使用 `tsc` 直接编译到 `dist/` 目录
- 目标：ES2022，模块系统：ESM (ES Modules)

## 4. 测试栈

| 测试类型 | 工具 | 说明 |
|----------|------|------|
| 单元测试 | Vitest | 核心逻辑测试，mock FileWriter |
| 集成测试 | Vitest | 真实文件系统读写验证 |
| 覆盖率 | c8 (Vitest built-in) | 行覆盖率 + 分支覆盖率 |

## 5. DevOps 栈

| 工具 | 用途 |
|------|------|
| ESLint 9.x | 代码规范检查 |
| dependency-cruiser | 架构依赖规则检查 |
| GitHub Actions | CI 流水线 |

## 6. Key Dependencies

| 依赖 | 类型 | 用途 |
|------|------|------|
| typescript | devDependency | TypeScript 编译器 |
| vitest | devDependency | 测试框架 |
| @vitest/coverage-v8 | devDependency | 覆盖率收集 |
| eslint | devDependency | 代码规范 |
| typescript-eslint | devDependency | ESLint TypeScript 支持 |
| dependency-cruiser | devDependency | 架构依赖检查 |

> 运行时零第三方依赖，仅使用 Node.js 标准库。

## 7. 架构概览

单模块简化架构，遵循 core/infrastructure 分离原则：

```
src/
  core/            # 纯业务逻辑（卸载算法、类型定义）
  infrastructure/  # 文件系统操作实现
  index.ts         # 公共 API 入口
```
