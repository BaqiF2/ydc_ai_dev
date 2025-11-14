"""
长期记忆在agent中基于工具的应用
"""
import os
from dataclasses import dataclass

from dotenv import load_dotenv
from langgraph.store.memory import InMemoryStore

load_dotenv()

from langchain.tools import tool, ToolRuntime
from langchain.agents import create_agent
from langchain_openai import ChatOpenAI


@dataclass
class Context:
    user_id: str


@tool
def get_weather(location: str, runtime: ToolRuntime) -> str:
    """Get the weather at a location."""
    user_id = runtime.context.user_id
    name_space = (user_id, 'advance')
    store = runtime.store

    result = store.search(name_space, filter={"city": location})
    if result:
        print(f"从长期记忆中获取数据：{result}")
        return result[0].value

    print(f"从网络获取数据：{location}")
    messages = {"city": location, "messages": [{"role": "assistant", "content": f"It's sunny in {location}."}]}
    # 写入长期记忆
    store.put(name_space, 'get_weather', messages)
    return {"messages": [{"role": "assistant", "content": f"It's sunny in {location}."}]}


store = InMemoryStore()
agent = create_agent(
    model=ChatOpenAI(api_key=os.getenv("DASHSCOPE_API_KEY"),
                     base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                     model="qwen3-max"),
    tools=[get_weather],
    store=store,
    context_schema=Context
)

r = agent.invoke(input={"messages": [{"role": "user", "content": "北京的天气如何？"}]}, context={"user_id": "baqiF2"})

for message in r['messages']:
    message.pretty_print()

s = store.get(('baqiF2', 'advance'), 'get_weather')

print(s)

r = agent.invoke(input={"messages": [{"role": "user", "content": "北京的天气如何？"}]}, context={"user_id": "baqiF2"})
for message in r['messages']:
    message.pretty_print()
print(s)
