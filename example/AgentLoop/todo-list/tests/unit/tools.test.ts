/**
 * 工具 Schema 定义单元测试
 * 验证每个工具的 Schema 结构正确性和参数定义完整性。
 */

import { describe, it, expect } from 'vitest';
import {
  createTodoDefinition,
  listTodosDefinition,
  getTodoDefinition,
  updateTodoDefinition,
  deleteTodoDefinition,
  allToolDefinitions,
} from '../../src/tools.js';

describe('Tool Schema Definitions', () => {
  it('should have 5 tool definitions', () => {
    expect(allToolDefinitions).toHaveLength(5);
  });

  it('should have correct tool names', () => {
    const names = allToolDefinitions.map((t) => t.name);
    expect(names).toEqual([
      'create_todo',
      'list_todos',
      'get_todo',
      'update_todo',
      'delete_todo',
    ]);
  });

  it('every definition should have name, description, and inputSchema', () => {
    for (const def of allToolDefinitions) {
      expect(def.name).toBeDefined();
      expect(def.description).toBeDefined();
      expect(def.inputSchema).toBeDefined();
      expect(def.inputSchema.type).toBe('object');
    }
  });

  describe('create_todo schema', () => {
    it('should require title', () => {
      expect(createTodoDefinition.inputSchema.required).toContain('title');
    });

    it('should not require description', () => {
      expect(createTodoDefinition.inputSchema.required).not.toContain('description');
    });

    it('should have title and description properties', () => {
      expect(createTodoDefinition.inputSchema.properties.title).toBeDefined();
      expect(createTodoDefinition.inputSchema.properties.description).toBeDefined();
    });

    it('title should be string type', () => {
      expect(createTodoDefinition.inputSchema.properties.title.type).toBe('string');
    });
  });

  describe('update_todo schema', () => {
    it('should have status enum with valid values', () => {
      const statusProp = updateTodoDefinition.inputSchema.properties.status;
      expect(statusProp.enum).toEqual(['pending', 'in_progress', 'completed']);
    });

    it('should require id', () => {
      expect(updateTodoDefinition.inputSchema.required).toContain('id');
    });
  });
});
