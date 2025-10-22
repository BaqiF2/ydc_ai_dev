"""
注意：需要说明的是autogen没有对ReAct进行封装
只是实现对工具的调用，当依赖模型的思考和调用能力时，和langchain的create_agent也变得类似了
"""
import asyncio
import logging
import os

from autogen_agentchat.agents import AssistantAgent
from autogen_agentchat.messages import BaseChatMessage
from autogen_ext.models.openai import OpenAIChatCompletionClient

#配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# 创建通义千问模型客户端
tongyi_model_client = OpenAIChatCompletionClient(
    model="qwen3-max",  # 或其他通义千问模型名称
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    api_key= os.getenv("DASHSCOPE_API_KEY"),
    model_info={
        "vision": False,
        "function_calling": True,
        "json_output": True,
        "family": "qwen",
        "structured_output": True,
    },
)

def search_web(query: str) -> str:
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
    for key, value in search_data.items():
        if key in query_lower:
            return value

    return f"未找到关于'{query}'的相关信息，建议尝试其他关键词。"

def calculate( expression: str) -> str:
    """计算工具"""
    logger.info(f"执行计算: {expression}")

    try:
        # 只允许数字、基本运算符和括号
        allowed_chars = set('0123456789+-*/(). ')
        if not all(c in allowed_chars for c in expression):
            return "错误：表达式包含非法字符，只能使用数字和基本运算符(+-*/.)"

        result = eval(expression)
        return f"计算结果：{result}"

    except ZeroDivisionError:
        return "错误：除数不能为零"
    except Exception as e:
        return f"计算错误：{str(e)}"

# 结果上他只调用了一次工具，不会再次调用。所以并不是完全的ReAct
async def main() -> None:
    agent = AssistantAgent(
        name="assistant",
        model_client=tongyi_model_client,
        tools=[search_web,calculate],
        system_message="You are a helpful assistant.",
        max_tool_iterations=10, # 设置最多使用工具次数
    )
    res = await agent.run(task = "我手上有1万块钱，我能买多少克黄金？")
    messages:list[BaseChatMessage] = res.messages
    for msg in messages:
        print(msg.to_text())
        print("="*20)



asyncio.run(main())