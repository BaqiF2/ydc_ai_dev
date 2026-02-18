/**
 * TodoStore 单元测试
 *
 * 测试目标：验证 TodoStore 的数组整体替换模式（write/read/副本/初始状态）
 * BDD 来源：todo-store.json（5 个场景）
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TodoStore } from '../../src/store.js';
import type { Todo } from '../../src/types.js';

describe('TodoStore', () => {
  let store: TodoStore;

  const makeTodo = (content: string, status: Todo['status'] = 'pending'): Todo => ({
    content,
    status,
    activeForm: `Working on ${content}`,
  });

  beforeEach(() => {
    store = new TodoStore();
  });

  it('write replaces store with the given todos', () => {
    const todos = [
      makeTodo('Task A'),
      makeTodo('Task B'),
      makeTodo('Task C'),
    ];

    store.write(todos);
    const result = store.read();

    expect(result).toHaveLength(3);
    expect(result[0].content).toBe('Task A');
    expect(result[1].content).toBe('Task B');
    expect(result[2].content).toBe('Task C');
  });

  it('write overwrites previous data completely', () => {
    store.write([makeTodo('Old A'), makeTodo('Old B')]);
    store.write([makeTodo('New A')]);

    const result = store.read();
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('New A');
  });

  it('write with empty array clears the store', () => {
    store.write([makeTodo('A'), makeTodo('B'), makeTodo('C')]);
    store.write([]);

    const result = store.read();
    expect(result).toHaveLength(0);
  });

  it('read returns a copy, mutations do not affect store', () => {
    store.write([makeTodo('A'), makeTodo('B')]);

    const result = store.read();
    result.push(makeTodo('C'));
    result[0].content = 'mutated';

    const fresh = store.read();
    expect(fresh).toHaveLength(2);
    expect(fresh[0].content).toBe('A');
  });

  it('initial state is empty', () => {
    const result = store.read();
    expect(result).toHaveLength(0);
    expect(result).toEqual([]);
  });
});
