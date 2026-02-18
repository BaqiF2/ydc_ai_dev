/**
 * Todo 工具 Schema 定义（对齐 Anthropic API input_schema 标准）
 *
 * 核心导出：
 * - todoWriteDefinition — TodoWrite 工具 Schema（整体替换任务列表，返回更新后结果）
 */

import type { ToolDefinition } from './types.js';

/** TodoWrite 工具定义：接收完整 todos 数组，整体替换当前任务列表，返回更新后的列表 */
export const todoWriteDefinition: ToolDefinition = {
  name: 'TodoWrite',
  description: 'Write the entire todo list. Replaces all existing todos with the provided array and returns the updated list. Pass an empty array to clear all todos.',
  input_schema: {
    type: 'object',
    properties: {
      todos: {
        type: 'array',
        description: 'The complete list of todos to write. This replaces all existing todos.',
        items: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'The todo task content in imperative form.',
              minLength: 1,
            },
            status: {
              type: 'string',
              description: 'The current status of the todo.',
              enum: ['pending', 'in_progress', 'completed'],
            },
            activeForm: {
              type: 'string',
              description: 'Present continuous form shown when task is in progress.',
              minLength: 1,
            },
          },
          required: ['content', 'status', 'activeForm'],
          additionalProperties: false,
        },
      },
    },
    required: ['todos'],
  },
};
