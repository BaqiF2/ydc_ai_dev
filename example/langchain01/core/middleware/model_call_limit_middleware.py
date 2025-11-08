"""
模型调用上限设置
"""


import os

from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain.agents.middleware import ModelCallLimitMiddleware
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import InMemorySaver

load_dotenv()

base_model = ChatOpenAI(api_key=os.getenv("DASHSCOPE_API_KEY"),
                        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                        model="qwen3-max")


@tool
def get_weather(location: str) -> str:
    """Get the weather at a location."""
    return {"messages":[{"role": "tool", "content": f"{location} 现在的天气是晴天。"}]}



agent = create_agent(
    base_model,
    tools=[get_weather],
    middleware=[ModelCallLimitMiddleware(
        thread_limit=10,
        run_limit = 5,
        exit_behavior="end"
    )],
    checkpointer=InMemorySaver(),
    system_prompt="你是一个天气专家,请回答用户提出关于天气的问题。"
)

config: RunnableConfig = {"configurable": {"thread_id": "1"}}

for event in agent.stream(
    {"messages": [{"role": "user",  "content": "北京天气怎么样?"}]},
    config, stream_mode="values",
):
    print([(message.type, message.content) for message in event["messages"]])

for event in agent.stream(
    {"messages": [{"role": "user",  "content": "那杭州呢？"}]},
    config, stream_mode="values",
):
    print([(message.type, message.content) for message in event["messages"]])

for event in agent.stream(
    {"messages": [{"role": "user",  "content": "那上海呢？"}]},
    config, stream_mode="values",
):
    print([(message.type, message.content) for message in event["messages"]])

for event in agent.stream(
    {"messages": [{"role": "user",  "content": "那广州呢？"}]},
    config, stream_mode="values",
):
    print([(message.type, message.content) for message in event["messages"]])

for event in agent.stream(
    {"messages": [{"role": "user",  "content": "那深圳呢？"}]},
    config, stream_mode="values",
):
    print([(message.type, message.content) for message in event["messages"]])


for event in agent.stream(
    {"messages": [{"role": "user",  "content": "那西安呢？"}]},
    config, stream_mode="values",
):
    print([(message.type, message.content) for message in event["messages"]])

for event in agent.stream(
    {"messages": [{"role": "user",  "content": "那武汉呢？"}]},
    config, stream_mode="values",
):
    print([(message.type, message.content) for message in event["messages"]])

for event in agent.stream(
    {"messages": [{"role": "user",  "content": "那成都呢？"}]},
    config, stream_mode="values",
):
    print([(message.type, message.content) for message in event["messages"]])



final_response = agent.invoke({"messages": "之前问了哪些城市，分别是什么天气"}, config)
for message in final_response['messages']:
    message.pretty_print()

