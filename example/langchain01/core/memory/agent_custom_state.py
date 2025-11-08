"""
使用 middleware 或者 state_schema方式来自定义状态类
"""

from langchain.agents import AgentState,create_agent
from langchain.agents.middleware import AgentMiddleware
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
import os
from dotenv import load_dotenv

load_dotenv()

base_model = ChatOpenAI(api_key=os.getenv("DASHSCOPE_API_KEY"),
                        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                        model="qwen3-max")

class CustomState(AgentState):
    time:int

@tool
def get_weather(location: str) -> str:
    """Get the weather at a location."""
    return {"messages":[{"role": "assistant", "content": f"It's sunny in {location}."}], "time":123}

# 1. 使用中间件
class CustomMiddleware(AgentMiddleware):
    # 定义状态
    state_schema = CustomState
    # 定义工具
    tools = [get_weather]

agent = create_agent(
    model=base_model,
    middleware=[CustomMiddleware()],
    # 2. state_schema
    # tools=[get_weather],
    # state_schema=CustomState
)

r = agent.invoke(input={"messages":[{"role": "user", "content": "北京的天气如何？"}]})

for message in r['messages']:
    message.pretty_print()