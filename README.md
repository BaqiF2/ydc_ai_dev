[中文版本](README_ZH.md) | Chinese Version

# Ydc Ai Dev

You can definitely become an AI application development expert!

## Quick Start

### 1. Environment Configuration

Copy `.env.example` file to `.env` and configure the corresponding model API Key and Base URL:

```bash
cp .env.example .env
```

Then edit the `.env` file and fill in your API configuration:
- `DASHSCOPE_API_KEY`: Alibaba Cloud Qwen API Key
- `OPENAI_AI_KEY` and `OPEN_AI_URL`: OpenAI API configuration
- `DEEPSEEK_API_KEY`: DeepSeek API Key
- `ANTHROPIC_API_KEY` and `ANTHROPIC_BASE_URL`: Anthropic Claude API configuration

### 2. Run Python Examples

```bash
# Install dependencies
uv sync

# Run quick start example
uv run python example/claude/py/quickstart/agent.ts

# Run other examples (such as langchain ReAct)
uv run python example/langchain01/core/xxx.py
```

### 3. Run TypeScript Examples

This project uses **ES Modules (ESM)** for modern JavaScript support, including top-level await.

```bash
# Install dependencies
npm install

# Run quick start example (uses ESM loader)
npm run start:ts-agent

# Run other examples
node --loader ts-node/esm example/claude/ts/subagent/agent.ts
node --loader ts-node/esm example/claude/ts/hooks/agent.ts
```

**Note**: The project is configured as ESM (see `"type": "module"` in package.json), which enables:
- ✅ Top-level await support
- ✅ Modern import/export syntax
- ✅ Better tree-shaking and optimization
- ✅ Native browser compatibility

## Learning Objectives

- Systematically learn AI-related theoretical knowledge
- Deepen understanding through practical code examples
- Continuously update and expand the knowledge system
- Establish a complete learning trajectory record

## Learning Methods

1. **Combination of Theory and Practice**: Record theoretical knowledge in the `knowledge` directory, provide corresponding code implementations in the `example` directory
2. **Continuous Updates**: Regularly add new learning content and examples
3. **Deep Understanding**: Validate and consolidate theoretical knowledge through hands-on practice
4. **Project Practice**: Apply learned knowledge through actual projects

## Project Structure

```
ydc_ai_dev/
├── example/              # Code examples
│   ├── claude/          # Claude Agent SDK examples
│   │   ├── py/         # Python examples
│   │   │   ├── quickstart/  # Quick start
│   │   │   └── hooks/       # Hooks usage
│   │   └── ts/         # TypeScript examples (ESM)
│   │       ├── quickstart/  # Quick start
│   │       ├── hooks/       # Hooks usage
│   │       └── subagent/    # Subagent usage
│   ├── AgentLoop/       # Agent Loop context management examples
│   │   ├── compact/            # Context compression via LLM summarization
│   │   ├── context-offload/    # tool_result content offloading to files
│   │   └── tool-direct-offload/ # Middleware-based tool result offloading
│   ├── langchain01/     # Langchain examples
│   └── PlanAndExecute/  # Plan and Execute examples
├── knowledge/           # Learning materials and documentation
└── project/            # Project analysis and architecture documents
```

## Current Learning Topics

### ReAct (Reasoning + Action) Framework

- [✅] Build a ReAct framework based on principles
- [✅] Build a ReAct framework based on langchain
- [✅] Build a ReAct framework based on langgraph
- [✅] Build a ReAct framework based on autogen
- [✅] Build a ReAct framework based on agentScope
- [❌] Build a ReAct framework based on SpringAI alibaba (java framework as a supplement, to be updated later)

### PlanAndExecute (Plan + Execute) Framework

- [✅] Build a PlanAndExecute framework based on principles
- [✅] Build a PlanAndExecute framework based on langchain

### Langchain 1.0 Knowledge Integration

- [✅] Core Components: Concepts and usage of agent core components
- [✅] Advanced Usage: Other advanced usage methods
- [❌] Integration Components: Through RAG knowledge, understand langchain's core integrations. Complete the langchain knowledge system.

### Langgraph 1.0 Knowledge Integration

### Agent Theory and Practice

- [✅] Theoretical Knowledge Organization - Base-Agent
- [✅] Agent-Tools: Function Calling, MCP, and XML Prompts
- [✅] Agent-Planning: Use prompt methods to guide LLM for planning
- [✅] Agent-Memory: Management of short-term and long-term memory (Context Engineering)
  - [✅] 1. Added context decay
  - [✅] 2. Added manuscripts and langchain team's sharing content on context engineering
  - [✅] 3. Manus - Context Engineering for AI Agents: Lessons Learned from Building Manus
  - [✅] 4. Advanced tool usage analysis from Claude articles
- [❌] Agent-Knowledge: Knowledge base + web search for knowledge supplementation (RAG Tools)

### Claude Agent SDK Practice

- [✅] Python Examples
  - [✅] Quickstart: Basic agent usage
  - [✅] Hooks: Pre-tool and post-tool hooks
  - [✅] MCP Tools: Integration with Model Context Protocol
  - [✅] Session Management: Session handling and forking
  - [✅] Subagent: Multi-agent coordination
- [✅] TypeScript Examples (ESM)
  - [✅] Quickstart: Basic agent usage
  - [✅] Hooks: Custom hooks implementation
  - [✅] MCP Integration: Tool integration patterns
  - [✅] Session Management: Advanced session handling
  - [✅] Subagent: Multi-agent architecture
- [✅] Long-running Agents Architecture: Claude's approach to persistent agent systems

### Source Code Analysis

- [✅] Langchain - open_deep_research
- [✅] Manus AI Agent - Architecture analysis and source code interpretation

### Engineering Practice Articles

- [✅] 1. PostHog AI Agent development process experience and lessons learned
- [✅] 2. Claude Long-running Agents: Architecture and practice analysis

### Agent Loop Context Management

- [✅] [compact](example/AgentLoop/compact/) - Context compression: Generate structured summaries of intermediate history via independent LLM calls to free up token space
- [✅] [context-offload](example/AgentLoop/context-offload/) - Context offloading: Write large `tool_result` content to files, replacing with file path references
- [✅] [tool-direct-offload](example/AgentLoop/tool-direct-offload/) - Tool result direct offloading: As Agent Loop middleware, write oversized content to files before returning to LLM