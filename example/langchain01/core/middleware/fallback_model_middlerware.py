"""
使用备用模型中间价增加智能体的稳定性
"""

import os

from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain.agents.middleware import ModelFallbackMiddleware
from langchain_deepseek import ChatDeepSeek
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import InMemorySaver

load_dotenv()

base_model = ChatOpenAI(api_key=os.getenv("DASHSCOPE_API_KEY"),
                        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                        model="qwen3-max")

openai_model = ChatOpenAI(model="gpt-5",api_key=os.getenv("OPENAI_AI_KEY"),base_url=os.getenv("OPEN_AI_URL"))

deepseek_model  = ChatDeepSeek(
model="deepseek-reasoner",
api_key=os.getenv("DEEPSEEK_API_KEY"),
)

agent = create_agent(
    base_model,
    middleware=[ModelFallbackMiddleware(openai_model,deepseek_model)],
    checkpointer=InMemorySaver()
)

