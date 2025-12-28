# 导入Claude SDK客户端、选项类以及消息相关的数据结构
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, AssistantMessage, TextBlock, ToolResultBlock, \
    ToolUseBlock
import asyncio  # 用于异步编程的库
import base64  # 用于图片等二进制数据的Base64编码


# 异步函数：实现流式分析功能
async def streaming_analysis():
    # 定义一个异步生成器函数，用于按时间顺序生成消息
    async def message_generator():
        # 第一条消息 - 纯文本消息
        yield {
            "type": "user",
            "message": {
                "role": "user",
                "content": "Analyze this codebase for security issues"  # 分析此代码库的安全问题
            }
        }

        # 等待2秒，模拟处理时间或条件等待
        await asyncio.sleep(2)

        # 第二条消息 - 包含文本和图片的消息
        # 读取图片文件并转换为Base64编码
        with open("storm.png", "rb") as f:
            image_data = base64.b64encode(f.read()).decode()

        yield {
            "type": "user",
            "message": {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Review this architecture diagram"  # 审查此架构图
                    },
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": image_data  # 图片的Base64编码数据
                        }
                    }
                ]
            }
        }

    # 配置Claude代理的选项
    options = ClaudeAgentOptions(
        system_prompt="使用中文回复",  # 系统提示：使用中文回复
        max_turns=10,  # 最大对话轮数
        allowed_tools=["Read", "Grep"]  # 允许使用的工具列表
    )

    # 创建Claude SDK客户端实例并使用异步上下文管理器
    async with ClaudeSDKClient(options) as client:
        # 发送流式输入消息
        await client.query(message_generator())

        # 处理并接收响应消息
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


# 运行异步函数
asyncio.run(streaming_analysis())
