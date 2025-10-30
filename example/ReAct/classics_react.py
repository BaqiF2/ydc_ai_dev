"""
ReAct实现 - 通过理解原理去实现，更好的理解ReAct的思想
"""
import logging
import re
import os
from dotenv import load_dotenv
load_dotenv()

from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Optional, Any
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

def openai_tongyi_chat_model() -> ChatOpenAI:
    return ChatOpenAI(api_key=os.getenv("DASHSCOPE_API_KEY"),
                      base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                      model="qwen3-max")



# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class ActionType(Enum):
    """动作类型枚举"""
    SEARCH = "search_web"
    CALCULATE = "calculate"
    ANSWER = "answer"
    UNKNOWN = "unknown"


@dataclass
class ReActStep:
    """ReAct步骤数据结构"""
    thought: str
    action: str
    action_type: ActionType
    action_input: str
    observation: str
    final_answer: Optional[str] = None


class ToolExecutor:
    """工具执行器"""

    def __init__(self):
        self.tools = {
            "search_web": self._search_web,
            "calculate": self._calculate
        }

    def _search_web(self, query: str) -> str:
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

    def _calculate(self, expression: str) -> str:
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

    def execute(self, action: str, action_input: str) -> str:
        """执行工具"""
        if action in self.tools:
            logger.info(f"执行工具：{action} 参数: {action_input}")
            return self.tools[action](action_input)
        else:
            return f"未知工具：{action}"


class ReActParser:
    """ReAct响应解析器"""

    @staticmethod
    def parse_response(content: str) -> Dict[str, Any]:
        """解析LLM响应内容"""
        result = {
            "thought": "",
            "action": "",
            "action_type": ActionType.UNKNOWN,
            "action_input": "",
            "final_answer": None
        }

        # 提取思考过程
        thought_pattern = r'Thought:\s*(.*?)(?=\nAction:|\nFinal Answer:|$)'
        thought_match = re.search(thought_pattern, content, re.DOTALL | re.IGNORECASE)
        if thought_match:
            result["thought"] = thought_match.group(1).strip()

        # 提取动作
        action_pattern = r'Action:\s*(.*?)(?=\nObservation:|\nThought:|\nFinal Answer:|$)'
        action_match = re.search(action_pattern, content, re.DOTALL | re.IGNORECASE)
        if action_match:
            action_text = action_match.group(1).strip()
            result["action"] = action_text

            # 解析动作类型和输入
            if '(' in action_text and ')' in action_text:
                action_parts = action_text.split('(', 1)
                action_name = action_parts[0].strip()
                action_input = action_parts[1].rsplit(')', 1)[0].strip('"\'')

                result["action_input"] = action_input

                if action_name == "search_web":
                    result["action_type"] = ActionType.SEARCH
                elif action_name == "calculate":
                    result["action_type"] = ActionType.CALCULATE
                elif action_name == "answer":
                    result["action_type"] = ActionType.ANSWER

        # 提取最终答案
        final_answer_pattern = r'Final Answer:\s*(.*?)(?=\nThought:|\nAction:|$)'
        final_answer_match = re.search(final_answer_pattern, content, re.DOTALL | re.IGNORECASE)
        if final_answer_match:
            result["final_answer"] = final_answer_match.group(1).strip()

        return result


class ReActAgent:
    """ReAct智能体"""

    def __init__(self, llm, max_iterations: int = 5):
        self.llm = llm
        self.max_iterations = max_iterations
        self.tool_executor = ToolExecutor()
        self.parser = ReActParser()
        self.conversation_history = []

        # 改进的提示词
        self.system_prompt = """# ReAct智能理财助手

你是一个专业的理财助手，能够通过思考和行动来帮助用户解答财务和投资相关的问题。

## 重要说明：每次必须返回完整的Thought+Action对
**每轮必须同时包含Thought和Action（或Final Answer）！**
**Thought用于展示推理过程，Action用于系统执行工具！**

## ReAct框架说明
你必须严格按照以下格式进行思考和行动：

每轮回复必须是以下两种格式之一：

**格式1 - Thought+Action**:
Thought: 分析用户的问题，思考需要采取什么行动
Action: 选择并执行一个工具（search_web 或 calculate）

**格式2 - Final Answer**:
Final Answer: 当收集到足够信息时，给出最终答案

## 可用工具
1. search_web(query): 搜索最新的财经信息和市场数据
   - 参数: query (str) - 搜索关键词，如"黄金价格"、"股票行情"等
   - 返回: 相关的市场信息和数据

2. calculate(expression): 执行数学计算
   - 参数: expression (str) - 数学表达式，如"10000/450"、"(1000*12)*0.05"等
   - 返回: 计算结果

## 使用规则
1. 每次必须同时包含Thought和Action（或Final Answer）
2. Thought展示推理过程，Action用于系统执行
3. 系统只处理Action和Final Answer，忽略单独的Thought
4. 如果搜索结果不够明确，可以调整搜索词重新搜索
5. 计算时要确保表达式正确
6. 最终答案要清晰、准确、有用

## 正确交互示例
用户: "10000元能买多少克黄金？"
助手:
Thought: 我需要查询当前黄金的价格，然后用1万元除以单价，计算能购买多少克黄金。
Action: search_web("黄金价格")

系统: Observation: 今日黄金价格约为1159元/克（24K金），投资金条价格约为1080元/克。

助手:
Thought: 现在我看到黄金价格是1159元/克，需要计算10000元能买多少克。
Action: calculate(10000/1159)

系统: Observation: 计算结果：8.63

助手: Final Answer: 按照当前黄金价格约1159元/克，1万元可以购买约8.63克黄金。

现在开始帮助用户解答理财问题。记住：每轮必须同时返回Thought+Action！"""

    def process_question(self, question: str) -> str:
        """处理问题"""
        logger.info(f"开始处理问题: {question}")

        # 初始化对话历史
        messages = [
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=question)
        ]

        # 记录每一轮解析相应结果
        steps = []

        for iteration in range(self.max_iterations):
            logger.info(f"=== 第{iteration + 1}轮迭代 ===")

            try:
                # 调用LLM
                response = self.llm.invoke(messages)
                content = response.content

                logger.info(f"LLM响应:\n{content}")

                # 解析响应
                parsed = self.parser.parse_response(content)

                # 创建步骤记录
                step = ReActStep(
                    thought=parsed["thought"],
                    action=parsed["action"],
                    action_type=parsed["action_type"],
                    action_input=parsed["action_input"],
                    observation="",
                    final_answer=parsed["final_answer"]
                )

                logger.info(f"思考: {step.thought}")
                logger.info(f"动作: {step.action}")

                # 检查是否有最终答案
                if step.final_answer:
                    logger.info(f"=== 最终答案 ===")
                    logger.info(f"答案: {step.final_answer}")
                    steps.append(step)
                    # 退出时，保存对话历史
                    self._save_conversation_history(question, steps)
                    return step.final_answer

                # 执行动作 - 系统只处理Action和Final Answer
                if step.action_type != ActionType.UNKNOWN:
                    observation = self.tool_executor.execute(
                        step.action_type.value,
                        step.action_input
                    )
                    step.observation = observation
                    logger.info(f"观察: {observation}")

                    # 更新消息历史
                    messages.append(AIMessage(content=content))
                    messages.append(HumanMessage(content=f"Observation: {observation}"))

                    steps.append(step)
                else:
                    # 如果没有识别到动作，记录思考内容但继续循环
                    if step.thought:
                        logger.info(f"记录思考过程: {step.thought}")
                        steps.append(step)
                        # 即使没有action，也要添加消息历史以便模型继续
                        messages.append(AIMessage(content=content))
                        # 不中断，继续下一轮迭代 - 模型应该在下轮提供Action
                    else:
                        logger.warning("无法识别的动作类型且没有思考内容")
                        break

            except Exception as e:
                logger.error(f"迭代过程中出错: {str(e)}")
                break

        # 如果达到最大迭代次数仍未得到答案
        logger.warning("达到最大迭代次数，未能获得最终答案")
        self._save_conversation_history(question, steps)
        return "抱歉，我无法在限定步骤内回答您的问题。请尝试重新表述或简化问题。"

    def _save_conversation_history(self, question: str, steps: List[ReActStep]):
        """保存对话历史"""
        history = {
            "question": question,
            "steps": [
                {
                    "thought": step.thought,
                    "action": step.action,
                    "action_type": step.action_type.value,
                    "action_input": step.action_input,
                    "observation": step.observation,
                    "final_answer": step.final_answer
                }
                for step in steps
            ]
        }
        self.conversation_history.append(history)


def main():
    """主函数"""
    # 初始化LLM和智能体
    llm = openai_tongyi_chat_model()
    agent = ReActAgent(llm, max_iterations=5)

    # 测试问题
    test_questions = [
        "我手上有1万块钱，我能买多少克黄金？"
    ]

    print("=== ReAct智能理财助手 ===\n")

    for question in test_questions:
        print(f"用户问题: {question}")
        print("-" * 50)

        answer = agent.process_question(question)

        print(f"\n最终答案: {answer}")
        print("\n" + "="*70 + "\n")

    logger.info("=====输出所有的对话历史====")
    for history in agent.conversation_history:
        print(f"{history}")



if __name__ == "__main__":
    main()