"""
使用 短时内存记忆来进行管理历史消息
使用消息裁剪，来裁剪消息
"""

from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.memory import InMemorySaver
from langchain.agents import create_agent, AgentState
from langchain.agents.middleware import SummarizationMiddleware
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
import os
from dotenv import load_dotenv

load_dotenv()

base_model = ChatOpenAI(api_key=os.getenv("DASHSCOPE_API_KEY"),
                        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                        model="qwen3-max")
@tool
def get_weather(location: str) -> str:
    """Get the weather at a location."""
    return {"messages":[{"role": "tool", "content": f"{location} 现在的天气是晴天。"}]}

summary_prompt = """
您是一位乐于助人的助手。您正在总结人类与助手之间的对话。您已获得以下消息：{messages}。
按照 城市：天气 格式输出。 如果不知道城市天气 ，先不要输出 城市: 天气, 等下一次再总结.
"""

agent = create_agent(
    base_model,
    tools=[get_weather],
    middleware=[SummarizationMiddleware(
        # 摘要模型，使用理解能力更好的模型
        model=base_model,
        # 触发摘要的token数量
        max_tokens_before_summary=100,
        # 生成后保留最近的消息数量。！！！ 最近N条会排出总结范围，不会总结消息
        messages_to_keep= 1,
        # 摘要的提示词模版，这个很重要，决定最后摘要的质量
        summary_prompt=summary_prompt,
        # 包含在系统提示词中,摘要的前缀
        summary_prefix="用户之前提问过的天气和回答是："
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
