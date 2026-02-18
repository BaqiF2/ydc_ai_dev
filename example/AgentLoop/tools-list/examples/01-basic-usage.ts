/**
 * 基础用法演示（对齐 Anthropic Claude API + Claude Code）
 *
 * 展示 TodoWrite 写入并返回结果 + 错误处理，
 * 以及 tool_use_id 关联和标准 ToolResult 格式。
 */

import { createTodoTools } from '../src/index.js';

// ── helpers ──────────────────────────────────────────────

function printSection(title: string): void {
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(50));
}

function printResult(label: string, result: unknown): void {
  console.log(`\n▸ ${label}`);
  console.log(JSON.stringify(result, null, 2));
}

// ── main ─────────────────────────────────────────────────

async function main(): Promise<void> {
  // 1. 创建工具注册表
  printSection('1. Create tool registry');
  const registry = createTodoTools();
  const definitions = registry.getToolDefinitions();
  console.log(`\nRegistered ${definitions.length} tool(s):`);
  for (const def of definitions) {
    console.log(`  - ${def.name}: ${def.description.slice(0, 60)}...`);
  }

  // 2. TodoWrite — 写入任务列表（返回更新后结果）
  printSection('2. TodoWrite — Write todo list');

  const writeResult = await registry.executeTool('toolu_01', 'TodoWrite', {
    todos: [
      { content: 'Learn Agent Loop architecture', status: 'in_progress', activeForm: 'Learning Agent Loop architecture' },
      { content: 'Implement todo-list tool', status: 'pending', activeForm: 'Implementing todo-list tool' },
      { content: 'Write unit tests', status: 'pending', activeForm: 'Writing unit tests' },
    ],
  });
  printResult('Write 3 todos (returns updated list)', writeResult);

  // 3. TodoWrite — 更新任务状态（整体替换）
  printSection('3. TodoWrite — Update via full replace');

  const updateResult = await registry.executeTool('toolu_02', 'TodoWrite', {
    todos: [
      { content: 'Learn Agent Loop architecture', status: 'completed', activeForm: 'Learning Agent Loop architecture' },
      { content: 'Implement todo-list tool', status: 'in_progress', activeForm: 'Implementing todo-list tool' },
      { content: 'Write unit tests', status: 'pending', activeForm: 'Writing unit tests' },
    ],
  });
  printResult('Update todos (mark first as completed)', updateResult);

  // 4. TodoWrite — 清空任务
  printSection('4. TodoWrite — Clear all todos');

  const clearResult = await registry.executeTool('toolu_03', 'TodoWrite', { todos: [] });
  printResult('Clear all todos', clearResult);

  // 5. 错误处理演示
  printSection('5. Error handling');

  const missingTodos = await registry.executeTool('toolu_err_01', 'TodoWrite', {});
  printResult('Missing todos field', missingTodos);

  const invalidStatus = await registry.executeTool('toolu_err_02', 'TodoWrite', {
    todos: [{ content: 'Task', status: 'invalid', activeForm: 'Working' }],
  });
  printResult('Invalid status', invalidStatus);

  const emptyContent = await registry.executeTool('toolu_err_03', 'TodoWrite', {
    todos: [{ content: '', status: 'pending', activeForm: 'Working' }],
  });
  printResult('Empty content', emptyContent);

  const unknownTool = await registry.executeTool('toolu_err_04', 'UnknownTool', {});
  printResult('Unknown tool', unknownTool);

  // 总结
  printSection('Demo complete');
  console.log('\nThis demo shows:');
  console.log('  1. createTodoTools() creates a tool registry with TodoWrite');
  console.log('  2. getToolDefinitions() returns Anthropic API-aligned schema');
  console.log('  3. executeTool() with tool_use_id returns standard ToolResult');
  console.log('  4. TodoWrite replaces the entire list and returns updated result');
  console.log('  5. Input validation with detailed error messages\n');
}

main().catch(console.error);
