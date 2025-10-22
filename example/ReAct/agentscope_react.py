"""
其实现方式就和1.0很类似，他通过逻辑代码来完成了整个过程
"""

import logging

from agentscope.agent import ReActAgent
from agentscope.model import DashScopeChatModel
from agentscope.formatter import DashScopeChatFormatter
from agentscope.memory import InMemoryMemory
from agentscope.tool import Toolkit, ToolResponse
from agentscope.message import Msg, TextBlock
import os
import asyncio

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# 定义一个简单的工具函数
def search_web(query: str) -> ToolResponse:
    """搜索工具"""
    logger.info(f"执行搜索: {query}")

    # 模拟搜索结果，实际应用中应该调用真实的搜索API
    search_data = {
        "黄金": "根据最新市场数据，今日黄金价格约为1159元/克（24K金），投资金条价格约为1080元/克。",
        "gold": "Current gold price is approximately $65 per gram (24K), investment gold bars around $63 per gram."
    }

    # 改进的关键词匹配逻辑
    query_lower = query.lower()
    # 简单的关键词匹配
    text = ''
    for key, value in search_data.items():
        if key in query_lower:
            text = value
            break

    return ToolResponse(
        content=[
            TextBlock(
                type="text",
                text=text,
            ),
        ],
    )


def calculate(expression: str) -> str:
    """计算工具"""
    logger.info(f"执行计算: {expression}")

    try:
        # 只允许数字、基本运算符和括号
        allowed_chars = set('0123456789+-*/(). ')
        if not all(c in allowed_chars for c in expression):
            text = "错误：表达式包含非法字符，只能使用数字和基本运算符(+-*/.)"

        result = eval(expression)
        text = f"计算结果：{result}"

    except ZeroDivisionError:
        text = "错误：除数不能为零"
    except Exception as e:
        text = f"计算错误：{str(e)}"

    return ToolResponse(
        content=[
            TextBlock(
                type="text",
                text=text,
            ),
        ],
    )


async def main():
    # 注册工具
    toolkit = Toolkit()
    toolkit.register_tool_function(search_web)
    toolkit.register_tool_function(calculate)

    # 创建 ReAct 智能体
    agent = ReActAgent(
        name="Assistant",
        sys_prompt="你是一个助手,可以调用工具完成任务。",
        model=DashScopeChatModel(
            model_name="qwen3-max",
            api_key=os.environ["DASHSCOPE_API_KEY"],
        ),
        memory=InMemoryMemory(),
        formatter=DashScopeChatFormatter(),
        toolkit=toolkit,
        max_iters=10,  # 最多10次推理-行动循环
    )

    msg = Msg("user", "我手上有1万块钱，我能买多少克黄金？", "user")

    # 发送需要多次工具调用的任务
    await agent(
        msg
    )


asyncio.run(main())
