"""
使用LLM来mock，工具的行为
LLMToolEmulator
"""
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool
from requests import RequestException, Timeout

"""
使用备用模型中间价增加智能体的稳定性
"""

import os

from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain.agents.middleware import LLMToolEmulator
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import InMemorySaver

load_dotenv()


@tool
def get_weather(location: str) -> str:
    """Get the weather at a location."""
    return {"messages": [{"role": "assistant", "content": f"It's sunny in {location}."}], "time": 123}


@tool
def get_plane_ticket(location: str) -> str:
    """获取当前位置"""
    return ""


@tool
def get_hotel_info(location: str) -> str:
    """获取酒店信息"""
    return ""


@tool
def get_scenic(location: str) -> str:
    """获取景点信息"""
    return ""


base_model = ChatOpenAI(api_key=os.getenv("DASHSCOPE_API_KEY"),
                        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                        model="qwen3-max")

agent = create_agent(
    base_model,
    tools=[get_weather, get_plane_ticket, get_hotel_info, get_scenic],
    middleware=[LLMToolEmulator(model=base_model,
                                tools=[get_plane_ticket, get_hotel_info, get_scenic]
                                ),
                ],
    checkpointer=InMemorySaver()
)
config: RunnableConfig = {"configurable": {"thread_id": "1"}}
r = agent.invoke({"messages": [{"role": "user", "content": "给我制定一个去北京的旅行计划？"}]}, config=config)

for message in r['messages']:
    message.pretty_print()
