/**
 * Todo-List Tool 入口文件
 *
 * 组装所有模块，创建完整的工具注册表。
 * - createTodoTools: 工厂函数，返回注册了所有 todo 工具的 ToolRegistry
 */

import { TodoStore } from './store.js';
import { ToolRegistry } from './registry.js';
import {
  createTodoDefinition, listTodosDefinition, getTodoDefinition,
  updateTodoDefinition, deleteTodoDefinition,
} from './tools.js';
import {
  createCreateTodoHandler, createListTodosHandler, createGetTodoHandler,
  createUpdateTodoHandler, createDeleteTodoHandler,
} from './handlers.js';

/** 创建完整的 todo-list 工具集 */
export function createTodoTools(): ToolRegistry {
  const store = new TodoStore();
  const registry = new ToolRegistry();

  registry.register(createTodoDefinition, createCreateTodoHandler(store));
  registry.register(listTodosDefinition, createListTodosHandler(store));
  registry.register(getTodoDefinition, createGetTodoHandler(store));
  registry.register(updateTodoDefinition, createUpdateTodoHandler(store));
  registry.register(deleteTodoDefinition, createDeleteTodoHandler(store));

  return registry;
}

export { TodoStore } from './store.js';
export { ToolRegistry } from './registry.js';
export * from './types.js';
export * from './tools.js';
export * from './handlers.js';
