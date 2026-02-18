/**
 * 工具注册表（异步执行 + tool_use_id 关联，对齐 Anthropic API）
 *
 * 管理工具的注册、查找和执行，executeTool 接收 tool_use_id 并返回标准 ToolResult。
 *
 * 核心导出：
 * - ToolRegistry — 注册表类（register / getTool / getToolDefinitions / executeTool）
 */

import type { ToolDefinition, ToolHandler, ToolResult, RegisteredTool } from './types.js';

/** 工具注册表：将工具 Schema 和 Handler 绑定，支持异步执行和 tool_use_id 关联 */
export class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();

  /** 注册工具（Schema + async Handler） */
  register(definition: ToolDefinition, handler: ToolHandler): void {
    this.tools.set(definition.name, { definition, handler });
  }

  /** 按名称查找已注册的工具 */
  getTool(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  /** 获取所有工具 Schema 列表（发送给 LLM） */
  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => t.definition);
  }

  /** 执行指定工具：接收 tool_use_id，返回标准 ToolResult */
  async executeTool(toolUseId: string, name: string, params: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: `Tool '${name}' not found`,
        is_error: true,
      };
    }

    const handlerResult = await tool.handler(params);

    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: handlerResult.content,
      is_error: handlerResult.is_error,
    };
  }
}
