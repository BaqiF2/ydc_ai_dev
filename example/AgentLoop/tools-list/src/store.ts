/**
 * Todo 内存存储层（数组整体替换模式）
 *
 * 对齐 Claude Code 的 TodoWrite 整体替换模式，不再使用 Map CRUD。
 *
 * 核心导出：
 * - TodoStore — 内存存储类，提供 write（整体替换）和 read（返回副本）两个方法
 */

import type { Todo } from './types.js';

/** Todo 内存存储：整体替换模式，write 覆盖、read 返回副本 */
export class TodoStore {
  private todos: Todo[] = [];

  /** 整体替换当前任务列表 */
  write(todos: Todo[]): void {
    this.todos = todos.map(t => ({ ...t }));
  }

  /** 读取所有任务（返回副本，修改不影响 store） */
  read(): Todo[] {
    return this.todos.map(t => ({ ...t }));
  }
}
