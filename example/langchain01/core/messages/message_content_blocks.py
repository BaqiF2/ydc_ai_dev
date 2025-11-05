"""
输出 content_blocks
以deepseek-reasoner为例
"""

import os

from dotenv import load_dotenv
load_dotenv()

from langchain_deepseek import ChatDeepSeek

# 方案1: 标准配置（当前使用）
basic_model = ChatDeepSeek(
model="deepseek-reasoner",
api_key=os.getenv("DEEPSEEK_API_KEY"),
)


response = basic_model.invoke("深度思考下，如何才能实现AIGC？")

print("完整响应对象:")
print(response)

print("\n" + "==" *20)

# 检查原始content属性（可能包含reasoning数据）
print("\n原始 response.content (可能包含reasoning):")
print(f"Content类型: {type(response.content)}")
print(f"Content内容: {response.content}")

print("\n" + "==" *20)

# 输出所有content_blocks
print("\n所有content_blocks:")
print(response.content_blocks)
