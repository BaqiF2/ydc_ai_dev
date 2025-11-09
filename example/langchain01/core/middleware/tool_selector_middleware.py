"""
在调用模型前智能的选择本次任务需要使用到的工具
LLMToolSelectorMiddleware
"""

import os
from dotenv import load_dotenv
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool

load_dotenv()

from langchain.agents import create_agent
from langchain.agents.middleware import LLMToolSelectorMiddleware
from langchain_openai import ChatOpenAI


@tool
def get_weather(location: str) -> str:
    """Get the weather at a location."""
    return {"messages": [{"role": "assistant", "content": f"It's sunny in {location}."}], "time": 123}


@tool
def get_current_position(location: str) -> str:
    """获取当前位置"""
    return "当前在北京"


@tool
def get_hotel_info(location: str) -> str:
    """获取酒店信息"""
    return ""


@tool
def get_scenic(location: str) -> str:
    """获取景点信息"""
    return ""


openai_model = ChatOpenAI(model="gpt-5", api_key=os.getenv("OPENAI_AI_KEY"), base_url=os.getenv("OPEN_AI_URL"))

agent = create_agent(openai_model,
                     tools=[get_weather, get_current_position, get_hotel_info, get_scenic],
                     middleware=[LLMToolSelectorMiddleware(
                         max_tools=3,
                         always_include=["get_current_position"])], debug=True)

config: RunnableConfig = {"configurable": {"thread_id": "1"}}

r = agent.invoke({"messages": [{"role": "user", "content": "我现在的位置的天气怎么样？"}]}, config=config)
for message in r['messages']:
    message.pretty_print()
