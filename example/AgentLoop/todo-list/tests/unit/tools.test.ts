/**
 * 工具 Schema 定义测试
 *
 * 测试目标：验证 TodoWrite 的 Schema 结构对齐 Anthropic API 标准
 * BDD 来源：tool-schema.json
 */

import { describe, it, expect } from 'vitest';
import { todoWriteDefinition } from '../../src/tools.js';

describe('ToolSchema', () => {
  describe('TodoWrite Schema', () => {
    it('has correct structure aligned with Anthropic API', () => {
      expect(todoWriteDefinition.name).toBe('TodoWrite');
      expect(todoWriteDefinition.description).toBeTruthy();
      expect(todoWriteDefinition).toHaveProperty('input_schema');

      const schema = todoWriteDefinition.input_schema as Record<string, unknown>;
      expect(schema.type).toBe('object');

      const properties = schema.properties as Record<string, unknown>;
      expect(properties).toHaveProperty('todos');

      const required = schema.required as string[];
      expect(required).toContain('todos');

      // Verify todos array schema
      const todosSchema = properties.todos as Record<string, unknown>;
      expect(todosSchema.type).toBe('array');

      const items = todosSchema.items as Record<string, unknown>;
      const itemProperties = items.properties as Record<string, unknown>;
      expect(itemProperties).toHaveProperty('content');
      expect(itemProperties).toHaveProperty('status');
      expect(itemProperties).toHaveProperty('activeForm');

      const itemRequired = items.required as string[];
      expect(itemRequired).toContain('content');
      expect(itemRequired).toContain('status');
      expect(itemRequired).toContain('activeForm');

      expect(items.additionalProperties).toBe(false);

      // Verify status enum
      const statusSchema = itemProperties.status as Record<string, unknown>;
      expect(statusSchema.enum).toEqual(['pending', 'in_progress', 'completed']);
    });
  });
});
