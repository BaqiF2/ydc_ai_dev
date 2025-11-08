"""
流式输出，使用updates 来输出执行的步骤
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

for event in agent.stream(
    {"messages": [{"role": "user",  "content": "北京的天气如何？"}]},
    stream_mode="updates",
):
    for step , data in event.items():
        print(f"step: {step}")
        print(f"content: {data['messages'][-1].content_blocks}")
