/**
 * Todo-List Tool 入口文件（对齐 Anthropic Claude API + Claude Code）
 *
 * 组装所有模块，创建注册了 TodoWrite 工具的注册表。
 *
 * 核心导出：
 * - createTodoTools — 工厂函数，返回注册了 TodoWrite 的 ToolRegistry
 * - 所有模块的类型和实现重导出
 */

import { TodoStore } from './store.js';
import { ToolRegistry } from './registry.js';
import { todoWriteDefinition } from './tools.js';
import { createTodoWriteHandler } from './handlers.js';

/** 创建完整的 todo-list 工具集（TodoWrite） */
export function createTodoTools(): ToolRegistry {
  const store = new TodoStore();
  const registry = new ToolRegistry();

  registry.register(todoWriteDefinition, createTodoWriteHandler(store));

  return registry;
}

export { TodoStore } from './store.js';
export { ToolRegistry } from './registry.js';
export * from './types.js';
export * from './tools.js';
export * from './handlers.js';
