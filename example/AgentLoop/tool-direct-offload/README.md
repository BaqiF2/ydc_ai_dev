# tool-direct-offload

Agent Loop 工具结果直接卸载中间件 — 在工具执行结果返回给 LLM 之前，将超过阈值的 `tool_result` 内容写入文件，并替换为文件路径引用，从而节省 token 消耗。

## 功能特性

- **单条消息卸载** — 作为 Agent Loop 中间件，逐条处理超长的 `tool_result`
- **两种内容类型支持** — 自动处理 `string` 和 `ContentBlock[]` 两种 `content` 格式
- **路径引用替换** — 卸载后替换为 `[Tool result offloaded to file: <path>]`
- **Session 隔离** — 按 `sessionId` 隔离不同会话的卸载文件
- **不可变操作** — 不修改原始消息对象，返回深拷贝后的新消息
- **自动创建目录** — 输出目录不存在时自动递归创建
- **零运行时依赖** — 仅使用 Node.js 标准库（`fs/promises`、`path`）

## 快速开始

### 安装

```bash
npm install tool-direct-offload
```

> 要求 Node.js >= 18.0.0

### 使用

```typescript
import { offloadToolResult } from 'tool-direct-offload';
import type { Message } from 'tool-direct-offload';

// Agent Loop 中间件：工具执行完毕后，检查结果长度
const OFFLOAD_THRESHOLD = 1000;

const toolResultMessage: Message = {
  role: 'user',
  content: [
    {
      type: 'tool_result',
      tool_use_id: 'toolu_read_file_001',
      content: '... very long file content (> 1000 chars) ...',
    },
  ],
};

// 阈值判断在调用方
const contentLength = JSON.stringify(toolResultMessage.content).length;
if (contentLength >= OFFLOAD_THRESHOLD) {
  const result = await offloadToolResult(toolResultMessage, {
    sessionId: 'session-abc123',
    outputDir: '.offload',
  });

  console.log(result.message.content);  // [Tool result offloaded to file: .offload/session-abc123/toolu_read_file_001.md]
  console.log(result.freedChars);       // 释放的字符数
  console.log(result.file);             // 写入的文件路径
}
```

### 自定义 FileWriter

如需自定义文件写入行为（如测试场景），可使用底层 API：

```typescript
import { offloadToolResultWithWriter } from 'tool-direct-offload';
import type { FileWriter, Message } from 'tool-direct-offload';

const customWriter: FileWriter = {
  writeFile: async (filePath, content) => { /* custom implementation */ },
};

const result = await offloadToolResultWithWriter(
  message,
  'session-id',
  '.offload',
  customWriter,
);
```

## 返回结构

`offloadToolResult` 返回 `OffloadResult`：

| 字段 | 类型 | 说明 |
|------|------|------|
| `message` | `Message` | 处理后的新消息（content 已替换为路径引用） |
| `freedChars` | `number` | 释放的字符数 |
| `file` | `string` | 写入的文件路径 |

## 卸载规则

1. 阈值判断由**调用方**负责，本模块仅负责写入和替换
2. `content` 为 `string` 时：直接写入文件
3. `content` 为 `ContentBlock[]` 时：`JSON.stringify` 序列化后写入文件
4. 文件路径：`<outputDir>/<sessionId>/<tool_use_id>.md`
5. 相同 `tool_use_id` 的文件会被覆盖
6. 文件写入失败时直接抛出异常

> **关于阈值选择：** 示例中使用 1000 字符仅作为演示参考。实际应用中，阈值应根据具体场景灵活确定——考虑所使用模型的上下文窗口大小、单次对话的平均 token 消耗、工具返回内容的重要程度等因素。更理想的做法是由 Agent 自身在运行时动态评估：当剩余上下文空间紧张时主动触发卸载，而非依赖固定阈值。

## 运行示例

项目提供了一个模拟 Agent Loop 中间件的完整示例：

```bash
npx tsx examples/agent-loop-middleware.ts
```

该示例会：

1. 构造 3 个工具调用结果（2 个超长 + 1 个短内容）
2. 模拟 Agent Loop 的中间件处理流程
3. 展示哪些结果被卸载、哪些保留
4. 对比处理前后的 token 消耗变化
5. 验证原始消息未被修改

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
