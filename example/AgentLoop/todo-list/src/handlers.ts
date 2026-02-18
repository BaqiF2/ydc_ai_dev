/**
 * Todo 工具处理函数
 *
 * 5 个 handler 工厂函数，每个接收 TodoStore 返回 ToolHandler：
 * - createCreateTodoHandler / createListTodosHandler / createGetTodoHandler
 * - createUpdateTodoHandler / createDeleteTodoHandler
 */

import { TodoStore, MAX_TITLE_LENGTH, MAX_DESCRIPTION_LENGTH } from './store.js';
import type { ToolHandler, ToolResult } from './types.js';
import { VALID_STATUSES } from './types.js';

/** 创建任务 handler */
export function createCreateTodoHandler(store: TodoStore): ToolHandler {
  return (params: Record<string, unknown>): ToolResult => {
    const title = params.title as string | undefined;
    const description = (params.description as string | undefined) ?? '';

    if (!title || title.trim().length === 0) {
      return { success: false, error: 'Title is required and cannot be empty' };
    }
    if (title.length > MAX_TITLE_LENGTH) {
      return { success: false, error: `Title must not exceed ${MAX_TITLE_LENGTH} characters` };
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      return { success: false, error: `Description must not exceed ${MAX_DESCRIPTION_LENGTH} characters` };
    }

    return { success: true, data: store.create(title, description) };
  };
}

/** 查询任务列表 handler */
export function createListTodosHandler(store: TodoStore): ToolHandler {
  return (): ToolResult => {
    const todos = store.list().map(({ id, title, status, createdAt }) => ({ id, title, status, createdAt }));
    return { success: true, data: { todos, total: todos.length } };
  };
}

/** 查询单个任务 handler */
export function createGetTodoHandler(store: TodoStore): ToolHandler {
  return (params: Record<string, unknown>): ToolResult => {
    const id = params.id as string;
    const todo = store.get(id);
    if (!todo) return { success: false, error: `Todo with id '${id}' not found` };
    return { success: true, data: todo };
  };
}

/** 更新任务 handler */
export function createUpdateTodoHandler(store: TodoStore): ToolHandler {
  return (params: Record<string, unknown>): ToolResult => {
    const id = params.id as string;
    const title = params.title as string | undefined;
    const description = params.description as string | undefined;
    const status = params.status as string | undefined;

    if (title === undefined && description === undefined && status === undefined) {
      return { success: false, error: 'At least one field (title, description, status) must be provided' };
    }
    if (title !== undefined && title.trim().length === 0) {
      return { success: false, error: 'Title is required and cannot be empty' };
    }
    if (title !== undefined && title.length > MAX_TITLE_LENGTH) {
      return { success: false, error: `Title must not exceed ${MAX_TITLE_LENGTH} characters` };
    }
    if (description !== undefined && description.length > MAX_DESCRIPTION_LENGTH) {
      return { success: false, error: `Description must not exceed ${MAX_DESCRIPTION_LENGTH} characters` };
    }
    if (status !== undefined && !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      return { success: false, error: `Invalid status '${status}'. Must be one of: ${VALID_STATUSES.join(', ')}` };
    }
    if (!store.get(id)) {
      return { success: false, error: `Todo with id '${id}' not found` };
    }

    const fields: Record<string, unknown> = {};
    if (title !== undefined) fields.title = title;
    if (description !== undefined) fields.description = description;
    if (status !== undefined) fields.status = status;

    return { success: true, data: store.update(id, fields as Parameters<typeof store.update>[1]) };
  };
}

/** 删除任务 handler */
export function createDeleteTodoHandler(store: TodoStore): ToolHandler {
  return (params: Record<string, unknown>): ToolResult => {
    const id = params.id as string;
    if (!store.get(id)) return { success: false, error: `Todo with id '${id}' not found` };
    store.delete(id);
    return { success: true, data: { message: `Todo '${id}' deleted successfully` } };
  };
}
