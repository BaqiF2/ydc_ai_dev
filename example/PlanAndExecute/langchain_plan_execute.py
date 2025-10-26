"""
可能是实验包原因，当前启动报错：
: No module named 'langchain.callbacks'
包本身还是不可用，路径不正确
 from langchain.callbacks.manager import (
     AsyncCallbackManagerForChainRun,
     CallbackManagerForChainRun,
 )
"""

import logging
import os

from langchain_core.tools import tool

from langchain_experimental.plan_and_execute import PlanAndExecute, load_chat_planner, load_agent_executor
from langchain_openai import ChatOpenAI

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def openai_tongyi_chat_model() -> ChatOpenAI:
    """创建通义千问聊天模型"""
    return ChatOpenAI(
        api_key=os.getenv("DASHSCOPE_API_KEY"),
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        model="qwen3-max"
    )

@tool
def search_market_data(query: str) -> str:
    """搜索市场数据"""
    logger.info(f"搜索Web数据: {query}")
    # 这里mock方式来替代真实数据源
    if "股票" in query or "指数" in query: return "沪深300: 3850点, 上证: 3100点"
    if "基金" in query: return "货币2-3%, 债券3.5-5%, 混合5-8%"
    if "理财" in query or "稳健" in query: return "理财3-4%, 国债2.5-3%"
    return f"未找到'{query}'数据"

@tool
def calculate(expression: str) -> str:
    """数学计算"""
    logger.info(f"进行计算，计算公式: {expression}")
    try:
        if not all(c in set('0123456789+-*/(). ') for c in expression):
            return "错误: 非法字符"
        return f"{eval(expression)}"
    except Exception as e:
        return f"计算错误: {str(e)}"

@tool
def query_user_profile(user_id: str) -> str:
    """查询用户画像"""
    logger.info(f"查询用户画像: {user_id}")
    return "风险偏好: 稳健型, 期限: 3-5年, 可投: 10万元"

@tool
def analyze_investment(params: str) -> str:
    """投资分析"""
    logger.info(f"分析: {params}")
    return "建议: 60%债券+30%混合+10%货币, 预期4-6%"


llm = openai_tongyi_chat_model()

"""
SYSTEM_PROMPT = (
    "Let's first understand the problem and devise a plan to solve the problem."
    " Please output the plan starting with the header 'Plan:' "
    "and then followed by a numbered list of steps. "
    "Please make the plan the minimum number of steps required "
    "to accurately complete the task. If the task is a question, "
    "the final step should almost always be 'Given the above steps taken, "
    "please respond to the users original question'. "
    "At the end of your plan, say '<END_OF_PLAN>'"
)

首先让我们理解问题并制定一个解决问题的计划。
请以“计划：”为标题输出该计划，
然后附上一个按编号排列的步骤列表。
请将计划制定为完成任务所需的最少步骤，
如果任务是一个问题，那么最后一步几乎总是“根据上述所采取的步骤，请回答用户最初的问题”。
在您的计划末尾，请写上“<END_OF_PLAN>”
"""

planner = load_chat_planner(llm)

toos = [search_market_data, calculate, query_user_profile, analyze_investment]
executor = load_agent_executor(llm, toos,verbose=True)

agent = PlanAndExecute(planner=planner, executor=executor,verbose=True)

result = agent.invoke({"input": "我有10万元，想做稳健投资，帮我制定一个投资方案"})

print(result)
