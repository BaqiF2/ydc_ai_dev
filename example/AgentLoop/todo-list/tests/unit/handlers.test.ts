/**
 * Todo 工具处理函数单元测试
 * 测试 5 个工具 handler 的业务逻辑、参数校验和错误处理。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TodoStore } from '../../src/store.js';
import {
  createCreateTodoHandler,
  createListTodosHandler,
  createGetTodoHandler,
  createUpdateTodoHandler,
  createDeleteTodoHandler,
} from '../../src/handlers.js';
import type { ToolHandler } from '../../src/types.js';

describe('Tool Handlers', () => {
  let store: TodoStore;

  beforeEach(() => {
    store = new TodoStore();
  });

  describe('createCreateTodoHandler', () => {
    let handler: ToolHandler;
    beforeEach(() => { handler = createCreateTodoHandler(store); });

    it('should create a todo with valid title', () => {
      const result = handler({ title: 'Buy groceries' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>).title).toBe('Buy groceries');
        expect((result.data as Record<string, unknown>).status).toBe('pending');
      }
    });

    it('should create a todo with title and description', () => {
      const result = handler({ title: 'Buy groceries', description: 'Milk, eggs' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>).description).toBe('Milk, eggs');
      }
    });

    it('should reject empty title', () => {
      const result = handler({ title: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Title is required and cannot be empty');
      }
    });

    it('should reject whitespace-only title', () => {
      const result = handler({ title: '   ' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Title is required and cannot be empty');
      }
    });

    it('should reject title exceeding 200 characters', () => {
      const result = handler({ title: 'A'.repeat(201) });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Title must not exceed');
      }
    });

    it('should accept title of exactly 200 characters', () => {
      const result = handler({ title: 'A'.repeat(200) });
      expect(result.success).toBe(true);
    });

    it('should accept single character title', () => {
      const result = handler({ title: 'A' });
      expect(result.success).toBe(true);
    });

    it('should reject description exceeding 1000 characters', () => {
      const result = handler({ title: 'Test', description: 'A'.repeat(1001) });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Description must not exceed');
      }
    });

    it('should default description to empty string', () => {
      const result = handler({ title: 'Test' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>).description).toBe('');
      }
    });
  });

  describe('createListTodosHandler', () => {
    let handler: ToolHandler;
    beforeEach(() => { handler = createListTodosHandler(store); });

    it('should return empty list when no todos', () => {
      const result = handler({});
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as { todos: unknown[]; total: number };
        expect(data.todos).toEqual([]);
        expect(data.total).toBe(0);
      }
    });

    it('should return todo summaries without description', () => {
      store.create('Task 1', 'Description 1');
      const result = handler({});
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as { todos: Record<string, unknown>[]; total: number };
        expect(data.total).toBe(1);
        expect(data.todos[0]).toHaveProperty('id');
        expect(data.todos[0]).toHaveProperty('title');
        expect(data.todos[0]).toHaveProperty('status');
        expect(data.todos[0]).toHaveProperty('createdAt');
        expect(data.todos[0]).not.toHaveProperty('description');
      }
    });
  });

  describe('createGetTodoHandler', () => {
    let handler: ToolHandler;
    beforeEach(() => { handler = createGetTodoHandler(store); });

    it('should return full todo details', () => {
      const created = store.create('Test', 'Desc');
      const result = handler({ id: created.id });
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as Record<string, unknown>;
        expect(data.title).toBe('Test');
        expect(data.description).toBe('Desc');
      }
    });

    it('should return error for non-existent id', () => {
      const result = handler({ id: 'non-existent-id' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Todo with id 'non-existent-id' not found");
      }
    });
  });

  describe('createUpdateTodoHandler', () => {
    let handler: ToolHandler;
    beforeEach(() => { handler = createUpdateTodoHandler(store); });

    it('should update title only', () => {
      const created = store.create('Old', 'Desc');
      const result = handler({ id: created.id, title: 'New' });
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as Record<string, unknown>;
        expect(data.title).toBe('New');
        expect(data.description).toBe('Desc');
      }
    });

    it('should update status to in_progress', () => {
      const created = store.create('Test');
      const result = handler({ id: created.id, status: 'in_progress' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>).status).toBe('in_progress');
      }
    });

    it('should update status to completed', () => {
      const created = store.create('Test');
      store.update(created.id, { status: 'in_progress' });
      const result = handler({ id: created.id, status: 'completed' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>).status).toBe('completed');
      }
    });

    it('should allow reverting completed to pending', () => {
      const created = store.create('Test');
      store.update(created.id, { status: 'completed' });
      const result = handler({ id: created.id, status: 'pending' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>).status).toBe('pending');
      }
    });

    it('should update multiple fields simultaneously', () => {
      const created = store.create('Old', 'Old desc');
      const result = handler({
        id: created.id,
        title: 'New',
        description: 'New desc',
        status: 'in_progress',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as Record<string, unknown>;
        expect(data.title).toBe('New');
        expect(data.description).toBe('New desc');
        expect(data.status).toBe('in_progress');
      }
    });

    it('should reject when no fields provided', () => {
      const created = store.create('Test');
      const result = handler({ id: created.id });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('At least one field (title, description, status) must be provided');
      }
    });

    it('should reject empty title', () => {
      const created = store.create('Test');
      const result = handler({ id: created.id, title: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Title is required and cannot be empty');
      }
    });

    it('should reject invalid status', () => {
      const created = store.create('Test');
      const result = handler({ id: created.id, status: 'invalid_status' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Invalid status 'invalid_status'");
      }
    });

    it('should return error for non-existent id', () => {
      const result = handler({ id: 'non-existent-id', title: 'New' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Todo with id 'non-existent-id' not found");
      }
    });
  });

  describe('createDeleteTodoHandler', () => {
    let handler: ToolHandler;
    beforeEach(() => { handler = createDeleteTodoHandler(store); });

    it('should delete existing todo', () => {
      const created = store.create('Test');
      const result = handler({ id: created.id });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>).message).toContain('deleted successfully');
      }
    });

    it('should make deleted todo unfindable', () => {
      const created = store.create('Test');
      handler({ id: created.id });
      expect(store.get(created.id)).toBeUndefined();
    });

    it('should remove todo from list', () => {
      const todo1 = store.create('Task 1');
      store.create('Task 2');
      handler({ id: todo1.id });
      expect(store.size).toBe(1);
    });

    it('should return error for non-existent id', () => {
      const result = handler({ id: 'non-existent-id' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Todo with id 'non-existent-id' not found");
      }
    });
  });
});
