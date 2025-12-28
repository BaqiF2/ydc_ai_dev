# 导入Claude SDK的查询函数、代理选项类和结果消息类
from claude_agent_sdk import query, ClaudeAgentOptions, ResultMessage
import asyncio  # 用于异步编程的库


# 异步函数：展示单消息查询示例
async def single_message_example():
    # 使用query()函数进行简单的一次性查询
    async for message in query(
            prompt="Explain the authentication flow",  # 提示：分析认证流程
            options=ClaudeAgentOptions(
                max_turns=1,  # 最大对话轮数
                allowed_tools=["Read", "Grep"]  # 允许使用的工具列表
            )
    ):
        # 检查消息是否为结果消息
        if isinstance(message, ResultMessage):
            print(message.result)  # 打印结果

    # 使用会话管理继续对话
    async for message in query(
            prompt="Now explain the authorization process",  # 提示：现在解释授权过程
            options=ClaudeAgentOptions(
                system_prompt="中文回复",  # 系统提示：使用中文回复
                continue_conversation=True,  # 继续之前的对话
                max_turns=1  # 最大对话轮数
            )
    ):
        # 检查消息是否为结果消息
        if isinstance(message, ResultMessage):
            print(message.result)  # 打印结果


# 运行异步函数
asyncio.run(single_message_example())
