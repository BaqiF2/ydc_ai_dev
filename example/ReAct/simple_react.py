"""
简化版ReAct实现 - 专注于核心原理
"""
import re
import logging
from typing import Dict, List, Optional
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from chat_models import openai_tongyi_chat_model

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class SimpleReAct:
    """简化版ReAct实现"""

    def __init__(self, llm):
        self.llm = llm
        self.system_prompt = """# ReAct智能助手

你是一个能够通过思考和行动来回答问题的智能助手。

## 回答格式
你必须严格按照以下格式回答：
Thought: 你的思考过程
Action: 要执行的动作（search_web 或 calculate）
Observation: 动作执行的结果
... (可以重复多次)
Final Answer: 最终答案

## 可用工具
1. search_web(query): 搜索信息
   - 参数: query (搜索关键词)
2. calculate(expression): 数学计算
   - 参数: expression (数学表达式)

## 示例
用户: "10000元能买多少克黄金？"
Thought: 需要知道黄金价格，然后计算
Action: search_web("黄金价格")
Observation: 今日黄金价格450元/克
Thought: 现在计算10000元能买多少克
Action: calculate(10000/450)
Observation: 22.22
Final Answer: 10000元能买约22.22克黄金
"""

    def search_web(self, query: str) -> str:
        """搜索工具"""
        logger.info(f"搜索: {query}")

        # 模拟搜索数据
        search_db = {
            "黄金价格": "今日黄金价格450元/克",
            "股票行情": "A股今日上涨，上证指数涨幅0.5%",
            "汇率": "美元兑人民币汇率1:7.2"
        }

        for key, value in search_db.items():
            if key in query:
                return value

        return f"未找到'{query}'的相关信息"

    def calculate(self, expression: str) -> str:
        """计算工具"""
        logger.info(f"计算: {expression}")

        try:
            # 安全检查
            allowed_chars = set('0123456789+-*/(). ')
            if not all(c in allowed_chars for c in expression):
                return "表达式包含非法字符"

            result = eval(expression)
            return str(result)

        except Exception as e:
            return f"计算错误: {str(e)}"

    def parse_react_response(self, content: str) -> Dict[str, str]:
        """解析ReAct响应"""
        result = {
            "thought": "",
            "action": "",
            "action_input": "",
            "final_answer": None
        }

        # 提取思考
        thought_match = re.search(r'Thought:\s*(.*?)(?=\nAction:|\nFinal Answer:|$)',
                                content, re.DOTALL | re.IGNORECASE)
        if thought_match:
            result["thought"] = thought_match.group(1).strip()

        # 提取动作
        action_match = re.search(r'Action:\s*(.*?)(?=\nObservation:|\nThought:|\nFinal Answer:|$)',
                               content, re.DOTALL | re.IGNORECASE)
        if action_match:
            action_text = action_match.group(1).strip()
            result["action"] = action_text

            # 解析动作参数
            if '(' in action_text and ')' in action_text:
                action_name = action_text.split('(')[0].strip()
                action_input = action_text.split('(')[1].rsplit(')')[0].strip('"\'')
                result["action_input"] = action_input

        # 提取最终答案
        final_match = re.search(r'Final Answer:\s*(.*?)$', content, re.DOTALL | re.IGNORECASE)
        if final_match:
            result["final_answer"] = final_match.group(1).strip()

        return result

    def execute_action(self, action_name: str, action_input: str) -> str:
        """执行动作"""
        if action_name == "search_web":
            return self.search_web(action_input)
        elif action_name == "calculate":
            return self.calculate(action_input)
        else:
            return f"未知动作: {action_name}"

    def run(self, question: str, max_iterations: int = 5) -> str:
        """运行ReAct流程"""
        logger.info(f"处理问题: {question}")

        messages = [
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=question)
        ]

        for i in range(max_iterations):
            logger.info(f"\n--- 第{i+1}轮 ---")

            # 调用LLM
            response = self.llm.invoke(messages)
            content = response.content
            logger.info(f"LLM响应:\n{content}")

            # 解析响应
            parsed = self.parse_react_response(content)

            logger.info(f"思考: {parsed['thought']}")
            logger.info(f"动作: {parsed['action']}")

            # 检查是否有最终答案
            if parsed['final_answer']:
                logger.info(f"最终答案: {parsed['final_answer']}")
                return parsed['final_answer']

            # 执行动作
            if parsed['action'] and '(' in parsed['action']:
                action_name = parsed['action'].split('(')[0].strip()
                observation = self.execute_action(action_name, parsed['action_input'])
                logger.info(f"观察: {observation}")

                # 更新消息
                messages.append(AIMessage(content=content))
                messages.append(HumanMessage(content=f"Observation: {observation}"))
            else:
                logger.warning("无法解析动作")
                break

        return "抱歉，无法在限定步骤内回答这个问题"


def main():
    """主函数"""
    # 初始化
    llm = openai_tongyi_chat_model()
    react = SimpleReAct(llm)

    # 测试问题
    questions = [
        "我有10000元，黄金450元一克，能买多少克？",
        "5000元买股票，25元一股，能买多少股？"
    ]

    print("=== 简化版ReAct演示 ===\n")

    for q in questions:
        print(f"问题: {q}")
        answer = react.run(q)
        print(f"答案: {answer}")
        print("-" * 50)

    # 交互模式
    print("\n=== 交互模式 ===")
    print("输入问题（输入'quit'退出）:")

    while True:
        user_input = input("\n问题: ").strip()
        if user_input.lower() in ['quit', 'exit', '退出']:
            break
        if user_input:
            answer = react.run(user_input)
            print(f"答案: {answer}")


if __name__ == "__main__":
    main()