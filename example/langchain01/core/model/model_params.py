"""
模型参数
● model : 需要使用的模型名称
● api_key: 模型提供商密钥
● temperature:控制模型输出的随机性。更高的数值使响应更具创造性；较低的数值使它们更具确定性。
● timeout: 调用模型超时时间
● max_tokens: 现在相应token数量,控制输出的长度
● max_retries: 最大重试次数
● top_p： 指定在每一步考虑的令牌总概率质量，与temperature类似但控制方式不同。
● reasoning_effort：限制推理模型在推理上的努力程度。支持'minimal'、'low'、'medium'和'high'值
● verbosity：控制推理模型响应的详细程度，支持'low'、'medium'和'high'值。
"""
import os
from dotenv import load_dotenv
load_dotenv()

from langchain_openai import ChatOpenAI


basic_model = ChatOpenAI(base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                         model="qwen-plus",
                         api_key=os.getenv("DASHSCOPE_API_KEY"),
                         temperature=1.0,
                         timeout=60,
                         max_tokens=1024,
                         max_retries=2)