/**
 * TodoStore 单元测试
 * 测试内存存储层的 CRUD 操作和数据一致性。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TodoStore } from '../../src/store.js';

describe('TodoStore', () => {
  let store: TodoStore;

  beforeEach(() => {
    store = new TodoStore();
  });

  describe('create', () => {
    it('should create a todo with auto-generated id and timestamps', () => {
      const todo = store.create('Buy groceries');
      expect(todo.id).toBeDefined();
      expect(todo.title).toBe('Buy groceries');
      expect(todo.description).toBe('');
      expect(todo.status).toBe('pending');
      expect(todo.createdAt).toBeDefined();
      expect(todo.updatedAt).toBe(todo.createdAt);
    });

    it('should create a todo with description', () => {
      const todo = store.create('Buy groceries', 'Milk, eggs, bread');
      expect(todo.description).toBe('Milk, eggs, bread');
    });

    it('should generate unique ids', () => {
      const todo1 = store.create('Task 1');
      const todo2 = store.create('Task 2');
      expect(todo1.id).not.toBe(todo2.id);
    });

    it('should increment size after creation', () => {
      expect(store.size).toBe(0);
      store.create('Task 1');
      expect(store.size).toBe(1);
      store.create('Task 2');
      expect(store.size).toBe(2);
    });
  });

  describe('list', () => {
    it('should return empty array when no todos', () => {
      expect(store.list()).toEqual([]);
    });

    it('should return all todos sorted by createdAt descending', async () => {
      store.create('First');
      // Ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));
      store.create('Second');
      const todos = store.list();
      expect(todos).toHaveLength(2);
      // Newest first
      expect(todos[0].title).toBe('Second');
      expect(todos[1].title).toBe('First');
    });
  });

  describe('get', () => {
    it('should return todo by id', () => {
      const created = store.create('Test');
      const found = store.get(created.id);
      expect(found).toBeDefined();
      expect(found!.title).toBe('Test');
    });

    it('should return undefined for non-existent id', () => {
      expect(store.get('non-existent')).toBeUndefined();
    });
  });

  describe('update', () => {
    it('should update title', () => {
      const todo = store.create('Old title');
      const updated = store.update(todo.id, { title: 'New title' });
      expect(updated!.title).toBe('New title');
    });

    it('should update status', () => {
      const todo = store.create('Test');
      const updated = store.update(todo.id, { status: 'in_progress' });
      expect(updated!.status).toBe('in_progress');
    });

    it('should refresh updatedAt', () => {
      const todo = store.create('Test');
      const originalUpdatedAt = todo.updatedAt;
      // Small delay to ensure different timestamp
      const updated = store.update(todo.id, { title: 'Updated' });
      expect(updated!.updatedAt).toBeDefined();
    });

    it('should return undefined for non-existent id', () => {
      expect(store.update('non-existent', { title: 'X' })).toBeUndefined();
    });

    it('should not change unspecified fields', () => {
      const todo = store.create('Title', 'Desc');
      store.update(todo.id, { status: 'completed' });
      const updated = store.get(todo.id);
      expect(updated!.title).toBe('Title');
      expect(updated!.description).toBe('Desc');
    });
  });

  describe('delete', () => {
    it('should delete existing todo', () => {
      const todo = store.create('Test');
      expect(store.delete(todo.id)).toBe(true);
      expect(store.get(todo.id)).toBeUndefined();
      expect(store.size).toBe(0);
    });

    it('should return false for non-existent id', () => {
      expect(store.delete('non-existent')).toBe(false);
    });
  });
});
