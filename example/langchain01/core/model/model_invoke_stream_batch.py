"""
关键方法:
invoke
stream
batch

消息输入的两种方式：
openAI字典格式
消息对象列表
"""

import os

from dotenv import load_dotenv

load_dotenv()
from langchain_openai import ChatOpenAI
from langchain.messages import SystemMessage, HumanMessage


basic_model = ChatOpenAI(base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                         model="qwen-plus",
                         api_key=os.getenv("DASHSCOPE_API_KEY"))

messages = [{"role": "system", "content": "你是一个教学机器人，你需要回答用户提出的问题。"},
                    {"role": "user", "content": "什么是牛顿力学三大定律?"}]
invoke_response = basic_model.invoke(messages)
print(f'invoke 输出结果：{invoke_response.content_blocks}')

print("=="*20)

print("stream 输出结果：")
for message in basic_model.stream([SystemMessage(content="你是一个教学机器人，你需要回答用户提出问题。"),
                                  HumanMessage(content="什么是牛顿力学三大定律?")]):
    print(message.content_blocks)

print("=="*20)

print("batch 输出结果：")
#
messages1 = [{"role": "system", "content": "你是一个教学机器人，你需要回答用户提出的问题。"},
                    {"role": "user", "content": "什么是牛顿力学三大定律?"}]
messages2 = [{"role": "system", "content": "你是一个教学机器人，你需要回答用户提出的问题。"},
                    {"role": "user", "content": "什么是勾股定律?"}]
batch_response = basic_model.batch([messages1, messages2],
                                   config={'max_concurrency':2,})

for message in batch_response:
    print(message.content_blocks)