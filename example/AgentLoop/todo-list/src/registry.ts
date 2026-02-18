/**
 * 工具注册表
 *
 * 管理工具的注册、查找和执行。
 * - ToolRegistry: 注册表类（register / getTool / getToolDefinitions / executeTool）
 */

import type { ToolDefinition, ToolHandler, ToolResult, RegisteredTool } from './types.js';

/** 工具注册表：将工具 Schema 和 Handler 绑定，供 agent loop 使用 */
export class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();

  /** 注册工具（Schema + Handler） */
  register(definition: ToolDefinition, handler: ToolHandler): void {
    this.tools.set(definition.name, { definition, handler });
  }

  /** 按名称查找已注册的工具 */
  getTool(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  /** 获取所有工具 Schema 列表（发送给 LLM） */
  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  /** 执行指定工具：LLM 选择工具后，通过此方法调用 Handler */
  executeTool(name: string, params: Record<string, unknown>): ToolResult {
    const tool = this.tools.get(name);
    if (!tool) return { success: false, error: `Tool '${name}' not found` };
    return tool.handler(params);
  }
}
