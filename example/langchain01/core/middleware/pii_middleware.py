"""
个人隐私数据过滤
"""
import os

from dotenv import load_dotenv

from langchain.agents import create_agent
from langchain.agents.middleware import PIIMiddleware
from langchain_openai import ChatOpenAI

openai_model = ChatOpenAI(model="gpt-5", api_key=os.getenv("OPENAI_AI_KEY"), base_url=os.getenv("OPEN_AI_URL"))

# 定义敏感词列表
sensitive_patterns = [
    r'"[^"]*pwd[^"]*"\s*:\s*"[^"]*"',
    r'"[^"]*password[^"]*"\s*:\s*"[^"]*"',
    r'"[^"]*mnemonic[^"]*"\s*:\s*"[^"]*"',
    r'"[^"]*token[^"]*"\s*:\s*"[^"]*"',
    r'"[^"]*secret[^"]*"\s*:\s*"[^"]*"',
    r'"[^"]*apiSecret[^"]*"\s*:\s*"[^"]*"',
    r'"[^"]*key[^"]*"\s*:\s*"[^"]*"',
    r'"[^"]*apiKey[^"]*"\s*:\s*"[^"]*"'
]
# 构建完整的正则表达式
combined_pattern = '|'.join(sensitive_patterns)
agent = create_agent(
    openai_model,
    middleware=[PIIMiddleware(pii_type="personal",
                              strategy="mask",
                              detector=combined_pattern,
                              apply_to_input=True,
                              apply_to_output=True,
                              apply_to_tool_results=True
                              )],
)
