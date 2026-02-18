/**
 * Todo 工具 Schema 定义
 *
 * 5 个工具的 JSON Schema，供 LLM 理解工具名称、用途和参数。
 * - createTodoDefinition / listTodosDefinition / getTodoDefinition
 * - updateTodoDefinition / deleteTodoDefinition
 * - allToolDefinitions: 所有工具 Schema 列表
 */

import type { ToolDefinition } from './types.js';
import { MAX_TITLE_LENGTH, MAX_DESCRIPTION_LENGTH } from './store.js';

export const createTodoDefinition: ToolDefinition = {
  name: 'create_todo',
  description: 'Create a new todo task with a title and optional description. The task will be created with pending status.',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: `The title of the todo task (1-${MAX_TITLE_LENGTH} characters)`, maxLength: MAX_TITLE_LENGTH },
      description: { type: 'string', description: `Optional description (0-${MAX_DESCRIPTION_LENGTH} characters)`, maxLength: MAX_DESCRIPTION_LENGTH },
    },
    required: ['title'],
  },
};

export const listTodosDefinition: ToolDefinition = {
  name: 'list_todos',
  description: 'List all todo tasks. Returns a summary (id, title, status, createdAt) sorted by creation time (newest first).',
  inputSchema: { type: 'object', properties: {} },
};

export const getTodoDefinition: ToolDefinition = {
  name: 'get_todo',
  description: 'Get the full details of a single todo task by its ID.',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'The ID of the todo task to retrieve' } },
    required: ['id'],
  },
};

export const updateTodoDefinition: ToolDefinition = {
  name: 'update_todo',
  description: 'Update an existing todo task. You can update title, description, and/or status. At least one field must be provided.',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'The ID of the todo task to update' },
      title: { type: 'string', description: `New title (1-${MAX_TITLE_LENGTH} characters)`, maxLength: MAX_TITLE_LENGTH },
      description: { type: 'string', description: `New description (0-${MAX_DESCRIPTION_LENGTH} characters)`, maxLength: MAX_DESCRIPTION_LENGTH },
      status: { type: 'string', description: 'New status for the task', enum: ['pending', 'in_progress', 'completed'] },
    },
    required: ['id'],
  },
};

export const deleteTodoDefinition: ToolDefinition = {
  name: 'delete_todo',
  description: 'Delete a todo task by its ID. This action is permanent.',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'The ID of the todo task to delete' } },
    required: ['id'],
  },
};

export const allToolDefinitions: ToolDefinition[] = [
  createTodoDefinition, listTodosDefinition, getTodoDefinition,
  updateTodoDefinition, deleteTodoDefinition,
];
