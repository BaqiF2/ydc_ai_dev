"""
缓存命中的方式来节约成本
"""

import os

from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain_anthropic.middleware import AnthropicPromptCachingMiddleware
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage

load_dotenv()

base_model = ChatAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"),
                        base_url=os.getenv("ANTHROPIC_BASE_URL"),
                        model_name="claude-sonnet-4-5")

# 模拟固定的上下文提示词，适用：一些固定的记忆，加入到系统提示词中
LONG_PROMPT = """
You are a helpful assistant.
<Lots more context ...>
"""

agent = create_agent(
    model=base_model,
    system_prompt=LONG_PROMPT,
    middleware=[AnthropicPromptCachingMiddleware()]
)

# cache store
r = agent.invoke({"messages": [HumanMessage("Hi, my name is Bob")]})

# cache hit, system prompt is cached
r = agent.invoke({"messages": [HumanMessage("What's my name?")]})

for message in r['messages']:
    message.pretty_print()