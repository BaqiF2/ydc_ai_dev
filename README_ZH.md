# Ydc AI dev

你一定可以成为一个AI应用开发专家!

## 快速使用

### 1. 环境配置

复制 `.env.example` 文件为 `.env`，并配置相应的模型 API Key 和 Base URL：

```bash
cp .env.example .env
```

然后编辑 `.env` 文件，填入你的 API 配置：
- `DASHSCOPE_API_KEY`: 阿里云通义千问 API Key
- `OPENAI_AI_KEY` 和 `OPEN_AI_URL`: OpenAI API 配置
- `DEEPSEEK_API_KEY`: DeepSeek API Key
- `ANTHROPIC_API_KEY` 和 `ANTHROPIC_BASE_URL`: Anthropic Claude API 配置

### 2. 运行 Python 示例

```bash
# 安装依赖
uv sync

# 运行快速开始示例
uv run python example/claude/py/quickstart/agent.ts

# 运行其他示例（如 langchain ReAct）
uv run python example/langchain01/core/xxx.py
```

### 3. 运行 TypeScript 示例

本项目使用 **ES Modules (ESM)** 以支持现代 JavaScript 特性，包括顶层 await。

```bash
# 安装依赖
npm install

# 运行快速开始示例（使用 ESM 加载器）
npm run start:ts-agent

# 运行其他示例
node --loader ts-node/esm example/claude/ts/subagent/agent.ts
node --loader ts-node/esm example/claude/ts/hooks/agent.ts
```

**注意**：项目已配置为 ESM（详见 package.json 中的 `"type": "module"`），这带来了以下优势：
- ✅ 支持顶层 await
- ✅ 现代化的 import/export 语法
- ✅ 更好的 tree-shaking 和优化
- ✅ 原生浏览器兼容性

## 学习目标

- 系统性地学习 AI 相关理论知识
- 通过实际代码示例加深理解
- 持续更新和扩展知识体系
- 建立完整的学习轨迹记录

## 学习方法

1. **理论与实践结合**：在 `knowledge` 目录中记录理论知识，在 `example` 目录中提供相应的代码实现
2. **持续更新**：定期添加新的学习内容和示例
3. **深入理解**：通过动手实践来验证和巩固理论知识
4. **项目实战**：通过实际项目来应用所学知识

## 项目结构

```
ydc_ai_dev/
├── example/              # 代码示例
│   ├── claude/          # Claude Agent SDK 示例
│   │   ├── py/         # Python 示例
│   │   │   ├── quickstart/  # 快速开始
│   │   │   └── hooks/       # Hooks 使用
│   │   └── ts/         # TypeScript 示例（ESM）
│   │       ├── quickstart/  # 快速开始
│   │       ├── hooks/       # Hooks 使用
│   │       └── subagent/    # Subagent 使用
│   ├── langchain01/     # Langchain 示例
│   └── PlanAndExecute/  # 计划与执行示例
├── knowledge/           # 学习资料和文档
└── project/            # 项目分析和架构文档
```

## 当前学习主题

### ReAct (Reasoning + Action) 框架

- [✅] 基于原理构建一个ReAct框架
- [✅] 基于langchain构建一个ReAct框架
- [✅] 基于langgraph构建一个ReAct框架
- [✅] 基于autogen构建一个ReAct框架
- [✅] 基于agentScope构建一个ReAct框架
- [❌] 基于SpringAI alibaba构建一个ReAct框架（java框架作为补充，最后在更新上来）

### PlanAndExecute (Plan + execute) 框架

- [✅] 基于原理构建一个PlanAndExecute框架
- [✅] 基于langchain构建一个PlanAndExecute框架

### langchain 1.0 知识点整合

- [✅] 核心组件: agent核心组件的概念与使用
- [✅] 高级用法：其他高级用法
- [❌] 集成组件：通过RAG知识，了解langchain的核心集成。补全langchain完整知识体系。

### langgraph 1.0 知识点整合

### Agent 理论与实践

- [✅] 理论知识整理 - Base-Agent
- [✅] Agent-工具：Function Calling 与 MCP 与 XML提示词
- [✅] Agent-计划: 使用提示词方式引导LLM进行规划
- [✅] Agent-记忆: 短期与长期记忆的管理(上下文工程)
  - [✅] 1. 新增了上下文腐烂
  - [✅] 2. 新增manus与langchain团队对于上下文工程的分享内容
  - [✅] 3. Manus - AI代理的上下文工程：构建Manus的经验教训
  - [✅] 4. 从Claude文章分析高级工具的使用
- [❌] Agent-知识：知识库 + 网络搜索进行知识的补充（RAG Tools）

### Claude Agent SDK 实践

- [✅] Python 示例
  - [✅] Quickstart：基础智能体使用
  - [✅] Hooks：前置工具钩子和后置工具钩子
  - [✅] MCP Tools：模型上下文协议集成
  - [✅] Session Management：会话处理和分支
  - [✅] Subagent：多智能体协作
- [✅] TypeScript 示例（ESM）
  - [✅] Quickstart：基础智能体使用
  - [✅] Hooks：自定义钩子实现
  - [✅] MCP Integration：工具集成模式
  - [✅] Session Management：高级会话处理
  - [✅] Subagent：多智能体架构
- [✅] Long-running Agents 架构：Claude的持久化智能体系统方法

### 源码解读

- [✅] langchain - open_deep_research
- [✅] Manus AI Agent - 架构剖析和源码解读

### 工程实战文章

- [✅] 1. PostHog AI 智能体开发过程的经验与教训
- [✅] 2. Claude 长期运行的智能体（Long-running Agents）：架构与实践分析







