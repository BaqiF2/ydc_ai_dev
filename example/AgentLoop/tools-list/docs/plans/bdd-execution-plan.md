# BDD-Driven Development Execution Plan

> Generated: 2026-02-18
> PRD: `docs/requirements/2026-02-18-todo-list-tool-prd.md`
> Architecture: `docs/architecture.md`
> Tech Stack: `docs/architecture/2026-02-18-todo-list-tool-tech-stack.md`

## Project Context

| Item | Value |
|------|-------|
| Project | Todo-List Tool 教学示例 |
| Language | TypeScript 5.9.3 |
| Framework | N/A (纯 Node.js) |
| Build Tool | npm + tsx 4.21.0 |
| Test Framework | Vitest 4.0.18 |
| HTTP Mock | N/A (无外部 API) |
| Architecture Test | N/A (< 500 行项目) |
| Coverage Tool | @vitest/coverage-v8 |

## Command Cheat Sheet

```
Build:              npx tsc --noEmit
Test (all):         npx vitest run
Test (unit only):   npx vitest run
Test (integ only):  N/A
Test (e2e only):    N/A
Test (single):      npx vitest run <test-file>
Coverage:           npx vitest run --coverage
Source root:        src/
Test root:          tests/unit/
```

## Walking Skeleton Status

- [x] TypeScript 项目配置 (package.json, tsconfig.json, vitest.config.ts)
- [x] 类型定义 (src/types.ts — Todo, ToolDefinition, ToolResult 等)
- [x] 内存存储层 (src/store.ts — TodoStore CRUD)
- [x] 工具处理函数 (src/handlers.ts — 5 个 handler 工厂)
- [x] 工具 Schema 定义 (src/tools.ts — 5 个 JSON Schema)
- [x] 工具注册表 (src/registry.ts — ToolRegistry)
- [x] 入口组装 (src/index.ts — createTodoTools())
- [x] 单元测试套件 (tests/unit/ — 4 个测试文件, 60 个测试)
- [x] 所有 60 个测试通过

## Feature Execution Order

### Phase 0: Infrastructure Verification

> Walking skeleton 已完整实现所有功能。所有特性仅需验证现有测试覆盖 BDD 场景。

| # | Feature | Module | Scenarios | Status |
|---|---------|--------|-----------|--------|
| 1 | F-007 工具 Schema 定义 | tools.ts | 3 | Done |
| 2 | F-008 工具注册机制 | registry.ts | 3 | Done |
| 3 | F-009 结构化结果返回 | registry.ts + handlers.ts | 3 | Done |

### Phase 1: Must Features

| # | Feature | Module | Tool Name | Scenarios | Status |
|---|---------|--------|-----------|-----------|--------|
| 1 | F-001 创建任务 | handlers.ts | `create_todo` | 8 | Done |
| 2 | F-002 查询任务列表 | handlers.ts | `list_todos` | 2 | Done |
| 3 | F-003 查询单个任务 | handlers.ts | `get_todo` | 2 | Done |
| 4 | F-004 更新任务 | handlers.ts | `update_todo` | 9 | Done |
| 5 | F-005 删除任务 | handlers.ts | `delete_todo` | 4 | Done |
| 6 | F-006 任务状态管理 | handlers.ts | (update_todo) | 0 (含在 F-004) | Done |

### Phase 2: Should Features

无 Should 级别 BDD 特性。

### Phase 3: Could Features

无 Could 级别 BDD 特性。

**Total: 8 features (含基础设施), 34 BDD scenarios**

## Feature Dependencies

```
Phase 0 (基础设施)
  F-007 Schema 定义  ──┐
  F-008 工具注册    ──┤── 被所有 CRUD 功能依赖
  F-009 结构化返回  ──┘

Phase 1 (CRUD 功能)
  F-001 创建任务 ─── F-002 列表查询 (需要先有任务)
       │
       ├─── F-003 单个查询 (需要先有任务)
       │
       ├─── F-004 更新任务 (需要先有任务, 含 F-006 状态管理)
       │
       └─── F-005 删除任务 (需要先有任务)
```

**Key dependency:** F-001 创建任务是所有其他 CRUD 操作的基础前提。

## BDD Review Notes

1. **F-007 工具 Schema** — 验证 5 个工具 Schema 结构、参数类型和枚举值定义。完整且无歧义。
2. **F-008 工具注册** — 验证注册、查找、列表获取功能。完整且无歧义。
3. **F-009 结构化返回** — 验证成功/失败格式统一性和无异常抛出。完整且无歧义。
4. **F-001 创建任务** — 8 个场景覆盖正常流、空标题、超长标题/描述、边界值。完整且无歧义。
5. **F-002 查询列表** — 2 个场景覆盖空列表和多任务排序。完整且无歧义。
6. **F-003 查询单个** — 2 个场景覆盖存在/不存在 ID。完整且无歧义。
7. **F-004 更新任务** — 9 个场景覆盖单字段/多字段更新、状态转换、错误处理。完整且无歧义。
8. **F-005 删除任务** — 4 个场景覆盖成功删除、删除后验证、不存在 ID。完整且无歧义。

9. **No contradictions or blockers found between BDD scenarios and PRD.**

## Per-Feature Development Cycle

每个 feature 按 BDD-guided TDD 执行：

```
1. RED    — Translate BDD scenarios to failing tests
2. GREEN  — Write minimal production code to pass
3. REFACTOR — Clean up while tests pass
4. VERIFY — Confirm all BDD scenarios covered
5. COMMIT — One atomic commit per feature
6. REPORT — Progress summary, then next feature
```

## Layered Implementation Order

本项目采用扁平单模块架构，无严格分层。实现顺序按依赖关系：

```
1. types.ts      — 纯类型定义（无依赖）
2. store.ts      — 内存存储（依赖 types）
3. tools.ts      — Schema 定义（依赖 types）
4. registry.ts   — 注册表（依赖 types）
5. handlers.ts   — 业务逻辑（依赖 types + store）
6. index.ts      — 入口组装（依赖所有模块）
```

## Test Classification Rules

| BDD `given` Pattern | Test Type | Location |
|---------------------|-----------|----------|
| 内存存储中的任务状态 | Unit test | `tests/unit/*.test.ts` |
| 工具注册表状态 | Unit test | `tests/unit/registry.test.ts` |
| Schema 定义结构 | Unit test | `tests/unit/tools.test.ts` |

> 本项目为教学示例，所有 BDD 场景均为纯业务逻辑测试，无外部依赖，全部分类为 Unit test。
> 无需 E2E smoke test（无协议层/服务端，纯工具库）。

### E2E Test Environment Requirements

E2E tests are self-contained — no external environment setup required. (本项目为纯工具库，无服务端协议层)

## Coverage Targets

| Module | Line Coverage | Branch Coverage |
|--------|--------------|-----------------|
| store.ts | >= 80% | >= 70% |
| handlers.ts | >= 80% | >= 70% |
| tools.ts | >= 60% | >= 50% |
| registry.ts | >= 80% | >= 70% |
| Overall | >= 80% | >= 70% |

## Progress Log

> Append-only log. Each entry records a feature status change during the development cycle.

| Feature | From | To | Note |
|---------|------|----|------|
| F-007 工具 Schema 定义 | Pending | Done | Walking skeleton 已实现, 9 tests passing |
| F-008 工具注册机制 | Pending | Done | Walking skeleton 已实现, 10 tests passing |
| F-009 结构化结果返回 | Pending | Done | Walking skeleton 已实现, tests in registry.test.ts |
| F-001 创建任务 | Pending | Done | Walking skeleton 已实现, 8/8 BDD scenarios covered |
| F-002 查询任务列表 | Pending | Done | Walking skeleton 已实现, 2/2 BDD scenarios covered |
| F-003 查询单个任务 | Pending | Done | Walking skeleton 已实现, 2/2 BDD scenarios covered |
| F-004 更新任务 | Pending | Done | Walking skeleton 已实现, 9/9 BDD scenarios covered |
| F-005 删除任务 | Pending | Done | Walking skeleton 已实现, 4/4 BDD scenarios covered |
| All Features | In Progress | Final Verification | Running Step 8 batch verification |
| All Features | Final Verification | Done | All 34 BDD scenarios pass, coverage exceeds thresholds, BDD JSON updated |

## Final Verification Checklist

- [x] All 34 BDD scenarios have corresponding tests
- [x] All unit tests pass (60/60)
- [x] Coverage meets thresholds (97.77% stmts, 96.55% branches, 100% funcs, 97.43% lines)
- [x] TypeScript type check passes (zero errors)
- [x] BDD JSON files updated (`passes: true`, `overallPass: true`)
- [x] All commits follow Conventional Commits format
