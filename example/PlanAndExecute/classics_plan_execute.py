"""
Plan-and-Execute Agent实现 - 基于规划-执行分离架构
核心思想：先制定完整计划，再逐步执行，支持任务依赖管理
"""
import logging
import os
from dotenv import load_dotenv
load_dotenv()

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Dict, Any
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# llm client
def openai_tongyi_chat_model() -> ChatOpenAI:
    """创建通义千问聊天模型"""
    return ChatOpenAI(
        api_key=os.getenv("DASHSCOPE_API_KEY"),
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        model="qwen3-max"
    )

# 任务状态定义
class TaskStatus(Enum):
    """任务状态"""
    PENDING, EXECUTING, COMPLETED, FAILED = "pending", "executing", "completed", "failed"


@dataclass
class Task:
    """任务数据结构"""
    id: int
    description: str
    tool_name: str
    tool_input: str
    status: TaskStatus = TaskStatus.PENDING
    result: Optional[str] = None
    dependencies: List[int] = field(default_factory=list)

    def __str__(self):
        return (f"任务ID: {self.id} 描述: {self.description} 工具: {self.tool_name} 参数: {self.tool_input} "
                f"状态: {self.status} 结果: {self.result}")


@dataclass
class ExecutionPlan:
    """执行计划"""
    goal: str
    tasks: List[Task]

    def __str__(self):
        return f"执行目标:\n  {self.goal} \n 任务：\n {self.tasks}"


class MockToolExecutor:
    """模拟工具执行器"""

    def __init__(self):
        self.tools = {
            "search_market_data": self._search_market_data,
            "calculate": self._calculate,
            "query_user_profile": self._query_user_profile,
            "analyze_investment": self._analyze_investment,
        }

    def _search_market_data(self, query: str) -> str:
        """搜索市场数据"""
        logger.info(f"搜索Web数据: {query}")
        # 这里mock方式来替代真实数据源
        if "股票" in query or "指数" in query: return "沪深300: 3850点, 上证: 3100点"
        if "基金" in query: return "货币2-3%, 债券3.5-5%, 混合5-8%"
        if "理财" in query or "稳健" in query: return "理财3-4%, 国债2.5-3%"
        return f"未找到'{query}'数据"

    def _calculate(self, expression: str) -> str:
        """数学计算"""
        logger.info(f"进行计算，计算公式: {expression}")
        try:
            if not all(c in set('0123456789+-*/(). ') for c in expression):
                return "错误: 非法字符"
            return f"{eval(expression)}"
        except Exception as e:
            return f"计算错误: {str(e)}"

    def _query_user_profile(self, user_id: str) -> str:
        """查询用户画像"""
        logger.info(f"查询用户画像: {user_id}")
        return "风险偏好: 稳健型, 期限: 3-5年, 可投: 10万元"

    def _analyze_investment(self, params: str) -> str:
        """投资分析"""
        logger.info(f"分析: {params}")
        return "建议: 60%债券+30%混合+10%货币, 预期4-6%"

    # 统一外部调用入口
    def execute(self, tool_name: str, tool_input: str) -> str:
        """执行工具"""
        if tool_name in self.tools:
            return self.tools[tool_name](tool_input)
        return f"错误: 未知工具 '{tool_name}'"


class PlanParser:
    """计划解析器"""

    @staticmethod
    def parse_plan(content: str) -> List[Task]:
        """解析计划文本，提取任务列表"""
        tasks = []
        lines = content.strip().split('\n')

        # <任务编号>. [<工具名>] <任务描述>|<工具输入>
        for line in lines:
            # 检查行是否以数字和点开始（例如："1."、"2."等）
            if not line.strip() or not re.match(r'^\d+\.', line.strip()):
                continue
            # 如果行是空的或者不匹配这种模式，则跳过该行
            task_match = re.match(r'^(\d+)\.\s*\[(\w+)\]\s*(.*)', line.strip())
            if not task_match:
                continue
            # 任务id
            task_id = int(task_match.group(1))
            # 工具名称
            tool_name = task_match.group(2).strip()
            # 任务描述
            rest_content = task_match.group(3).strip()
            # 将剩余内容按竖线"|"分割成多个部分 "描述|输入参数"
            parts = rest_content.split('|')
            
            if len(parts) < 2:
                continue
            
            description = parts[0].strip()
            tool_input = parts[1].strip()
            dependencies = []

            # 检查依赖任务
            if len(parts) > 2 and '依赖' in parts[2]:
                dep_match = re.search(r'依赖[:\s：]*([\d,\s]+)', parts[2])
                if dep_match:
                    dep_str = dep_match.group(1).strip()
                    dependencies = [int(d.strip()) for d in dep_str.split(',') if d.strip().isdigit()]
            
            tasks.append(Task(
                id=task_id,
                description=description,
                tool_name=tool_name,
                tool_input=tool_input,
                dependencies=dependencies
            ))
        
        logger.info(f"解析到 {len(tasks)} 个任务")
        return tasks


class PlanAndExecuteAgent:
    """Plan-and-Execute智能体"""

    def __init__(self, llm: ChatOpenAI, max_replanning: int = 2):
        self.llm = llm
        self.max_replanning = max_replanning
        self.tool_executor = MockToolExecutor()
        self.plan_parser = PlanParser()
        
        # 规划提示词
        self.planner_prompt = """你是任务规划助手，将复杂问题分解为可执行子任务。

## 可用工具
1. search_market_data - 搜索市场数据
2. calculate - 数学计算（必须使用具体数字，如: 100000*0.05）
3. query_user_profile - 查询用户画像
4. analyze_investment - 投资分析

## 重要规则
- calculate工具的参数必须是可直接计算的数学表达式
- 不要使用"投资方案参数"等描述性文字
- 如需计算，必须写出完整表达式，如: 100000*0.05, 50000/550

## 输出格式（严格遵守）
1. [工具名] 任务描述 | 参数
2. [工具名] 任务描述 | 参数 | 依赖: 1

示例：
1. [query_user_profile] 查询用户风险偏好 | user_001
2. [search_market_data] 查询理财收益 | 理财
3. [analyze_investment] 分析配置 | 10万元,稳健 | 依赖: 1,2
4. [calculate] 计算预期年收益 | 100000*0.05 | 依赖: 3

请为用户问题制定计划:"""

    def _create_plan(self, goal: str) -> ExecutionPlan:
        """创建执行计划"""
        messages = [SystemMessage(content=self.planner_prompt), HumanMessage(content=goal)]
        response = self.llm.invoke(messages)
        plan_text = response.content
        logger.info(f"生成投资计划 :\n{plan_text}")
        
        tasks = self.plan_parser.parse_plan(plan_text)
        return ExecutionPlan(goal=goal, tasks=tasks)

    def _execute_task(self, task: Task, context: Dict[str, Any]) -> str:
        """执行单个任务"""
        logger.info(f"执行任务 {task.id}: {task.description}")
        task.status = TaskStatus.EXECUTING
        
        try:
            result = self.tool_executor.execute(task.tool_name, task.tool_input)
            task.result = result
            task.status = TaskStatus.COMPLETED
            logger.info(f"任务 {task.id} 完成: {result}")
            return result
        except Exception as e:
            logger.error(f"任务 {task.id} 失败: {str(e)}")
            task.status = TaskStatus.FAILED
            task.result = f"失败: {str(e)}"
            return task.result

    def _can_execute_task(self, task: Task, completed: List[int]) -> bool:
        """检查任务依赖是否满足"""
        # 没有依赖任务
        if not task.dependencies:
            return True
        # 所有依赖任务都已经完成
        return all(dep_id in completed for dep_id in task.dependencies)

    def _synthesize_answer(self, plan: ExecutionPlan) -> str:
        """综合任务结果生成最终答案"""

        context = f"问题: {plan.goal}\n\n结果:\n"

        logger.info(f"综合答案,上下文\n {context}")
        for task in plan.tasks:
            if task.status == TaskStatus.COMPLETED:
                context += f"- {task.description}: {task.result}\n"
        
        synthesis_prompt = """根据执行结果，为用户生成清晰完整的答案。
要求: 直接回答问题，综合信息，语言简洁。"""

        messages = [SystemMessage(content=synthesis_prompt), HumanMessage(content=context)]
        response = self.llm.invoke(messages)
        return response.content

    def run(self, goal: str) -> str:
        """运行Plan-and-Execute流程"""
        logger.info(f"要解决的问题: {goal}")
        
        # 阶段1: 制定计划
        plan = self._create_plan(goal)
        
        # 阶段2: 执行计划
        logger.info(f"开始执行计划{plan}")
        completed_tasks = []
        context = {}
        
        while len(completed_tasks) < len(plan.tasks):
            progress_made = False
            
            for task in plan.tasks:
                if task.status in [TaskStatus.COMPLETED, TaskStatus.FAILED]:
                    continue
                
                if self._can_execute_task(task, completed_tasks):
                    result = self._execute_task(task, context)
                    context[f"task_{task.id}"] = result
                    
                    if task.status == TaskStatus.COMPLETED:
                        completed_tasks.append(task.id)
                    
                    progress_made = True
            
            if not progress_made:
                logger.warning("无法继续执行")
                break
        return self._synthesize_answer(plan)


def main():
    """主函数"""
    llm = openai_tongyi_chat_model()
    agent = PlanAndExecuteAgent(llm, max_replanning=2)
    
    test_questions = [
        "我有10万元，想做稳健投资，帮我制定一个投资方案"
    ]

    for idx, question in enumerate(test_questions, 1):
        try:
            answer = agent.run(question)
            print("最终答案:")
            print(answer)
        except Exception as e:
            logger.error(f"执行出错: {str(e)}")


if __name__ == "__main__":
    main()
