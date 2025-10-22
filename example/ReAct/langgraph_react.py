"""
注意： langgraph已经不推荐使用create_react_agent
它推荐使用 from langchain.agents import create_agent 也就是上一个案例
"""
from langgraph.prebuilt.chat_agent_executor import create_react_agent