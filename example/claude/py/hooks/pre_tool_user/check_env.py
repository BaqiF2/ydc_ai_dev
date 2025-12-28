import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions, HookMatcher


# 定义一个接收工具调用详情的钩子回调
async def protect_env_files(input_data, tool_use_id, context):
    # 从工具的输入参数中提取文件路径
    file_path = input_data['tool_input'].get('file_path', '')
    file_name = file_path.split('/')[-1]

    # 如果目标是 .env 文件，则阻止操作
    print(f"调用工具: {tool_use_id}")
    if file_name == '.env':
        print(f"Blocking attempt to modify {file_path}")
        return {
            'hookSpecificOutput': {
                'hookEventName': input_data['hook_event_name'],
                'permissionDecision': 'deny',
                'permissionDecisionReason': 'Cannot modify .env files'
            }
        }
    # 返回空对象以允许操作
    return {}


async def main():
    async for message in query(
            prompt="Update the database configuration",
            options=ClaudeAgentOptions(
                system_prompt="中文回复",
                hooks={
                    # 为 PreToolUse 事件注册钩子
                    # 匹配器仅过滤 Write 和 Edit 工具调用
                    'PreToolUse': [HookMatcher(matcher='Bash|Glob', hooks=[protect_env_files])]
                }
            )
    ):
        print(message)


asyncio.run(main())
