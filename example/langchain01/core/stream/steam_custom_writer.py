"""
流式输出，使用custom + get_stream_writer来进行流式输出
"""

import os

from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.config import get_stream_writer

load_dotenv()

base_model = ChatOpenAI(api_key=os.getenv("DASHSCOPE_API_KEY"),
                        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                        model="qwen3-max")

@tool
def get_weather(location: str) -> str:
    """Get the weather at a location."""
    writer = get_stream_writer()
    writer(f"正在查询{location}天气。。。。")
    writer(f"查询结果：晴天.")
    return {"messages":[{"role": "assistant", "content": f"It's sunny in {location}."}]}


agent = create_agent(
    model=base_model,
    tools=[get_weather],
)

for steam_model , event in agent.stream(
    {"messages": [{"role": "user",  "content": "北京的天气如何？"}]},
    # stream_mode="custom",
    stream_mode=["custom","updates"],
):
   print(f"stream_mode: {steam_model}")
   print(f"content: {event}")
