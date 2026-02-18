/**
 * 端到端集成测试
 *
 * 测试目标：验证通过 createTodoTools() 创建的完整工具链，
 * 包括写入并返回结果、多次覆盖写入和 getToolDefinitions 返回
 * BDD 来源：integration.json
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTodoTools } from '../../src/index.js';
import type { ToolRegistry } from '../../src/registry.js';

describe('Integration', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = createTodoTools();
  });

  it('write returns updated todo list', async () => {
    const writeResult = await registry.executeTool('toolu_write_01', 'TodoWrite', {
      todos: [
        { content: 'Design API', status: 'pending', activeForm: 'Designing API' },
        { content: 'Write tests', status: 'in_progress', activeForm: 'Writing tests' },
      ],
    });

    expect(writeResult.type).toBe('tool_result');
    expect(writeResult.tool_use_id).toBe('toolu_write_01');

    const parsed = JSON.parse(writeResult.content);
    expect(parsed.todos).toHaveLength(2);
    expect(parsed.todos[0].content).toBe('Design API');
    expect(parsed.todos[1].content).toBe('Write tests');
  });

  it('multiple overwrite writes', async () => {
    // First write: 3 todos
    await registry.executeTool('toolu_w1', 'TodoWrite', {
      todos: [
        { content: 'Task A', status: 'pending', activeForm: 'Working on A' },
        { content: 'Task B', status: 'pending', activeForm: 'Working on B' },
        { content: 'Task C', status: 'pending', activeForm: 'Working on C' },
      ],
    });

    // Second write: 1 different todo — returns only the new list
    const result = await registry.executeTool('toolu_w2', 'TodoWrite', {
      todos: [
        { content: 'New Task', status: 'completed', activeForm: 'Completing new task' },
      ],
    });
    const parsed = JSON.parse(result.content);

    expect(parsed.todos).toHaveLength(1);
    expect(parsed.todos[0].content).toBe('New Task');
    expect(parsed.todos[0].status).toBe('completed');
  });

  it('getToolDefinitions returns TodoWrite schema', () => {
    const definitions = registry.getToolDefinitions();

    expect(definitions).toHaveLength(1);
    expect(definitions[0].name).toBe('TodoWrite');
    expect(definitions[0]).toHaveProperty('input_schema');
  });
});
