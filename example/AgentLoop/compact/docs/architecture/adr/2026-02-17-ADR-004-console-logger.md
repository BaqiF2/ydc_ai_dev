# ADR-004: 使用 Console + Interface 日志方案

## Status

Accepted

## Context

Context Compact 在多个关键流程中需要记录日志（警告、错误、重试信息），需要选择日志方案。

**PRD Reference**: NFR-012, NFR-011

**Business Driver**: 可观测性需求和可测试性需求

## Decision Drivers

- 用户要求简洁为主，学习为目的
- PRD 多处要求记录日志（F-001 未知 block 警告、F-006 文件写入失败、F-007 重试日志）
- 核心函数需保持纯函数特性，日志不应引入副作用耦合（NFR-011）

## Considered Options

### Option A: Console + Interface

| Dimension | Assessment |
|-----------|-----------|
| Performance | console 原生实现，零开销 |
| Learning Curve | 零学习成本 |
| Community & Ecosystem | Node.js 内置，无需维护 |
| Operational Complexity | 极低 |
| Cost | 零 |
| Risk | 低 — 接口支持未来替换 |

### Option B: pino

| Dimension | Assessment |
|-----------|-----------|
| Performance | 高性能 JSON 日志 |
| Learning Curve | 需学习配置 |
| Community & Ecosystem | 活跃，广泛使用 |
| Operational Complexity | 需配置和管理 |
| Cost | 零（开源） |
| Risk | 低 — 增加额外依赖 |

### Option C: winston

| Dimension | Assessment |
|-----------|-----------|
| Performance | 性能一般 |
| Learning Curve | 配置较重 |
| Community & Ecosystem | 成熟，广泛使用 |
| Operational Complexity | 配置和传输管理较复杂 |
| Cost | 零（开源） |
| Risk | 低 — 过重 |

## Decision

**Chosen**: Option A — Console + Interface

## Rationale

1. 以学习为目的，简洁最重要，几行代码定义 Logger 接口即可
2. 零额外依赖，符合项目轻量化原则
3. 通过 Logger 接口实现依赖注入，测试时可 mock，生产环境可替换为 pino 等框架
4. 与项目"核心函数为纯函数"的设计理念一致 — 日志通过注入而非全局单例

## Consequences

### Positive
- 零额外依赖
- 接口抽象支持未来替换为任何日志框架
- 测试时可注入 mock logger 验证日志行为

### Negative
- console 不支持结构化 JSON 输出 — 缓解：学习项目中非必需，未来可通过接口替换
- 无日志级别过滤 — 缓解：可在默认实现中简单添加

### Neutral
- Logger 接口定义简单：`{ info, warn, error }` 三个方法
