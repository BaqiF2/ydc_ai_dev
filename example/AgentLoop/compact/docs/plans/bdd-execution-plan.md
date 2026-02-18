# BDD-Driven Development Execution Plan

> Generated: 2026-02-17
> PRD: `docs/requirements/2026-02-17-context-compact-prd.md`
> Architecture: `docs/architecture/architecture.md`
> Tech Stack: `docs/architecture/2026-02-17-context-compact-tech-stack.md`

## Project Context

| Item | Value |
|------|-------|
| Project | agent-context-compact |
| Language | TypeScript ^5.7.0 (target ES2022) |
| Framework | N/A (library module) |
| Build Tool | tsc (TypeScript Compiler) |
| Test Framework | Vitest ^3.0.0 |
| HTTP Mock | N/A (mock interfaces via vi.fn) |
| Architecture Test | dependency-cruiser ^16.0.0 |
| Coverage Tool | @vitest/coverage-v8 ^3.0.0 |

## Command Cheat Sheet

```
Build:              npm run build
Test (all):         npm run test
Test (unit only):   npm run test:unit
Test (integ only):  npm run test:integration
Test (single):      npx vitest run <test-file>
Coverage:           npm run test:coverage
Lint:               npm run lint
Dep Check:          npm run dep-check
Full Check:         npm run check
Source root:        src/
Test root:          tests/
```

## Walking Skeleton Status

- [x] package.json with all dependencies
- [x] tsconfig.json + tsconfig.build.json
- [x] vitest.config.ts with coverage thresholds
- [x] eslint.config.js
- [x] .dependency-cruiser.cjs with layering rules
- [x] CI pipeline (.github/workflows/ci.yml)
- [x] src/core/types.ts — All type definitions and constants
- [x] src/core/compact.ts — Core compaction algorithm (skeleton)
- [x] src/core/token-counter.ts — Token counting (skeleton)
- [x] src/core/summarizer.ts — Summarization logic (skeleton)
- [x] src/infrastructure/llm-client.ts — AnthropicLlmClient
- [x] src/infrastructure/file-writer.ts — NodeFileWriter
- [x] src/index.ts — Public API exports
- [x] Baseline tests passing (35 tests)
- [x] Build passing
- [x] Lint passing (0 errors)
- [x] Dependency rules passing (0 violations)

## Feature Execution Order

### Phase 0: Infrastructure Verification

> Walking skeleton already provides implementations. Verify existing tests cover BDD scenarios.

| # | Feature | Module | Scenarios | Status |
|---|---------|--------|-----------|--------|
| 0.1 | Token Counting (F-001) | core/token-counter | 6 | Done |

### Phase 1: Must Features

| # | Feature | Module | Scenarios | Status |
|---|---------|--------|-----------|--------|
| 1.1 | F-002 Compact Trigger | core/compact | 5 | Done |
| 1.2 | F-003 Message Partitioning | core/compact | 6 | Done |
| 1.3 | F-004 Summary Generation | core/summarizer | 5 | Done |
| 1.4 | F-005 Message Assembly | core/compact | 4 | Done |
| 1.5 | F-006 Message Persistence | infrastructure/file-writer | 4 | Done |
| 1.6 | F-007 Fault Tolerance | core/compact + infrastructure/llm-client | 4 | In Progress |

### Phase 2: Should Features

| # | Feature | Module | Scenarios | Status |
|---|---------|--------|-----------|--------|
| 2.1 | F-008 Statistics | core/compact | 2 | Pending |

### Phase 3: Integration Verification

| # | Feature | Module | Scenarios | Status |
|---|---------|--------|-----------|--------|
| 3.1 | Compact Integration | core/compact (end-to-end) | 5 | Pending |

**Total: 9 features, 41 BDD scenarios**

## Feature Dependencies

```
Phase 0: Token Counting (F-001)
    ↓
Phase 1: F-002 Compact Trigger ──→ depends on F-001 (countTokens)
    ↓
Phase 1: F-003 Message Partitioning ──→ depends on F-001 (countTokens per message)
    ↓
Phase 1: F-004 Summary Generation ──→ independent (uses LlmClient interface)
    ↓
Phase 1: F-005 Message Assembly ──→ independent (pure function)
    ↓
Phase 1: F-006 Message Persistence ──→ independent (uses FileWriter interface)
    ↓
Phase 1: F-007 Fault Tolerance ──→ depends on F-004 (summarize retry)
    ↓
Phase 2: F-008 Statistics ──→ depends on F-001 + F-003 + F-005
    ↓
Phase 3: Integration ──→ depends on ALL above
```

**Key dependency:** F-001 (Token Counting) is the foundation — F-002, F-003, and F-008 all depend on it.

## BDD Review Notes

1. **F-001 Token Counting** — Walking skeleton already has basic tests. Need to add: ToolUseBlock serialization test, ToolResultBlock nested content test, unknown block type warning test. Complete and unambiguous.
2. **F-002 Compact Trigger** — Threshold uses >= semantics. Custom CompactOptions override test needed. Complete and unambiguous.
3. **F-003 Message Partitioning** — Tail scan must not truncate messages (include whole message even if over budget). Multiple system messages must all go to head. Complete and unambiguous.
4. **F-004 Summary Generation** — Prompt must include 5 dimensions. Empty/whitespace result treated as failure. Complete and unambiguous.
5. **F-005 Message Assembly** — Summary message role must be "user". Immutability check required. Complete and unambiguous.
6. **F-006 Message Persistence** — File write failure must not block compaction. Sequence auto-increment. Directory auto-creation. Complete and unambiguous.
7. **F-007 Fault Tolerance** — COMPACT_MAX_RETRIES=0 means no retry. Total attempts = 1 + maxRetries. Exponential backoff between retries. Complete and unambiguous.
8. **F-008 Statistics** — Stats null when not compacted. compactionRatio = compacted/original. Complete and unambiguous.
9. **Integration** — Tests the full pipeline: detect → partition → persist → summarize → assemble. Multi-compression and offload combo scenarios. Complete and unambiguous.

10. **No contradictions or blockers found between BDD scenarios and PRD.**

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

## Layered Implementation Order

```
1. core/     — Types, token counting, summarizer, compact algorithm (pure, no framework deps)
2. infrastructure/ — LLM client (Anthropic SDK), file writer (Node.js fs)
```

## Test Classification Rules

| BDD `given` Pattern | Test Type | Location |
|---------------------|-----------|----------|
| Pure input validation, business rules | Unit test | `tests/core/*.test.ts` |
| Message serialization, prompt construction | Unit test | `tests/core/*.test.ts` |
| File system operations | Integration test | `tests/infrastructure/*.test.ts` |
| LLM API interaction | Integration test (mock) | `tests/core/*.test.ts` (via mock LlmClient) |

E2E smoke tests are not applicable — this is a library module with no protocol layer (no HTTP/MCP/gRPC server).

## Coverage Targets

| Module | Line Coverage | Branch Coverage |
|--------|--------------|-----------------|
| core | >= 80% | >= 70% |
| infrastructure | >= 50% | >= 40% |
| Overall | >= 70% | >= 60% |

## Progress Log

> Append-only log. Each entry records a feature status change during the development cycle.

| Feature | From | To | Note |
|---------|------|----|------|
| F-001 Token Counting | Pending | In Progress | Starting RED phase |
| F-001 Token Counting | In Progress | Done | 6/6 scenarios, commit ba82983 |
| F-002 Compact Trigger | Pending | In Progress | Starting RED phase |
| F-002 Compact Trigger | In Progress | Done | 5/5 scenarios, commit 93f6a34 |
| F-003 Message Partitioning | Pending | In Progress | Starting RED phase |
| F-003 Message Partitioning | In Progress | Done | 6/6 scenarios, commit eca3183 |
| F-004 Summary Generation | Pending | In Progress | Starting RED phase |
| F-004 Summary Generation | In Progress | Done | 5/5 scenarios, commit 17e1275 |
| F-005 Message Assembly | Pending | In Progress | Starting RED phase |
| F-005 Message Assembly | In Progress | Done | 4/4 scenarios, commit 0f92cb7 |
| F-006 Message Persistence | Pending | In Progress | Starting RED phase |
| F-006 Message Persistence | In Progress | Done | 4/4 scenarios, commit 3d56c16 |

## Final Verification Checklist

- [ ] All 41 BDD scenarios have corresponding tests
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Architecture tests pass (dependency-cruiser)
- [ ] Code style checks pass (zero errors)
- [ ] Coverage meets thresholds
- [ ] BDD JSON files updated (`passes: true`, `overallPass: true`)
- [ ] All commits follow Conventional Commits format
