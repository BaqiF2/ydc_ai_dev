"""
Claude Agent SDK 权限控制示例 - can_use_tool 回调

演示如何使用 can_use_tool 回调实现自定义工具权限控制：
- 在工具执行前提示用户批准
- 显示工具名称和参数详情
- 允许用户批准或拒绝工具使用

重要配置要求：
1. 使用 permission_mode="default" 确保回调被触发
2. ⚠️ 必须使用流式模式 (ClaudeSDKClient) - can_use_tool 回调不支持非流式模式
3. 不能使用简单的字符串 prompt，需要使用 ClaudeSDKClient
"""
import json
import asyncio

from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, AssistantMessage, TextBlock, ToolUseBlock


async def prompt_for_tool_approval(tool_name: str, input_params: dict, context=None):
    """
    工具权限回调函数

    参数:
        tool_name: 工具名称 (如 "Write", "Bash", "Read")
        input_params: 工具的输入参数字典
        context: ToolPermissionContext 权限上下文 (SDK 第三个参数)
    """
    print(f"\n🔧 Tool Request:")
    print(f"   Tool: {tool_name}")

    # 显示参数
    if input_params:
        print("   Parameters:")
        for key, value in input_params.items():
            display_value = value
            if isinstance(value, str) and len(value) > 100:
                display_value = value[:100] + "..."
            elif isinstance(value, (dict, list)):
                display_value = json.dumps(value, indent=2)
            print(f"     {key}: {display_value}")

    # 获取用户批准
    answer = input("\n   Approve this tool use? (y/n): ")

    if answer.lower() in ['y', 'yes']:
        print("   ✅ Approved\n")
        return {
            "behavior": "allow",
            "updatedInput": input_params
        }
    else:
        print("   ❌ Denied\n")
        return {
            "behavior": "deny",
            "message": "User denied permission for this tool"
        }
    # 使用权限回调


async def main():
    async with ClaudeSDKClient(
            options=ClaudeAgentOptions(
                system_prompt="中文回复",
                permission_mode="default",  # 使用 default 模式才能触发 can_use_tool 回调
                can_use_tool=prompt_for_tool_approval
            )
    ) as client:
        await client.query("Help me analyze this codebase")

        # 接收第一阶段的响应
        async for message in client.receive_response():
            # 检查消息是否为助手回复
            if isinstance(message, AssistantMessage):
                # 遍历回复内容中的每个块
                for block in message.content:
                    # 如果是文本块，则打印文本内容
                    if isinstance(block, TextBlock):
                        print(block.text)
                    # 如果是工具使用块，则打印使用的工具名称
                    if isinstance(block, ToolUseBlock):
                        print(f"Tool used: {block.name}")


asyncio.run(main())
