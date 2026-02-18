# Confirmed Tech Stack: Todo-List Tool 教学示例

## Document Info
| Field | Value |
|-------|-------|
| PRD Reference | `docs/requirements/2026-02-18-todo-list-tool-prd.md` |
| Created | 2026-02-18 |
| Status | Confirmed |
| Versions Verified | 2026-02-18 (via Web Search) |

## Development Stack

### Backend (唯一层 — 无前端/数据库)
| Component | Technology | Version | ADR Reference | Rationale Summary |
|-----------|-----------|---------|---------------|-------------------|
| 开发语言 | TypeScript | 5.9.3 | ADR-001 | PRD 要求，类型系统为工具 Schema 提供编译时校验 |
| 运行时 | Node.js | >= 18.x (LTS) | ADR-001 | PRD §4.4 要求，内置 crypto.randomUUID() |
| TS 执行工具 | tsx | 4.21.0 | ADR-002 | 零配置、Node 18+ 兼容、完整 TS 支持 |
| 数据存储 | JavaScript Map (内存) | N/A (内置) | ADR-004 | PRD 要求内存存储，零依赖 |
| UUID 生成 | crypto.randomUUID() | N/A (Node 内置) | ADR-004 | Node 18+ 内置，无需外部依赖 |
| 包管理器 | npm | >= 9.x (Node 内置) | ADR-005 | PRD 隐含要求，零额外安装 |

## Testing Stack
| Component | Technology | Version | ADR Reference | Rationale Summary |
|-----------|-----------|---------|---------------|-------------------|
| 测试框架 | Vitest | 4.0.18 | ADR-003 | 原生 TS 支持、零配置、esbuild 驱动极快 |

## DevOps / Infrastructure Stack
| Component | Technology | Version | ADR Reference | Rationale Summary |
|-----------|-----------|---------|---------------|-------------------|
| N/A | — | — | — | 教学示例暂不需要 CI/CD 和基础设施 |

## Dependency Version Verification
| Component | Technology | Verified Version | Latest Stable | Status | Web Verified |
|-----------|-----------|-----------------|---------------|--------|-------------|
| 开发语言 | TypeScript | 5.9.3 | 5.9.3 (6.0 beta) | Active | Yes |
| TS 执行工具 | tsx | 4.21.0 | 4.21.0 | Active | Yes |
| 测试框架 | Vitest | 4.0.18 | 4.0.18 | Active | Yes |
| 运行时 | Node.js | >= 18.x | 25.x (latest), 22.x (LTS) | Active | Yes |

### Compatibility Matrix
| Dependency A | Version | Dependency B | Required Version | Compatible |
|-------------|---------|-------------|-----------------|------------|
| tsx | 4.21.0 | Node.js | >= 18.x | Yes |
| Vitest | 4.0.18 | Node.js | >= 18.x | Yes |
| TypeScript | 5.9.3 | tsx | 4.21.0 | Yes |
| TypeScript | 5.9.3 | Vitest | 4.0.18 | Yes |
| crypto.randomUUID() | N/A | Node.js | >= 18.x | Yes (内置) |

## Pending Items
- 无待验证 POC 项目
- 无待决问题

## Cross-Reference
| PRD Requirement | NFR | Technology Decision | ADR |
|----------------|-----|-------------------|-----|
| F-007 工具 Schema 定义 | NFR-005 TypeScript 支持 | TypeScript 5.9.3 | ADR-001 |
| F-001~F-009 所有功能 | NFR-004 Node.js 兼容 | Node.js >= 18 | ADR-001 |
| F-001~F-009 所有功能 | NFR-001 代码简洁 | tsx 4.21.0 | ADR-002 |
| BDD 验收测试 | NFR-002 一键测试 | Vitest 4.0.18 | ADR-003 |
| F-010 内存存储 | NFR-006 零外部依赖 | JavaScript Map | ADR-004 |
| 项目构建 | NFR-002 npm install | npm | ADR-005 |

## NFR 覆盖检查
| NFR ID | Description | Addressed By | Status |
|--------|------------|-------------|--------|
| NFR-001 | 代码量精简 | TypeScript + tsx 零配置 | ✓ |
| NFR-002 | 一键运行测试 | npm + Vitest | ✓ |
| NFR-003 | 代码可读性 | TypeScript 类型即文档 | ✓ |
| NFR-004 | Node.js >= 18 兼容 | tsx / Vitest 均支持 | ✓ |
| NFR-005 | TypeScript 支持 | TypeScript 5.9.3 | ✓ |
| NFR-006 | 无外部运行时依赖 | 内存存储 + crypto.randomUUID() | ✓ |
| NFR-007 | 教学概念覆盖 | 代码结构对应 5 个教学概念 | ✓ |
