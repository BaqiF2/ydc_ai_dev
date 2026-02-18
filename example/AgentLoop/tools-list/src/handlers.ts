/**
 * Todo 工具处理函数（异步 Handler，对齐 Anthropic API）
 *
 * 核心导出：
 * - TodoSchema — 单条 Todo 的 Zod 校验 Schema（content/activeForm 自动 trim，status 枚举校验）
 * - createTodoWriteHandler — TodoWrite 处理函数（Zod 校验 + 整体替换 + 返回更新后列表）
 */

import { z } from 'zod';
import { TodoStore } from './store.js';
import type { ToolHandler, ToolHandlerResult } from './types.js';
import { VALID_STATUSES } from './types.js';

/** 单条 Todo 校验 Schema：content/activeForm 自动 trim，status 枚举校验 */
export const TodoSchema = z.object({
  content: z.string({ error: 'content is required and cannot be empty' })
    .trim()
    .min(1, 'content is required and cannot be empty'),
  status: z.enum(VALID_STATUSES, {
    error: (issue) =>
      `invalid status '${issue.input}'. Must be one of: ${VALID_STATUSES.join(', ')}`,
  }),
  activeForm: z.string({ error: 'activeForm is required and cannot be empty' })
    .trim()
    .min(1, 'activeForm is required and cannot be empty'),
});

/** 创建 TodoWrite handler：Zod 校验 todos 数组 → 整体替换 store → 返回更新后列表 */
export function createTodoWriteHandler(store: TodoStore): ToolHandler {
  return async (params: Record<string, unknown>): Promise<ToolHandlerResult> => {
    const { todos } = params;

    if (todos === undefined) {
      return { content: "'todos' array is required", is_error: true };
    }

    if (!Array.isArray(todos)) {
      return { content: "'todos' must be an array", is_error: true };
    }

    const result = z.array(TodoSchema).safeParse(todos);
    if (!result.success) {
      const issue = result.error.issues[0];
      const index = issue.path[0] as number;
      return { content: `Todo at index ${index}: ${issue.message}`, is_error: true };
    }

    store.write(result.data);
    return { content: JSON.stringify({ todos: store.read() }), is_error: false };
  };
}
