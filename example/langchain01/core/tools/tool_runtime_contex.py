"""
工具调用时访问运行时上下文信息
用一个示例来获取 State ConText Store Config TooCallId
写入更新日志 Stream Writer
"""
from dataclasses import dataclass
import os

from dotenv import load_dotenv
from langchain.tools import ToolRuntime
from langchain_core.stores import InMemoryStore
from langchain_core.tools import tool
from langchain.agents import create_agent

load_dotenv()

from langchain_openai import ChatOpenAI

basic_model = ChatOpenAI(base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                         model="qwen3-max",
                         api_key=os.getenv("DASHSCOPE_API_KEY"))


@dataclass
class UserContext:
    user_id: str

@tool(name_or_callable="weather_search",description="查询天气")
def weather_search(runtime: ToolRuntime,location: str = "北京", units: str = "celsius", include_forecast: bool = False,
                   ):
    """Get current weather and optional forecast."""
    # 1. 获取到State的messages和Steps数据
    messages = runtime.state['messages']
    print(f"messages: {messages} ")

    # 2. 获取Context信息
    user_context = runtime.context.user_id
    print(f"user_id: {user_context}")

    # 3. tool_call_id
    tool_call_id = runtime.tool_call_id
    print(f"tool_call_id: {tool_call_id}")

    # 4. RuntimeConfig
    runtime_config = runtime.config['metadata']
    print(f"runtime_config: {runtime_config}")

    # 5. StreamWriter
    stream_writer = runtime.stream_writer
    stream_writer(f"运行到 weather_search 节点 了")

    # 6 Store
    store = runtime.store
    print(f"user_info: {store.store}")


    temp = 22 if units == "celsius" else 72
    result = f"Current weather in {location}: {temp} degrees {units[0].upper()}"
    if include_forecast:
        result += "\nNext 5 days: Sunny"
    return result

store = InMemoryStore()
store.mset([('users',{"user_id": "1", "name": "张三"})])
agent = create_agent(
    model=basic_model,
    tools=[weather_search],
    context_schema=UserContext,
    store= store
)


res = agent.invoke(input={"messages":[{"role": "user", "content": "北京天气"}]},
             context={"user_id": "1"})

print(res)