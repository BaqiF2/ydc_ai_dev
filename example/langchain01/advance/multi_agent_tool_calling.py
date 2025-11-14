"""
使用工具调用的方式来实现 supervisor
"""

from langchain.agents import AgentState, create_agent
from langchain.tools import ToolRuntime
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
import os
from dotenv import load_dotenv

load_dotenv()

base_model = ChatOpenAI(api_key=os.getenv("DASHSCOPE_API_KEY"),
                        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                        model="qwen3-max")


# 子代理保持不变
@tool
def get_weather(location: str) -> str:
    """Get the weather at a location."""
    return {"messages": [{"role": "assistant", "content": f"It's sunny in {location}."}], "time": 123}


weather_agent = create_agent(
    model=base_model,
    tools=[get_weather],
)


# 将调用子代理封装为一个工具，并返回子代理的结果
@tool
def get_sub_agent(runtime: ToolRuntime[AgentState]) -> str:
    """Get the weather."""
    result = weather_agent.invoke({"messages": [{"role": "user", "content": runtime.state["messages"][0].content}]})
    return result["messages"][-1].content


main_agent = create_agent(
    model=base_model,
    tools=[get_sub_agent],
)

r = main_agent.invoke(input={"messages": [{"role": "user", "content": "北京的天气如何？"}]})

for message in r['messages']:
    message.pretty_print()
