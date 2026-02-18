# Confirmed Tech Stack: Context Compact

## Document Info
| Field | Value |
|-------|-------|
| PRD Reference | `docs/requirements/2026-02-17-context-compact-prd.md` |
| Created | 2026-02-17 |
| Status | Confirmed |
| Versions Verified | 2026-02-17 (via Web Search) |

## Development Stack

### Runtime & Language
| Component | Technology | Version | ADR Reference | Rationale Summary |
|-----------|-----------|---------|---------------|-------------------|
| Runtime | Node.js | >= 18.0.0 | ADR-001 | 与现有模块一致 |
| Language | TypeScript | ^5.7.0 (latest stable: 5.9.3) | ADR-001 | 与现有模块一致，严格模式 |
| Compile Target | ES2022 | — | ADR-001 | 现代 JS 特性 |
| Module System | Node16 (ESM) | — | ADR-001 | 与现有模块一致 |

### Core Dependencies
| Component | Technology | Version | ADR Reference | Rationale Summary |
|-----------|-----------|---------|---------------|-------------------|
| LLM Client & Token Counting | @anthropic-ai/sdk | ^0.74.0 (latest: 0.74.0) | ADR-002, ADR-003 | 单一 SDK 提供 countTokens + 摘要生成 |
| Logging | Console + Logger Interface | Node.js built-in | ADR-004 | 零依赖，接口可注入，简洁为主 |

## Testing Stack
| Component | Technology | Version | ADR Reference | Rationale Summary |
|-----------|-----------|---------|---------------|-------------------|
| Test Framework | Vitest | ^3.0.0 (latest 3.x) | ADR-005 | 与现有模块一致，注意 Vitest 4.x 已发布但需评估兼容性 |
| Coverage | @vitest/coverage-v8 | ^3.0.0 | ADR-005 | 与 Vitest 版本匹配 |
| Type Definitions | @types/node | ^25.2.3 | ADR-001 | 与现有模块一致 |

## DevOps / Code Quality Stack
| Component | Technology | Version | ADR Reference | Rationale Summary |
|-----------|-----------|---------|---------------|-------------------|
| Linter | ESLint | ^9.0.0 (注意：10.0.0 要求 Node.js >= 20，不兼容) | ADR-005 | 与现有模块一致，兼容 Node.js 18 |
| TS Lint Plugin | typescript-eslint | ^8.0.0 | ADR-005 | 与现有模块一致 |
| Dependency Check | dependency-cruiser | ^16.0.0 | ADR-005 | 与现有模块一致 |

## Dependency Version Verification
| Component | Technology | Verified Version | Latest Stable | Status | Verified |
|-----------|-----------|-----------------|---------------|--------|----------|
| Runtime | Node.js | >= 18.0.0 | 22.x LTS | Active | Yes |
| Language | TypeScript | ^5.7.0 | 5.9.3 | Active (6.0 beta) | Yes |
| LLM SDK | @anthropic-ai/sdk | ^0.74.0 | 0.74.0 | Active | Yes |
| Test | Vitest | ^3.0.0 | 4.0.18 (3.x 仍维护) | Active | Yes |
| Coverage | @vitest/coverage-v8 | ^3.0.0 | 4.0.18 (3.x 仍维护) | Active | Yes |
| Linter | ESLint | ^9.0.0 | 10.0.0 (不兼容 Node 18) | 9.x Maintenance | Yes |
| TS Lint | typescript-eslint | ^8.0.0 | 8.x | Active | Yes |
| Dep Check | dependency-cruiser | ^16.0.0 | 16.x | Active | Yes |

### Compatibility Matrix
| Dependency A | Version | Dependency B | Required Version | Compatible |
|-------------|---------|-------------|-----------------|------------|
| TypeScript | ^5.7.0 | Node.js | >= 18 | Yes |
| @anthropic-ai/sdk | ^0.74.0 | Node.js | >= 18 | Yes |
| Vitest | ^3.0.0 | Node.js | >= 18 | Yes |
| ESLint | ^9.0.0 | Node.js | >= 18 | Yes |
| ESLint | 10.0.0 | Node.js | >= 20.19 | No — 不采用 |
| typescript-eslint | ^8.0.0 | TypeScript | >= 5.0 | Yes |

## Pending Items
- 无待验证 POC 项

## Cross-Reference
| PRD Requirement | NFR | Technology Decision | ADR |
|----------------|-----|-------------------|-----|
| F-001 Token 计数 | NFR-001 Performance | @anthropic-ai/sdk countTokens API | ADR-002 |
| F-004 摘要生成 | NFR-005 Security | @anthropic-ai/sdk messages API | ADR-003 |
| F-006 持久化 | NFR-006 Security | Node.js fs (built-in) | ADR-001 |
| F-007 容错 | NFR-004 Reliability | @anthropic-ai/sdk (retry logic) | ADR-003 |
| 全部 | NFR-008 Compatibility | Node.js >= 18 | ADR-001 |
| 全部 | NFR-009 Compatibility | TypeScript ^5.7.0 | ADR-001 |
| 全部 | NFR-010 Compatibility | 模块间结构一致 | ADR-001 |
| 全部 | NFR-011 Testability | Vitest ^3.0.0 | ADR-005 |
| F-001, F-006, F-007 | NFR-012 Observability | Console + Logger Interface | ADR-004 |
