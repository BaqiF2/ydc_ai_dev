/**
 * ToolRegistry 单元测试
 *
 * 测试目标：验证工具注册、查找、执行和 tool_use_id 关联机制
 * BDD 来源：tool-registry.json
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry } from '../../src/registry.js';
import type { ToolDefinition, ToolHandler } from '../../src/types.js';
import { todoWriteDefinition } from '../../src/tools.js';
import { createTodoWriteHandler } from '../../src/handlers.js';
import { TodoStore } from '../../src/store.js';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  const testDefinition: ToolDefinition = {
    name: 'TestTool',
    description: 'A test tool',
    input_schema: { type: 'object', properties: {} },
  };

  const testHandler: ToolHandler = async () => ({
    content: 'test result',
    is_error: false,
  });

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it('registers and finds a tool by name', () => {
    registry.register(testDefinition, testHandler);

    const tool = registry.getTool('TestTool');
    expect(tool).toBeDefined();
    expect(tool!.definition.name).toBe('TestTool');
  });

  it('returns undefined for unregistered tool', () => {
    const tool = registry.getTool('NonExistent');
    expect(tool).toBeUndefined();
  });

  it('returns all tool definitions', () => {
    const store = new TodoStore();
    registry.register(todoWriteDefinition, createTodoWriteHandler(store));
    registry.register(testDefinition, testHandler);

    const definitions = registry.getToolDefinitions();
    expect(definitions).toHaveLength(2);

    const names = definitions.map(d => d.name);
    expect(names).toContain('TodoWrite');
    expect(names).toContain('TestTool');

    for (const def of definitions) {
      expect(def).toHaveProperty('name');
      expect(def).toHaveProperty('description');
      expect(def).toHaveProperty('input_schema');
    }
  });

  it('executeTool returns correct tool_use_id', async () => {
    const store = new TodoStore();
    registry.register(todoWriteDefinition, createTodoWriteHandler(store));

    const result = await registry.executeTool('toolu_abc123', 'TodoWrite', { todos: [] });
    expect(result.tool_use_id).toBe('toolu_abc123');
    expect(result.type).toBe('tool_result');
  });

  it('executeTool returns error for non-existent tool', async () => {
    const result = await registry.executeTool('toolu_999', 'NonExistent', {});
    expect(result.is_error).toBe(true);
    expect(result.content).toBe("Tool 'NonExistent' not found");
    expect(result.tool_use_id).toBe('toolu_999');
  });

  it('executeTool returns a Promise', async () => {
    const store = new TodoStore();
    registry.register(todoWriteDefinition, createTodoWriteHandler(store));

    const returnValue = registry.executeTool('toolu_01', 'TodoWrite', { todos: [] });
    expect(returnValue).toBeInstanceOf(Promise);

    const result = await returnValue;
    expect(result.type).toBe('tool_result');
    expect(result).toHaveProperty('content');
  });
});
