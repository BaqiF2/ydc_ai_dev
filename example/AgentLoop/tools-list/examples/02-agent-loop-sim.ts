/**
 * 模拟 Agent Loop 完整循环（对齐 Anthropic Claude API）
 *
 * 模拟 LLM 通过 tool_use/tool_result 管理任务：
 * LLM 决策 → tool_use（含 tool_use_id）→ tool_result（含更新后列表）→ 继续推理
 * 展示 tool_use_id 请求-结果关联机制和标准 ToolResult 格式。
 */

import { createTodoTools } from '../src/index.js';
import type { ToolDefinition, ToolResult } from '../src/types.js';

// ── types ────────────────────────────────────────────────

/** 模拟 LLM 发出的 tool_use 请求（对齐 Anthropic API） */
interface ToolUse {
  type: 'tool_use';
  id: string;       // tool_use_id
  name: string;
  input: Record<string, unknown>;
}

/** Agent Loop 单轮对话记录 */
interface ConversationTurn {
  turn: number;
  userMessage: string;
  llmThought: string;
  toolUses: ToolUse[];
  toolResults: ToolResult[];
}

// ── helpers ──────────────────────────────────────────────

function printBanner(text: string): void {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${text}`);
  console.log('═'.repeat(60));
}

function printTurn(turn: ConversationTurn): void {
  console.log(`\n── Turn ${turn.turn} ${'─'.repeat(44)}`);
  console.log(`User: ${turn.userMessage}`);
  console.log(`LLM thought: ${turn.llmThought}`);

  for (let i = 0; i < turn.toolUses.length; i++) {
    const use = turn.toolUses[i];
    const result = turn.toolResults[i];
    console.log(`\n   tool_use: ${use.name}(${JSON.stringify(use.input)}) [id=${use.id}]`);
    console.log(`   tool_result: ${JSON.stringify(result)}`);
    console.log(`   id match: ${use.id === result.tool_use_id ? 'YES' : 'NO'}`);
  }
}

// ── main ─────────────────────────────────────────────────

async function main(): Promise<void> {
  // ── Phase 1: 初始化 ──
  printBanner('Phase 1: Initialize tool registry');

  const registry = createTodoTools();
  const definitions: ToolDefinition[] = registry.getToolDefinitions();

  console.log('\nAgent starts, sending available tools to LLM:');
  console.log(JSON.stringify(definitions.map(d => ({
    name: d.name,
    description: d.description,
    input_schema: d.input_schema,
  })), null, 2));

  // ── Phase 2: 模拟多轮对话 ──
  printBanner('Phase 2: Simulate Agent Loop conversation');

  const history: ConversationTurn[] = [];

  // Turn 1: 用户要求创建任务列表
  {
    const userMessage = 'Create three tasks: design API, implement backend, write tests';
    const llmThought = 'User wants 3 tasks. I call TodoWrite with the full list. The result will contain the updated list.';

    const toolUses: ToolUse[] = [{
      type: 'tool_use',
      id: 'toolu_01ABC',
      name: 'TodoWrite',
      input: {
        todos: [
          { content: 'Design API', status: 'pending', activeForm: 'Designing API' },
          { content: 'Implement backend', status: 'pending', activeForm: 'Implementing backend' },
          { content: 'Write tests', status: 'pending', activeForm: 'Writing tests' },
        ],
      },
    }];

    const toolResults: ToolResult[] = [];
    for (const use of toolUses) {
      const result = await registry.executeTool(use.id, use.name, use.input);
      toolResults.push(result);
    }

    const turn: ConversationTurn = { turn: 1, userMessage, llmThought, toolUses, toolResults };
    history.push(turn);
    printTurn(turn);
  }

  // Turn 2: 用户开始第一个任务 — LLM 从上一轮 tool_result 中知道当前列表
  {
    const userMessage = 'Start working on "Design API"';
    const llmThought = 'I already have the full list from the previous tool_result. Update Design API to in_progress via TodoWrite.';

    const toolUses: ToolUse[] = [{
      type: 'tool_use',
      id: 'toolu_02DEF',
      name: 'TodoWrite',
      input: {
        todos: [
          { content: 'Design API', status: 'in_progress', activeForm: 'Designing API' },
          { content: 'Implement backend', status: 'pending', activeForm: 'Implementing backend' },
          { content: 'Write tests', status: 'pending', activeForm: 'Writing tests' },
        ],
      },
    }];

    const toolResults: ToolResult[] = [];
    for (const use of toolUses) {
      const result = await registry.executeTool(use.id, use.name, use.input);
      toolResults.push(result);
    }

    const turn: ConversationTurn = { turn: 2, userMessage, llmThought, toolUses, toolResults };
    history.push(turn);
    printTurn(turn);
  }

  // Turn 3: 完成第一个任务，开始第二个
  {
    const userMessage = '"Design API" is done, start "Implement backend"';
    const llmThought = 'Update Design API to completed, Implement backend to in_progress via TodoWrite.';

    const toolUses: ToolUse[] = [{
      type: 'tool_use',
      id: 'toolu_03GHI',
      name: 'TodoWrite',
      input: {
        todos: [
          { content: 'Design API', status: 'completed', activeForm: 'Designing API' },
          { content: 'Implement backend', status: 'in_progress', activeForm: 'Implementing backend' },
          { content: 'Write tests', status: 'pending', activeForm: 'Writing tests' },
        ],
      },
    }];

    const toolResults: ToolResult[] = [];
    for (const use of toolUses) {
      const result = await registry.executeTool(use.id, use.name, use.input);
      toolResults.push(result);
    }

    const turn: ConversationTurn = { turn: 3, userMessage, llmThought, toolUses, toolResults };
    history.push(turn);
    printTurn(turn);
  }

  // ── Phase 3: 总结 ──
  printBanner('Phase 3: Agent Loop summary');

  console.log(`\nCompleted ${history.length} conversation turns:`);
  for (const turn of history) {
    const toolNames = turn.toolUses.map(u => u.name).join(', ');
    const allIdsMatch = turn.toolUses.every((u, i) => u.id === turn.toolResults[i].tool_use_id);
    const allSuccess = turn.toolResults.every(r => !r.is_error);
    console.log(`  Turn ${turn.turn}: ${toolNames} | id_match: ${allIdsMatch} | success: ${allSuccess}`);
  }

  console.log('\nThis demo shows the Agent Loop core flow:');
  console.log('  1. Send ToolDefinition[] (with input_schema) to LLM at startup');
  console.log('  2. LLM emits tool_use requests with unique tool_use_id');
  console.log('  3. Agent executes tools via registry.executeTool(toolUseId, name, params)');
  console.log('  4. tool_result contains the updated list — no separate read needed');
  console.log('  5. TodoWrite uses full-replace mode (Claude Code pattern)\n');
}

main().catch(console.error);
