# BDD-Driven Development Execution Plan

> Generated: 2026-02-17
> PRD: `docs/requirements/2026-02-17-tool-direct-offload-prd.md`
> Architecture: `docs/architecture.md`
> Tech Stack: `docs/tech-stack.md`

## Project Context

| Item | Value |
|------|-------|
| Project | tool-direct-offload |
| Language | TypeScript 5.x |
| Framework | Node.js 18+ (no framework, pure library) |
| Build Tool | tsc (TypeScript Compiler) |
| Test Framework | Vitest 3.x |
| HTTP Mock | N/A (no HTTP calls) |
| Architecture Test | dependency-cruiser |
| Coverage Tool | @vitest/coverage-v8 |

## Command Cheat Sheet

```
Build:              npm run build
Test (all):         npm test
Test (unit only):   npm run test:unit
Test (integ only):  npm run test:integration
Test (e2e only):    N/A (library module, no protocol layer)
Test (single):      npx vitest run <test-file>
Coverage:           npm run test:coverage
Lint:               npm run lint
Dep check:          npm run dep-check
Full check:         npm run check
Source root:        src/
Test root:          tests/
```

## Walking Skeleton Status

- [x] Core type definitions (`src/core/types.ts` — Message, ContentBlock, FileWriter, OffloadResult)
- [x] Core offload algorithm (`src/core/offload.ts` — offloadToolResult with serialize/clone/reference)
- [x] NodeFileWriter infrastructure (`src/infrastructure/file-writer.ts` — mkdir + writeFile)
- [x] Public API entry point (`src/index.ts` — convenient API + re-exports)
- [x] Unit tests: 9 tests for core offload + 2 tests for file-writer (all passing)
- [x] Integration tests: 3 tests for public API (all passing)
- [x] ESLint configuration (strict TypeScript)
- [x] dependency-cruiser configuration (4 rules)
- [x] Vitest configuration with coverage thresholds
- [x] CI pipeline (GitHub Actions, Node 18/20/22)
- [x] TypeScript build configuration

> **Note:** Walking skeleton already contains full feature implementation and tests from the architecture-init phase. BDD development phase focuses on **verifying existing tests cover all BDD scenarios** and formally marking them as passing.

## Feature Execution Order

### Phase 0: Infrastructure Verification

> Walking skeleton already provides full implementation. Verify test-to-BDD scenario mapping is complete.

| # | Feature | PRD ID | Module | Scenarios | Status |
|---|---------|--------|--------|-----------|--------|
| 0.1 | Tool Result 文件卸载 | F-001 | core/offload | 3 | Pending |
| 0.2 | 文件路径生成 | F-002 | core/offload + infrastructure/file-writer | 3 | Pending |
| 0.3 | 不可变消息处理 | F-003 | core/offload | 2 | Pending |
| 0.4 | 错误处理 | F-001 (error) | core/offload | 2 | Pending |
| 0.5 | 释放字符数计算 | F-001 (output) | core/offload | 2 | Pending |

### Phase 1: Must Features

> No additional Must features — all covered in Phase 0.

(empty)

### Phase 2: Should Features

| # | Feature | PRD ID | Module | Scenarios | Status |
|---|---------|--------|--------|-----------|--------|
| 2.1 | 便捷 API | F-004 | index.ts (public API) | 1 | Pending |

### Phase 3: Could Features

(empty)

**Total: 6 features, 13 BDD scenarios**

## Feature Dependencies

```
Phase 0 (all from walking skeleton):

  F-001 Tool Result 文件卸载
    ├── 错误处理 (F-001 error scenarios)
    └── 释放字符数计算 (F-001 output spec)

  F-002 文件路径生成
    └── depends on F-001 core function (same function)

  F-003 不可变消息处理
    └── depends on F-001 core function (same function)

Phase 2:

  F-004 便捷 API
    └── depends on F-001 + F-002 + F-003 (wraps core function)
```

**Key dependency:** All features share the same `offloadToolResult` function — F-001 is the foundation.

## BDD Review Notes

1. **F-001 Tool Result 文件卸载** — string content uses `tool_use_id` = 'unknown' (no tool_result block in content to extract from). ContentBlock[] extracts tool_use_id from first tool_result block. Complete and unambiguous.
2. **F-002 文件路径生成** — Path format is `<outputDir>/<sessionId>/<tool_use_id>.md`. Directory auto-creation delegated to FileWriter. Overwrite on duplicate tool_use_id is standard writeFile behavior. Complete and unambiguous.
3. **F-003 不可变消息处理** — Deep clone via `JSON.parse(JSON.stringify())`. Content is replaced with string reference after clone. Complete and unambiguous.
4. **F-001 错误处理** — Errors propagate directly from FileWriter. No wrapping or transformation. Complete and unambiguous.
5. **F-001 释放字符数计算** — `freedChars = serialized.length - reference.length`. For string: serialized = content itself. For ContentBlock[]: serialized = JSON.stringify(content). Complete and unambiguous.
6. **F-004 便捷 API** — Wraps core function with default NodeFileWriter. Integration test verifies real file I/O. Complete and unambiguous.

7. **No contradictions or blockers found between BDD scenarios and PRD.**

## BDD-to-Test Mapping (Pre-existing)

| BDD Feature | BDD Scenario | Existing Test | Type |
|-------------|-------------|---------------|------|
| tool-result-file-offload | 卸载字符串类型的 tool_result 内容 | offload.test.ts#should offload string content and replace with file path reference | Unit |
| tool-result-file-offload | 卸载 ContentBlock 数组类型的 tool_result 内容 | offload.test.ts#should offload ContentBlock[] content as JSON and extract tool_use_id | Unit |
| tool-result-file-offload | 替换提示字符串格式正确 | offload.test.ts#should produce correct reference format | Unit |
| file-path-generation | 生成正确的文件路径结构 | offload.test.ts#should offload ContentBlock[] content... (path assertion) | Unit |
| file-path-generation | 目录不存在时自动创建 | file-writer.test.ts#should write content to a file and create directories + integration#should create session directory automatically | Unit + Integration |
| file-path-generation | 相同 tool_use_id 的文件会被覆盖 | file-writer.test.ts#should overwrite existing file content | Unit |
| immutable-message-handling | 原始消息对象不被修改 | offload.test.ts#should not modify the original message (immutability) | Unit |
| immutable-message-handling | 返回的消息是深拷贝 | offload.test.ts#should return deep cloned message that does not share references | Unit |
| convenient-api | 通过便捷 API 卸载 tool_result | integration#should offload string content via convenient API | Integration |
| error-handling | 文件写入失败时抛出异常 | offload.test.ts#should propagate FileWriter errors | Unit |
| error-handling | 权限不足导致写入失败 | offload.test.ts#should propagate permission denied errors | Unit |
| freed-chars-calculation | 正确计算字符串类型 content 释放的字符数 | offload.test.ts#should calculate freedChars correctly for string content | Unit |
| freed-chars-calculation | 正确计算 ContentBlock[] 类型 content 释放的字符数 | offload.test.ts#should calculate freedChars correctly for ContentBlock[] content | Unit |

**Coverage: 13/13 BDD scenarios have corresponding tests.**

## Per-Feature Development Cycle

Each feature follows BDD-guided TDD:

```
1. RED    — Translate BDD scenarios to failing tests
2. GREEN  — Write minimal production code to pass
3. REFACTOR — Clean up while tests pass
4. VERIFY — Confirm all BDD scenarios covered
5. COMMIT — One atomic commit per feature
6. REPORT — Progress summary, then next feature
```

> **For this project:** Since walking skeleton already provides full implementation and tests, the cycle is simplified to: **VERIFY → REPORT** for each feature. No RED/GREEN/REFACTOR needed.

## Layered Implementation Order

```
1. core/     — Types, offload algorithm (pure, no Node.js module imports)
2. infrastructure/ — NodeFileWriter (node:fs/promises, node:path)
3. index.ts  — Public API assembly (wires core + infrastructure)
```

## Test Classification Rules

| BDD `given` Pattern | Test Type | Location |
|---------------------|-----------|----------|
| Pure input validation, business rules | Unit test | tests/unit/core/ |
| FileWriter mock, error propagation | Unit test | tests/unit/core/ |
| Real file system operations (infra) | Unit test | tests/unit/infrastructure/ |
| Public API with real file I/O | Integration test | tests/integration/ |

> **E2E smoke tests:** N/A — This is a library module with no protocol/server layer. The integration tests through the public API serve as the highest-level verification.

## Coverage Targets

| Module | Line Coverage | Branch Coverage |
|--------|--------------|-----------------|
| core | >= 80% | >= 70% |
| infrastructure | >= 50% | >= 40% |
| Overall | >= 70% | >= 60% |

> **Current status:** 100% line, branch, and function coverage.

## Progress Log

> Append-only log. Each entry records a feature status change during the development cycle.

| Feature | From | To | Note |
|---------|------|----|------|

## Final Verification Checklist

- [ ] All 13 BDD scenarios have corresponding tests
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Architecture dependency check passes
- [ ] ESLint code style check passes (zero errors)
- [ ] Coverage meets thresholds
- [ ] BDD JSON files updated (`passes: true`, `overallPass: true`)
- [ ] All commits follow Conventional Commits format
