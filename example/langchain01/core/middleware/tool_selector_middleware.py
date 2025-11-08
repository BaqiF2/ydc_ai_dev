"""
在调用模型前智能的选择本次任务需要使用到的工具
LLMToolSelectorMiddleware
"""

import os

from langchain.agents import create_agent
from langchain.agents.middleware import LLMToolSelectorMiddleware
from langchain_openai import ChatOpenAI


openai_model = ChatOpenAI(model="gpt-5",api_key=os.getenv("OPENAI_AI_KEY"),base_url=os.getenv("OPEN_AI_URL"))


agent = create_agent("openai:gpt-4o",
                    tools=[tool1, tool2, tool3, tool4, tool5],
                     middleware=[LLMToolSelectorMiddleware(
                     max_tools=3,always_include=["search"])])