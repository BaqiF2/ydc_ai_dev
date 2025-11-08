"""
人类反馈的方式 HumanInTheLoopMiddleware
在调用工具前询问用户是否允许
"""

import os

from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain.agents.middleware import HumanInTheLoopMiddleware
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.config import get_stream_writer
from langgraph.types import Command

load_dotenv()

base_model = ChatOpenAI(api_key=os.getenv("DASHSCOPE_API_KEY"),
                        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                        model="qwen3-max")


@tool
def fallback_weather(location: str) -> str:
    """Get the weather at a location."""
    writer = get_stream_writer()
    writer(f"正在查询{location}天气。。。。")
    writer(f"查询结果：晴天.")
    return {"messages": [{"role": "assistant", "content": f"It's sunny in {location}."}]}


@tool
def get_weather(location: str) -> str:
    """Get the weather at a location."""
    writer = get_stream_writer()
    writer(f"正在查询{location}天气。。。。")
    writer(f"查询结果：晴天.")
    return {"messages": [{"role": "assistant", "content": f"It's sunny in {location}."}]}


@tool
def get_time() -> str:
    """获取当前时间"""
    from datetime import datetime
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


checkpointer = InMemorySaver()
agent = create_agent(
    model=base_model,
    checkpointer=checkpointer,
    tools=[get_weather, get_time, fallback_weather],
    middleware=[
        HumanInTheLoopMiddleware(
            interrupt_on={
                # 天气工具需要审批
                "get_weather": {"allowed_decisions": ["approve", "edit", "reject"]},
                # 查询时间自动同意
                "get_time": False,
            },
            description_prefix="输入选择 approve edit reject"
        )
    ],
)

config: RunnableConfig = {"configurable": {"thread_id": "1"}}
r = agent.invoke({"messages": [{"role": "user", "content": "查询北京的今天的日期和天气？"}]}, config=config)
for message in r['messages']:
    message.pretty_print()

if '__interrupt__' in r:
    print(f"interrupt: {r['__interrupt__']}")

## 恢复运行
print("==" * 10)
print("恢复运行")

# r = agent.invoke(Command(resume={"decisions": [{"type": "approve"}]}), config=config)
# for message in r['messages']:
#     message.pretty_print()

# r = agent.invoke(Command(resume={"decisions": [{"type": "reject"}]}), config=config)
# for message in r['messages']:
#     message.pretty_print()

r = agent.invoke(Command(resume={"decisions": [
    {"type": "edit",
     "edited_action": {
         "name": "fallback_weather",
         "args": {"location": "北京"},
     }
     }
]
}), config=config)
for message in r['messages']:
    message.pretty_print()

if '__interrupt__' in r:
    print(f"interrupt: {r['__interrupt__']}")
