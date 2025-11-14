"""
create_agent ,langgraph runtime 运用
"""
from dataclasses import dataclass

from langchain.agents import create_agent
from langchain.tools import ToolRuntime
from langchain_openai import ChatOpenAI
import os
from dotenv import load_dotenv
from langgraph.store.memory import InMemoryStore

load_dotenv()

base_model = ChatOpenAI(api_key=os.getenv("DASHSCOPE_API_KEY"),
                        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                        model="qwen3-max")


@dataclass
class CustomContext:
    """
    自定义上下文
    """
    db_user_password: str
    db_user_name: str
    db_url: str
    user_id: str


def rag_query(query: str, runtime: ToolRuntime[CustomContext]):
    """
    模拟 组合检索
    """
    runtime.stream_writer(f'用户的问题是：{query}')

    result = []
    print(f"数据库连接建立：{runtime.context.db_url},得到数据库上下文")
    db_content = "2025年美国总统是特朗普"
    result.append(db_content)

    if runtime.store:
        if memory := runtime.store.get(("users",), runtime.context.user_id):
            content = memory.value["chat"]
            result.append(content)

    return result


store = InMemoryStore()
store.put(("users",), "1", {"chat": "2023年美国总统是拜登"})
agent = create_agent(
    model=base_model,
    tools=[rag_query],
    context_schema=CustomContext,
    store=store
)

for steam_model, event in agent.stream(
        {"messages": [{"role": "user", "content": "今年是2025年，今年的美国总统是谁？"}]},
        context={"user_id": "1", "db_url": "mysql://root:123456@127.0.0.1:3306/test", "db_user_name": "root",
                 "db_user_password": "123456"},
        stream_mode=["custom", "updates"],
):
    print(f"stream_mode: {steam_model}")
    print(f"content: {event}")
