/**
 * Todo-List Tool 类型定义（对齐 Anthropic Claude API + Claude Code）
 *
 * 核心导出：
 * - Todo / TodoStatus / VALID_STATUSES — 任务数据模型（对齐 Claude Code TodoWrite）
 * - ToolDefinition — 工具 Schema 定义（对齐 Anthropic API input_schema）
 * - ToolHandlerResult — Handler 内部返回格式（不含 tool_use_id）
 * - ToolResult — 最终工具执行结果（对齐 Anthropic tool_result 标准格式）
 * - ToolHandler — 异步工具处理函数类型
 * - RegisteredTool — 已注册工具（Schema + Handler）
 */

/** 合法状态值列表，用于运行时校验 */
export const VALID_STATUSES = ['pending', 'in_progress', 'completed'] as const;

/** 任务状态：pending（待办）| in_progress（进行中）| completed（已完成） */
export type TodoStatus = typeof VALID_STATUSES[number];

/** Todo 任务数据模型（对齐 Claude Code：content + status + activeForm） */
export interface Todo {
  content: string;
  status: TodoStatus;
  activeForm: string;
}

/** 工具 Schema 定义（对齐 Anthropic API：input_schema snake_case） */
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/** Handler 内部返回格式（不含 tool_use_id，由 Registry 组装） */
export interface ToolHandlerResult {
  content: string;
  is_error?: boolean;
}

/** 最终工具执行结果（对齐 Anthropic tool_result 标准格式） */
export interface ToolResult {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

/** 异步工具处理函数：接收参数，返回 Promise<ToolHandlerResult> */
export type ToolHandler = (params: Record<string, unknown>) => Promise<ToolHandlerResult>;

/** 已注册的工具：Schema 定义 + 异步处理函数 */
export interface RegisteredTool {
  definition: ToolDefinition;
  handler: ToolHandler;
}
