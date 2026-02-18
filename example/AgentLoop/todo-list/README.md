# Todo-List Tool

Agent Loop 工具教学示例 — 对齐 Anthropic Claude API 标准格式 + Claude Code TodoWrite 模式，展示工具定义（`input_schema`）、`tool_use_id` 关联、异步 Handler 和 `tool_result` 标准返回。

## 核心特性

- **单工具设计** — TodoWrite 整体替换并返回更新后列表，无需单独的读取工具
- **Anthropic API 对齐** — `input_schema`（snake_case）、`tool_result` 标准格式、`tool_use_id` 关联
- **异步 Handler** — `ToolHandler` 返回 `Promise`，对齐真实 Agent Loop 异步执行
- **Zod 校验** — 使用 Zod Schema 做参数校验，自动 trim + 枚举检查
- **注册表模式** — `ToolRegistry` 统一管理工具注册、查找和执行
- **零运行时依赖（除 Zod）** — 纯 TypeScript 实现，仅使用内存存储

## 快速开始

### 安装依赖

```bash
npm install
```

### 基本用法

```typescript
import { createTodoTools } from './src/index.js';

// 1. 创建工具注册表（内含 TodoWrite 工具）
const registry = createTodoTools();

// 2. 获取工具 Schema（发送给 LLM）
const definitions = registry.getToolDefinitions();
console.log(definitions.map(d => d.name));
// ['TodoWrite']

// 3. 模拟 LLM 调用工具（带 tool_use_id）— 写入并获取更新后列表
const result = await registry.executeTool('toolu_01', 'TodoWrite', {
  todos: [
    { content: 'Learn Agent Loop', status: 'in_progress', activeForm: 'Learning Agent Loop' },
    { content: 'Write tests', status: 'pending', activeForm: 'Writing tests' },
  ],
});
console.log(result);
// { type: 'tool_result', tool_use_id: 'toolu_01', content: '{"todos":[...]}' }
```

## 示例

`examples/` 目录提供了 2 个可直接运行的示例：

| 示例 | 说明 | 命令 |
|------|------|------|
| 01-basic-usage | TodoWrite 基础操作 + 错误处理 | `npm run example:basic` |
| 02-agent-loop-sim | 模拟 Agent Loop 多轮对话（tool_use_id 关联） | `npm run example:agent-loop` |

```bash
# 运行基础示例
npm run example:basic

# 运行 Agent Loop 模拟
npm run example:agent-loop
```

## 项目结构

```
src/
├── index.ts          # 公共 API 入口（createTodoTools 工厂函数）
├── types.ts          # 类型定义（Todo, ToolDefinition, ToolResult, ToolHandler 等）
├── store.ts          # 内存存储（TodoStore 数组整体替换模式）
├── tools.ts          # TodoWrite 的 JSON Schema 定义
├── handlers.ts       # TodoWrite 的异步处理函数（Zod 校验 + 调用 Store）
└── registry.ts       # 工具注册表（异步执行 + tool_use_id 关联）

examples/
├── 01-basic-usage.ts       # 基础操作 + 错误处理
└── 02-agent-loop-sim.ts    # Agent Loop 模拟

tests/unit/
├── store.test.ts           # Store 单元测试
├── handlers.test.ts        # Handler 单元测试
├── registry.test.ts        # Registry 单元测试
├── tools.test.ts           # Schema 定义测试
└── integration.test.ts     # 端到端集成测试

docs/
└── requirements/                      # PRD 与 BDD 用例
```

## 开发命令

```bash
npm test                # 运行所有测试
npm run test:watch      # 监听模式
npm run test:coverage   # 测试覆盖率报告
npm run typecheck       # TypeScript 类型检查
npm run example:basic   # 运行基础示例
npm run example:agent-loop  # 运行 Agent Loop 模拟
```

## 技术栈

| 类别 | 选型 |
|------|------|
| 语言 | TypeScript 5.x（严格模式） |
| 运行时 | Node.js 18+ |
| 校验 | Zod 4.x |
| 测试 | Vitest 4.x |
| 覆盖率 | @vitest/coverage-v8 |
| 运行器 | tsx |

## 设计文档

- [v2 PRD 需求文档](docs/requirements/2026-02-18-todo-list-tool-v2-prd.md)
- [v2 BDD 用例](docs/requirements/2026-02-18-todo-list-tool-v2-bdd/)
