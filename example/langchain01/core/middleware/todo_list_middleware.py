"""
使用TodoListMiddleware
代理运行前先列出 todoList
"""

import os

from langchain.agents import create_agent
from langchain.agents.middleware import TodoListMiddleware
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI

openai_model = ChatOpenAI(model="gpt-5",api_key=os.getenv("OPENAI_AI_KEY"),base_url=os.getenv("OPEN_AI_URL"))


agent = create_agent("openai:gpt-4o", middleware=[TodoListMiddleware()])

result =  agent.invoke({"messages": [HumanMessage("Help me refactor my codebase")]})

print(result["todos"])