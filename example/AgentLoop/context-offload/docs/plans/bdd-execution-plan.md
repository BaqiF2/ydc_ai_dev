# BDD 执行计划

## 文档信息

| 项目 | 值 |
|------|-----|
| 生成日期 | 2026-02-17 |
| PRD 文件 | docs/requirements/2026-02-17-context-offload-prd.md |
| 架构文档 | docs/architecture.md |
| 技术栈文档 | docs/tech-stack.md |
| BDD 目录 | docs/requirements/2026-02-17-context-offload-bdd/ |

## 项目上下文

| 配置项 | 值 |
|--------|-----|
| 语言 | TypeScript 5.x |
| 运行时 | Node.js 18+ |
| 构建工具 | tsc |
| 测试框架 | Vitest |
| Mock 工具 | Vitest 内置（vi.mock） |
| 覆盖率工具 | @vitest/coverage-v8 (c8) |

## 命令备忘

```
Build:          npx tsc -p tsconfig.build.json
Test (all):     npx vitest run
Test (unit):    npx vitest run tests/unit
Test (integ):   npx vitest run tests/integration
Test (single):  npx vitest run <test-file>
Coverage:       npx vitest run --coverage
Lint:           npx eslint src/ tests/
Dep check:      npx depcruise src --config .dependency-cruiser.cjs
```

## Walking Skeleton 状态

Walking Skeleton 阶段已经实现了完整的业务逻辑作为技术验证：

- [x] 类型定义 (`src/core/types.ts`)
- [x] 核心卸载算法 (`src/core/offload.ts`)
- [x] 文件写入实现 (`src/infrastructure/file-writer.ts`)
- [x] 公共 API 入口 (`src/index.ts`)
- [x] 单元测试 (10 tests)
- [x] 集成测试 (3 tests)
- [x] 基础设施测试 (2 tests)
- [x] ESLint 零错误
- [x] dependency-cruiser 零违规
- [x] 覆盖率 100%
- [x] TypeScript 编译通过

## 特性执行顺序

### Phase 1: Must 级别特性

| 序号 | Feature | BDD Feature | 模块 | 场景数 | 状态 |
|------|---------|-------------|------|--------|------|
| 1 | F-001 tool_result 内容卸载 | tool-result-offload | core | 9 | Done |
| 2 | F-002 字符数阈值过滤 | (包含在 tool-result-offload 中) | core | (含在F-001中) | Done |
| 3 | F-003 消息路径引用替换 | (包含在 tool-result-offload 中) | core | (含在F-001中) | Done |
| 4 | F-005 自动创建输出目录 | output-directory-management | infrastructure | 3 | Done |

### Phase 2: Should 级别特性

| 序号 | Feature | BDD Feature | 模块 | 场景数 | 状态 |
|------|---------|-------------|------|--------|------|
| 5 | F-004 卸载结果统计 | (包含在 tool-result-offload 中) | core | (含在F-001中) | Done |

### 说明

BDD 文件按两个 feature 组织：
1. **tool-result-offload**（9 个场景）：覆盖 F-001、F-002、F-003、F-004
2. **output-directory-management**（3 个场景）：覆盖 F-005

由于实现已在 Walking Skeleton 中完成，本执行计划的重点是 **BDD 验证**——确认现有测试 1:1 覆盖所有 BDD 场景。

## BDD → 测试映射

### Feature: tool-result-offload (9 scenarios)

| BDD 场景 | 测试类型 | 测试方法 | 映射状态 |
|----------|---------|---------|---------|
| 卸载字符数 ≥ 100 的 string 类型 tool_result | unit | offload.test.ts → `should offload string tool_result with charCount >= 100` | ✅ 映射完成 |
| 跳过字符数 < 100 的 tool_result | unit | offload.test.ts → `should skip tool_result with charCount < 100` | ✅ 映射完成 |
| 边界值 — 恰好 100 字符应卸载 | unit | offload.test.ts → `should offload tool_result with exactly 100 chars (boundary)` | ✅ 映射完成 |
| 边界值 — 99 字符不应卸载 | unit | offload.test.ts → `should NOT offload tool_result with 99 chars (boundary)` | ✅ 映射完成 |
| 卸载 ContentBlock[] 类型的 tool_result | unit | offload.test.ts → `should offload ContentBlock[] tool_result using JSON.stringify length` | ✅ 映射完成 |
| 空消息数组 | unit | offload.test.ts → `should return empty result for empty messages` | ✅ 映射完成 |
| 无 tool_result 的消息 | unit | offload.test.ts → `should pass through messages without tool_result` | ✅ 映射完成 |
| 混合场景 — 部分卸载 | unit | offload.test.ts → `should handle mixed scenario — partial offload` | ✅ 映射完成 |
| 不修改原始输入数组 | unit | offload.test.ts → `should not modify original messages array` | ✅ 映射完成 |

### Feature: output-directory-management (3 scenarios)

| BDD 场景 | 测试类型 | 测试方法 | 映射状态 |
|----------|---------|---------|---------|
| 自动创建不存在的输出目录 | integration | offload.integration.test.ts → `should auto-create nested output directories` | ✅ 映射完成 |
| 已存在的输出目录不报错 | integration | offload.integration.test.ts → `should write offload file to disk and replace content` | ✅ 映射完成 |
| tool_use_id 重复时文件名追加序号 | unit | offload.test.ts → `should handle duplicate tool_use_id with suffix` | ✅ 映射完成 |

## BDD 审查注意事项

- 无矛盾或歧义发现
- 所有 BDD 场景均可映射到现有测试
- 测试断言覆盖了 BDD `then` 步骤中的所有验证点

## 分层实现顺序

```
core (types.ts, offload.ts) → infrastructure (file-writer.ts) → index.ts (组装)
```

已在 Walking Skeleton 中完成。

## 覆盖率目标

| 模块 | 目标行覆盖率 | 实际行覆盖率 |
|------|------------|------------|
| core | ≥ 80% | 100% |
| infrastructure | ≥ 50% | 100% |
| 整体 | ≥ 70% | 100% |

## 进度日志

| Feature | 原状态 | 新状态 | 备注 |
|---------|--------|--------|------|
| F-001 tool_result 内容卸载 | Pending | Done | 9/9 scenarios verified |
| F-002 字符数阈值过滤 | Pending | Done | 含在 F-001 测试中 |
| F-003 消息路径引用替换 | Pending | Done | 含在 F-001 测试中 |
| F-004 卸载结果统计 | Pending | Done | 含在 F-001 测试中 |
| F-005 自动创建输出目录 | Pending | Done | 3/3 scenarios verified |

## 最终验证清单

- [x] 所有单元测试通过 (12/12)
- [x] 所有集成测试通过 (3/3)
- [x] 覆盖率达到阈值 (100% > 70%)
- [x] ESLint 零错误
- [x] dependency-cruiser 零违规
- [x] TypeScript 编译零错误
- [x] 所有 BDD 场景 passes 更新为 true (12/12)
- [x] 所有 BDD feature overallPass 更新为 true (2/2)
