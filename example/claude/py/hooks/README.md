# Hooks 示例

本目录包含使用 Claude Agent SDK 的 hooks 功能的示例代码。

钩子有两个部分：

- 回调函数：钩子触发时运行的逻辑
- 钩子配置：告诉 SDK 要钩入哪个事件（如 PreToolUse）以及要匹配哪些工具

## 目录结构

### 文件说明

#### `agent.py`
- **作用**: 演示 Claude Agent SDK 的 hooks 功能的命令行工具
- **状态**: ✅ **完全可用**
- **主要功能**:
  1. 提供基于 Claude Agent SDK 的命令行交互界面
  2. 支持多种工具调用：Read、Edit、Glob、WebSearch、Bash、Write
  3. 自动批准文件编辑操作 (permission_mode="acceptEdits")
  4. 使用 PostToolUse Hook 记录所有文件修改操作到 `audit.log`
  5. 实时流式输出 Claude 的推理过程和工具调用结果
  6. 支持命令行参数或交互式输入

- **Hook 实现**:
  - 使用正确的函数回调方式实现 Hook
  - 在 Edit 和 Write 工具执行后自动记录审计日志
  - Hook 配置: `PostToolUse` + `HookMatcher(matcher="Edit|Write")`

- **使用方法**:
  ```bash
  # 交互式输入
  python agent.ts

  # 直接传递 prompt
  python agent.ts "你的任务描述"
  ```

## Hook 功能说明

本示例展示了如何正确使用 Claude Agent SDK 的 Hooks 功能：

1. **Hook 类型**: PostToolUse - 在工具执行后触发
2. **匹配器**: 使用正则表达式 "Edit|Write" 匹配文件修改工具
3. **回调函数**: `audit_file_changes` - 异步函数，记录工具使用日志
4. **审计日志**: 所有文件修改操作都会记录到 `audit.log`，包含时间戳和工具名称

## 参考资料

- [官方 Hooks 详细文档](https://platform.claude.com/docs/zh-CN/agent-sdk/hooks) - 包含所有正确的示例
- [Claude Agent SDK 概览](https://platform.claude.com/docs/zh-CN/agent-sdk/overview)
- [Claude Agent SDK GitHub](https://github.com/anthropics/claude-agent-sdk-python)
