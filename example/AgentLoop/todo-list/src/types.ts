/**
 * Todo-List Tool 类型定义
 *
 * 核心类型接口：Todo 数据模型、ToolDefinition Schema 接口、
 * ToolHandler 处理函数类型、ToolResult 统一返回格式。
 */

/** 任务状态：pending（待办）| in_progress（进行中）| completed（已完成） */
export type TodoStatus = 'pending' | 'in_progress' | 'completed';

/** 合法状态值列表，用于运行时校验 */
export const VALID_STATUSES: readonly TodoStatus[] = ['pending', 'in_progress', 'completed'] as const;

/** Todo 任务数据模型 */
export interface Todo {
  id: string;
  title: string;
  description: string;
  status: TodoStatus;
  createdAt: string;
  updatedAt: string;
}

// 工具结构化结果：成功返回 data，失败返回 error

export interface ToolSuccess<T = unknown> { success: true; data: T }
export interface ToolError { success: false; error: string }
export type ToolResult<T = unknown> = ToolSuccess<T> | ToolError;

// 工具定义接口：Schema 告诉 LLM 工具叫什么、做什么、需要什么参数

/** 工具输入参数的 JSON Schema 定义 */
export interface InputSchema {
  type: 'object';
  properties: Record<string, {
    type: string;
    description: string;
    enum?: string[];
    maxLength?: number;
  }>;
  required?: string[];
}

/** 工具定义：名称 + 描述 + 输入参数 Schema */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: InputSchema;
}

/** 工具处理函数：接收参数对象，返回结构化结果 */
export type ToolHandler = (params: Record<string, unknown>) => ToolResult;

/** 已注册的工具：Schema 定义 + 处理函数 */
export interface RegisteredTool {
  definition: ToolDefinition;
  handler: ToolHandler;
}
