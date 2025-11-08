"""
流式输出，使用messages 按照token来输出
"""

import os

from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI

load_dotenv()

base_model = ChatOpenAI(api_key=os.getenv("DASHSCOPE_API_KEY"),
                        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                        model="qwen3-max")

@tool
def get_weather(location: str) -> str:
    """Get the weather at a location."""
    return {"messages":[{"role": "assistant", "content": f"It's sunny in {location}."}]}


agent = create_agent(
    model=base_model,
    tools=[get_weather],
)

for token, metadata in agent.stream(
    {"messages": [{"role": "user",  "content": "北京的天气如何？"}]},
    stream_mode="messages",
):
    print(f"node: {metadata['langgraph_node']}")
    print(f"content: {token.content_blocks}")
    print("\n")
