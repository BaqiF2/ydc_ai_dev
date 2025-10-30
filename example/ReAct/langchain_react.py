"""
使用langchain来实现ReAct
注意： 新版langchain更多是依赖于模型原生的对工具调用的能力，其实就是默认未来模型必备的能力
"""
import logging
import os
from dotenv import load_dotenv
load_dotenv()

from langchain.agents import create_agent
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# 定义模型
def openai_tongyi_chat_model() -> ChatOpenAI:
    return ChatOpenAI(api_key=os.getenv("DASHSCOPE_API_KEY"),
                      base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                      model="qwen3-max")

# 定义工具
@tool
def search_web(query: str) -> str:
    """搜索工具"""
    logger.info(f"执行搜索: {query}")

    # 模拟搜索结果，实际应用中应该调用真实的搜索API
    search_data = {
        "黄金": "根据最新市场数据，今日黄金价格约为1159元/克（24K金），投资金条价格约为1080元/克。",
        "gold": "Current gold price is approximately $65 per gram (24K), investment gold bars around $63 per gram."
    }

    # 改进的关键词匹配逻辑
    query_lower = query.lower()
    # 简单的关键词匹配
    for key, value in search_data.items():
        if key in query_lower:
            return value

    return f"未找到关于'{query}'的相关信息，建议尝试其他关键词。"

@tool
def calculate( expression: str) -> str:
    """计算工具"""
    logger.info(f"执行计算: {expression}")

    try:
        # 只允许数字、基本运算符和括号
        allowed_chars = set('0123456789+-*/(). ')
        if not all(c in allowed_chars for c in expression):
            return "错误：表达式包含非法字符，只能使用数字和基本运算符(+-*/.)"

        result = eval(expression)
        return f"计算结果：{result}"

    except ZeroDivisionError:
        return "错误：除数不能为零"
    except Exception as e:
        return f"计算错误：{str(e)}"

# 使用langchain创建ReAct代理
model = openai_tongyi_chat_model()
agent  = create_agent(model = model, tools = [search_web,calculate])

# 输出每一步的结果
res = agent.invoke(input={"messages": [{"role": "user", "content":  "我手上有1万块钱，我能买多少克黄金？"}]},
                   # print_mode="updates"
                   )

# print(res)

for message in res["messages"]:
    message.pretty_print()
