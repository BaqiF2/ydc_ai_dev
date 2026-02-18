/**
 * Todo 内存存储层
 *
 * 使用 JavaScript Map 实现的 CRUD 操作。
 * - TodoStore: 内存存储类
 * - MAX_TITLE_LENGTH / MAX_DESCRIPTION_LENGTH: 长度限制常量
 */

import crypto from 'node:crypto';
import type { Todo, TodoStatus } from './types.js';

const MAX_TITLE_LENGTH = parseInt(process.env.TODO_MAX_TITLE_LENGTH || '200', 10);
const MAX_DESCRIPTION_LENGTH = parseInt(process.env.TODO_MAX_DESCRIPTION_LENGTH || '1000', 10);
export { MAX_TITLE_LENGTH, MAX_DESCRIPTION_LENGTH };

/** Todo 内存存储：封装 Map 提供类型安全的 CRUD */
export class TodoStore {
  private todos: Map<string, Todo> = new Map();

  create(title: string, description: string = ''): Todo {
    const now = new Date().toISOString();
    const todo: Todo = {
      id: crypto.randomUUID(),
      title,
      description,
      status: 'pending' as TodoStatus,
      createdAt: now,
      updatedAt: now,
    };
    this.todos.set(todo.id, todo);
    return todo;
  }

  list(): Todo[] {
    return Array.from(this.todos.values())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  get(id: string): Todo | undefined {
    return this.todos.get(id);
  }

  update(id: string, fields: Partial<Pick<Todo, 'title' | 'description' | 'status'>>): Todo | undefined {
    const todo = this.todos.get(id);
    if (!todo) return undefined;
    if (fields.title !== undefined) todo.title = fields.title;
    if (fields.description !== undefined) todo.description = fields.description;
    if (fields.status !== undefined) todo.status = fields.status;
    todo.updatedAt = new Date().toISOString();
    return todo;
  }

  delete(id: string): boolean {
    return this.todos.delete(id);
  }

  get size(): number {
    return this.todos.size;
  }
}
