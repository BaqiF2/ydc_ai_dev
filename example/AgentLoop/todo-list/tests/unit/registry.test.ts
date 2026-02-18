/**
 * ToolRegistry 单元测试
 * 测试工具注册表的注册、查找、列表和执行功能。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry } from '../../src/registry.js';
import type { ToolDefinition, ToolHandler } from '../../src/types.js';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  const mockDefinition: ToolDefinition = {
    name: 'test_tool',
    description: 'A test tool',
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Test input' },
      },
      required: ['input'],
    },
  };

  const mockHandler: ToolHandler = (params) => ({
    success: true as const,
    data: { received: params.input },
  });

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('register', () => {
    it('should register a tool successfully', () => {
      registry.register(mockDefinition, mockHandler);
      const tool = registry.getTool('test_tool');
      expect(tool).toBeDefined();
      expect(tool!.definition.name).toBe('test_tool');
    });
  });

  describe('getTool', () => {
    it('should return registered tool by name', () => {
      registry.register(mockDefinition, mockHandler);
      const tool = registry.getTool('test_tool');
      expect(tool).toBeDefined();
      expect(tool!.definition).toEqual(mockDefinition);
    });

    it('should return undefined for non-existent tool', () => {
      expect(registry.getTool('non_existent_tool')).toBeUndefined();
    });
  });

  describe('getToolDefinitions', () => {
    it('should return all registered tool definitions', () => {
      registry.register(mockDefinition, mockHandler);

      const anotherDef: ToolDefinition = {
        name: 'another_tool',
        description: 'Another tool',
        inputSchema: { type: 'object', properties: {} },
      };
      registry.register(anotherDef, () => ({ success: true as const, data: null }));

      const definitions = registry.getToolDefinitions();
      expect(definitions).toHaveLength(2);
      expect(definitions.map((d) => d.name)).toContain('test_tool');
      expect(definitions.map((d) => d.name)).toContain('another_tool');
    });

    it('should return empty array when no tools registered', () => {
      expect(registry.getToolDefinitions()).toEqual([]);
    });
  });

  describe('executeTool', () => {
    it('should execute registered tool and return result', () => {
      registry.register(mockDefinition, mockHandler);
      const result = registry.executeTool('test_tool', { input: 'hello' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>).received).toBe('hello');
      }
    });

    it('should return error for non-existent tool', () => {
      const result = registry.executeTool('non_existent', {});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Tool 'non_existent' not found");
      }
    });
  });

  describe('structured result format', () => {
    it('should return success format with data', () => {
      registry.register(mockDefinition, mockHandler);
      const result = registry.executeTool('test_tool', { input: 'test' });
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
      expect(result).not.toHaveProperty('error');
    });

    it('should return error format without data', () => {
      const result = registry.executeTool('missing_tool', {});
      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
      expect(result).not.toHaveProperty('data');
    });

    it('should not throw exceptions on invalid input', () => {
      const failHandler: ToolHandler = () => ({
        success: false as const,
        error: 'Validation failed',
      });
      const def: ToolDefinition = {
        name: 'fail_tool',
        description: 'Tool that returns error',
        inputSchema: { type: 'object', properties: {} },
      };
      registry.register(def, failHandler);

      expect(() => registry.executeTool('fail_tool', {})).not.toThrow();
      const result = registry.executeTool('fail_tool', {});
      expect(result.success).toBe(false);
    });
  });
});
