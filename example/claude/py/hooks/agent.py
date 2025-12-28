"""
Claude Agent 命令行工具

主要功能：
1. 提供基于 Claude Agent SDK 的命令行交互界面
2. 支持多种工具调用：文件读取(Read)、文件编辑(Edit)、文件搜索(Glob)、网页搜索(WebSearch)、命令执行(Bash)
3. 自动批准文件编辑操作(permission_mode="acceptEdits")
4. 记录所有文件修改操作到审计日志(audit.log)
5. 实时流式输出 Claude 的推理过程和工具调用结果
6. 支持通过命令行参数或交互式输入接收用户 prompt
"""

import asyncio
import argparse
from claude_agent_sdk import query, ClaudeAgentOptions, AssistantMessage, ResultMessage, HookMatcher
from datetime import datetime


# 定义 Hook 回调函数（而不是使用 command 字符串）
async def audit_file_changes(input_data, tool_use_id, context):
    """在文件修改后记录到 audit.log"""
    if input_data['hook_event_name'] == 'PostToolUse':
        tool_name = input_data.get('tool_name', 'Unknown')
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # 将审计信息写入文件
        with open('./audit.log', 'a') as f:
            f.write(f"{timestamp}: {tool_name} tool used - file modified\n")

        print(f"[AUDIT] Logged to audit.log: {tool_name} at {timestamp}")

    return {}


async def main(prompt: str):
    # Agentic loop: streams messages as Claude works
    async for message in query(
            prompt=prompt,
            options=ClaudeAgentOptions(
                allowed_tools=["Read", "Edit", "Glob", "WebSearch", "Bash", "Write"],  # Tools Claude can use
                permission_mode="acceptEdits",  # Auto-approve file edits
                system_prompt="你是一个AI助手，帮助用户完成任务",
                # 将所有文件更改记录到审计文件
                hooks={
                    "PostToolUse": [HookMatcher(
                        matcher="Edit|Write",
                        hooks=[audit_file_changes]  # 传递函数回调
                    )]
                }
            ),

    ):
        # Print human-readable output
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if hasattr(block, "text"):
                    print(block.text)  # Claude's reasoning
                elif hasattr(block, "name"):
                    print(f"Tool: {block.name}")  # Tool being called
        elif isinstance(message, ResultMessage):
            print(f"Done: {message.subtype}")  # Final result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Claude-Agent CLI")
    parser.add_argument("prompt", nargs="?", default="", help="输入的prompt内容")
    args = parser.parse_args()

    print("=== 启动Claude-Agent ===")
    prompt = args.prompt if args.prompt else input("请输入prompt: ")
    asyncio.run(main(prompt))
