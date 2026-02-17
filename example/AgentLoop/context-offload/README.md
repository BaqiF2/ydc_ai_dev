# agent-context-offload

Agent Loop 上下文卸载模块 — 当对话上下文接近 token 上限时，将历史消息中 `tool_result` 的大段内容写入文件，并在消息中替换为文件路径引用，从而释放上下文空间。

## 功能特性

- **tool_result 内容卸载** — 扫描消息数组，将字符数 ≥ 100 的 `tool_result` 内容写入独立文件
- **路径引用替换** — 卸载后的内容替换为 `[Content offloaded to: ./tool-result-{id}.md]` 引用
- **不可变操作** — 不修改原始消息数组，返回全新的消息列表
- **卸载统计** — 返回卸载数量、释放字符数和生成的文件路径列表
- **自动创建目录** — 输出目录不存在时自动递归创建
- **零运行时依赖** — 仅使用 Node.js 标准库（`fs/promises`、`path`）

## 快速开始

### 安装

```bash
npm install agent-context-offload
```

> 要求 Node.js >= 18.0.0

### 使用

```typescript
import { offloadToolResults } from 'agent-context-offload';
import type { Message } from 'agent-context-offload';

const messages: Message[] = [
  { role: 'user', content: 'Read the config file' },
  {
    role: 'assistant',
    content: [
      { type: 'tool_use', id: 'tool_1', name: 'read_file', input: {} },
    ],
  },
  {
    role: 'user',
    content: [
      {
        type: 'tool_result',
        tool_use_id: 'tool_1',
        content: '... very long file content ...',
      },
    ],
  },
];

const result = await offloadToolResults(messages, {
  outputDir: './offload',
});

console.log(result.offloadedCount); // 卸载的 tool_result 数量
console.log(result.freedChars);     // 释放的字符数
console.log(result.files);          // 写入的文件路径列表
console.log(result.messages);       // 替换后的新消息数组
```

### 自定义 FileWriter

如需自定义文件写入行为（如测试场景），可使用底层 API：

```typescript
import { offloadToolResultsWithWriter } from 'agent-context-offload';
import type { FileWriter } from 'agent-context-offload';

const customWriter: FileWriter = {
  ensureDir: async (dir) => { /* ... */ },
  writeFile: async (filePath, content) => { /* ... */ },
};

const result = await offloadToolResultsWithWriter(messages, './offload', customWriter);
```

## 返回结构

`offloadToolResults` 返回 `OffloadResult`：

| 字段 | 类型 | 说明 |
|------|------|------|
| `messages` | `Message[]` | 卸载后的新消息列表 |
| `offloadedCount` | `number` | 卸载的 tool_result 数量 |
| `freedChars` | `number` | 释放的总字符数 |
| `files` | `string[]` | 写入的文件绝对路径列表 |

## 卸载规则

1. 从最早的消息开始遍历
2. 仅处理 `type: "tool_result"` 的内容块
3. 字符数 **≥ 100** 时执行卸载，**< 100** 时跳过
4. 文件命名：`tool-result-{tool_use_id}.md`
5. `tool_use_id` 重复时追加序号：`tool-result-{id}-1.md`

阈值可通过环境变量 `OFFLOAD_CHAR_THRESHOLD` 配置。

## 运行示例

项目提供了一个完整的模拟脚本，演示多轮 Agent 对话中的上下文卸载过程：

```bash
npx tsx examples/simulate-offload.ts
```

该示例会：

1. 构造一个包含 4 次工具调用的多轮对话（3 个大文件 + 1 个短错误信息）
2. 展示卸载前的上下文总大小
3. 执行 `offloadToolResults()`，将超标内容写入 `.offload-demo/` 目录
4. 对比卸载前后的上下文大小和节省比例
5. 展示卸载文件的实际内容片段
6. 验证原始消息数组未被修改（不可变性）

示例输出摘要：

```
== Step 3 — Offload results ==

  Offloaded count: 3
  Freed chars: 6220 chars
  Files written: 3

== Step 4 — Conversation after offloading ==

  Total content size: 1204 chars
  Space saved: 6368 chars (84.1%)
```

## 项目结构

```
src/
├── core/
│   ├── types.ts          # 类型定义（Message, FileWriter, OffloadResult 等）
│   └── offload.ts        # 卸载算法核心逻辑
├── infrastructure/
│   └── file-writer.ts    # Node.js 文件系统实现
└── index.ts              # 公共 API 入口

tests/
├── unit/                 # 单元测试（mock FileWriter）
└── integration/          # 集成测试（真实文件系统）
```

**架构约束**：

- `core` 层不依赖 `infrastructure` 层和 Node.js 模块
- 通过 `FileWriter` 接口实现依赖倒置
- 禁止循环依赖（由 dependency-cruiser 自动检查）

## 开发

```bash
# 安装依赖
npm install

# 运行所有测试
npm test

# 单元测试 / 集成测试
npm run test:unit
npm run test:integration

# 测试覆盖率
npm run test:coverage

# 代码检查
npm run lint

# 架构依赖检查
npm run dep-check

# 完整检查（lint + dep-check + coverage + build）
npm run check

# 构建
npm run build
```

## 技术栈

| 类别 | 选型 |
|------|------|
| 语言 | TypeScript 5.x（严格模式） |
| 运行时 | Node.js 18+ |
| 测试 | Vitest 3.x |
| 代码规范 | ESLint 9.x + typescript-eslint |
| 架构检查 | dependency-cruiser |
| CI | GitHub Actions（Node.js 18/20/22） |

## 许可证

[MIT](LICENSE)
