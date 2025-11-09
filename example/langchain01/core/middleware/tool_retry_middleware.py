"""
使用工具重试中间件来保证系统的稳定，避免因为网络等原因，导致智能体失败
ToolRetryMiddleware
"""
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool
from requests import RequestException, Timeout

"""
使用备用模型中间价增加智能体的稳定性
"""

import os

from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain.agents.middleware import ToolRetryMiddleware
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import InMemorySaver

load_dotenv()


@tool
def get_weather(location: str) -> str:
    """Get the weather at a location."""
    raise RequestException("connect failed")


base_model = ChatOpenAI(api_key=os.getenv("DASHSCOPE_API_KEY"),
                        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                        model="qwen3-max")

agent = create_agent(
    base_model,
    tools=[get_weather],
    middleware=[ToolRetryMiddleware(max_retries=2,
                                    tools=[get_weather],
                                    retry_on=(RequestException, Timeout),
                                    on_failure="return_message",
                                    initial_delay=1.5
                                    ),
                ],
    checkpointer=InMemorySaver()
)
config: RunnableConfig = {"configurable": {"thread_id": "1"}}
r = agent.invoke({"messages": [{"role": "user", "content": "北京天气怎么样?"}]}, config=config)

for message in r['messages']:
    message.pretty_print()
