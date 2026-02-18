/**
 * TodoWrite Handler 单元测试
 *
 * 测试目标：验证 handler 的校验逻辑、整体替换行为、返回更新后列表和错误处理
 * BDD 来源：todo-write.json
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TodoStore } from '../../src/store.js';
import { createTodoWriteHandler } from '../../src/handlers.js';
import type { ToolHandler, Todo } from '../../src/types.js';

describe('TodoWrite Handler', () => {
  let store: TodoStore;
  let writeHandler: ToolHandler;

  const validTodo = (content: string, status: Todo['status'] = 'pending') => ({
    content,
    status,
    activeForm: `Working on ${content}`,
  });

  beforeEach(() => {
    store = new TodoStore();
    writeHandler = createTodoWriteHandler(store);
  });

  it('writes multiple todos and returns updated list', async () => {
    const result = await writeHandler({
      todos: [
        validTodo('Task A'),
        validTodo('Task B', 'in_progress'),
        validTodo('Task C', 'completed'),
      ],
    });

    const parsed = JSON.parse(result.content);
    expect(parsed.todos).toHaveLength(3);
    expect(parsed.todos[0].content).toBe('Task A');
    expect(parsed.todos[1].status).toBe('in_progress');
    expect(parsed.todos[2].status).toBe('completed');
    expect(result.is_error).toBe(false);
  });

  it('replaces existing todos completely', async () => {
    store.write([
      { content: 'Old A', status: 'pending', activeForm: 'Working on Old A' },
      { content: 'Old B', status: 'pending', activeForm: 'Working on Old B' },
    ]);

    const result = await writeHandler({
      todos: [validTodo('New A')],
    });

    const parsed = JSON.parse(result.content);
    expect(parsed.todos).toHaveLength(1);
    expect(parsed.todos[0].content).toBe('New A');
  });

  it('clears all todos with empty array', async () => {
    store.write([
      { content: 'A', status: 'pending', activeForm: 'Working' },
      { content: 'B', status: 'pending', activeForm: 'Working' },
      { content: 'C', status: 'pending', activeForm: 'Working' },
    ]);

    const result = await writeHandler({ todos: [] });
    const parsed = JSON.parse(result.content);
    expect(parsed.todos).toHaveLength(0);
    expect(result.is_error).toBe(false);
  });

  it('returns error when todos field is missing', async () => {
    const result = await writeHandler({});
    expect(result.is_error).toBe(true);
    expect(result.content).toBe("'todos' array is required");
  });

  it('returns error when todos is not an array', async () => {
    const result = await writeHandler({ todos: 'not-an-array' });
    expect(result.is_error).toBe(true);
    expect(result.content).toBe("'todos' must be an array");
  });

  it('returns error when content is empty string', async () => {
    const result = await writeHandler({
      todos: [
        validTodo('Valid'),
        { content: '', status: 'pending', activeForm: 'Working' },
      ],
    });
    expect(result.is_error).toBe(true);
    expect(result.content).toBe('Todo at index 1: content is required and cannot be empty');
  });

  it('returns error when content is whitespace only', async () => {
    const result = await writeHandler({
      todos: [
        { content: '   ', status: 'pending', activeForm: 'Working' },
      ],
    });
    expect(result.is_error).toBe(true);
    expect(result.content).toBe('Todo at index 0: content is required and cannot be empty');
  });

  it('returns error when status is invalid', async () => {
    const result = await writeHandler({
      todos: [
        { content: 'Task', status: 'invalid', activeForm: 'Working' },
      ],
    });
    expect(result.is_error).toBe(true);
    expect(result.content).toBe("Todo at index 0: invalid status 'invalid'. Must be one of: pending, in_progress, completed");
  });

  it('returns error when activeForm is empty', async () => {
    const result = await writeHandler({
      todos: [
        { content: 'Task', status: 'pending', activeForm: '' },
      ],
    });
    expect(result.is_error).toBe(true);
    expect(result.content).toBe('Todo at index 0: activeForm is required and cannot be empty');
  });

  it('does not modify store on validation failure', async () => {
    store.write([
      { content: 'Existing A', status: 'pending', activeForm: 'Working on A' },
      { content: 'Existing B', status: 'pending', activeForm: 'Working on B' },
    ]);

    const result = await writeHandler({
      todos: [{ content: '', status: 'pending', activeForm: 'Working' }],
    });
    expect(result.is_error).toBe(true);

    const stored = store.read();
    expect(stored).toHaveLength(2);
    expect(stored[0].content).toBe('Existing A');
    expect(stored[1].content).toBe('Existing B');
  });

  it('reports only the first error when multiple items are invalid', async () => {
    const result = await writeHandler({
      todos: [
        { content: '', status: 'pending', activeForm: 'Working' },
        { content: 'Task', status: 'invalid', activeForm: 'Working' },
      ],
    });
    expect(result.is_error).toBe(true);
    expect(result.content).toContain('index 0');
    expect(result.content).not.toContain('index 1');
  });
});
