# ADR-001: 选择 TypeScript 作为开发语言

## 状态

ACCEPTED

## 日期

2026-02-17

## 上下文

本项目为 Agent Loop 工具结果直接卸载中间件的学习/实验实现。需要选择合适的开发语言，主要考虑因素：类型安全性、学习友好性、Agent 开发生态匹配度。

## 决策

选择 TypeScript 5.x 作为开发语言，运行于 Node.js 18+ 环境。

## 理由

TypeScript 提供强类型系统，能清晰表达 Anthropic 消息结构（Message、ContentBlock 等联合类型），同时是 Agent 开发领域的主流语言之一。

### 备选方案

| 方案 | 优势 | 劣势 |
|------|------|------|
| JavaScript | 无需编译，上手快 | 缺少类型系统，复杂类型表达困难 |
| Python | AI 生态丰富 | 类型提示可选，运行时不强制 |
| **TypeScript** | 类型安全、IDE 友好、Agent 开发主流 | 需编译步骤 |

## 后果

### 正面影响

- 联合类型精确表达 ContentBlock 的多态结构
- IDE 自动补全和类型检查降低开发错误
- 代码即文档，类型定义本身说明数据结构

### 负面影响

- 需要配置 tsconfig.json 和编译步骤（影响极小）

### 对测试的影响

- 使用 Vitest，原生支持 TypeScript，无需额外配置
