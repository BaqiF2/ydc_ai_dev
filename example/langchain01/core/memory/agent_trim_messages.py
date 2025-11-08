"""
使用 短时内存记忆来进行管理历史消息
使用消息裁剪，来裁剪消息
"""
from typing import Any

from langchain_core.messages import RemoveMessage,trim_messages
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.memory import InMemorySaver
from langchain.agents import create_agent, AgentState
from langchain.agents.middleware import AgentMiddleware, before_model
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
import os
from dotenv import load_dotenv
from langgraph.graph.message import REMOVE_ALL_MESSAGES
from langgraph.runtime import Runtime

load_dotenv()

base_model = ChatOpenAI(api_key=os.getenv("DASHSCOPE_API_KEY"),
                        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                        model="qwen3-max")
@tool
def get_weather(location: str) -> str:
    """Get the weather at a location."""
    return {"messages":[{"role": "tool", "content": f"It's sunny in {location}."}]}

@before_model
def customer_trim_messages(state: AgentState, runtime: Runtime) -> dict[str, Any] | None:

    """只保留最新的3条数据"""
    messages = state["messages"]
    if len(messages) <= 3:
        return None  # No changes needed

    # 1. langchain util + 指定保留示例
    recent_messages = trim_messages(messages,
        # 保留最新4条数据
        strategy="last",
        # 表示使用条目的计数方式
        token_counter=len,
        # 这里表示最多允许4条消息
        max_tokens=4,
    )
    first_msg = messages[0]

    # 2. 自定义的方式
    # recent_messages = messages[-3:] if len(messages) % 2 == 0 else messages[-4:]

    new_messages = [first_msg] + recent_messages
    # 先删除所有数据然后，将第一条和最新的3条数据返回
    return {
        "messages": [
            RemoveMessage(id=REMOVE_ALL_MESSAGES),
            *new_messages
        ]
    }



agent = create_agent(
    base_model,
    tools=[get_weather],
    middleware=[customer_trim_messages],
    checkpointer=InMemorySaver(),
)

config: RunnableConfig = {"configurable": {"thread_id": "1"}}

agent.invoke({"messages": "北京天气怎么样?"}, config)
agent.invoke({"messages": "那杭州呢？"}, config)
agent.invoke({"messages": "那上海呢？"}, config)
final_response = agent.invoke({"messages": "之前问了哪些城市，分别是什么天气"}, config)



for message in final_response['messages']:
    message.pretty_print()
