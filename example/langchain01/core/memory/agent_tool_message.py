"""
使用工具访问记忆
"""

from langchain.agents import AgentState
from langchain.tools import ToolRuntime
from langchain_core.messages import ToolMessage
from langchain_core.tools import tool

from dotenv import load_dotenv
from langgraph.types import Command


load_dotenv()

class CustomState(AgentState):
    risk_level:int

@tool
def risk_check(
        runtime: ToolRuntime
) -> str:
    """检查风控是否达标"""
    risk_level = runtime.state["risk_level"]
    if risk_level > 3:
        raise ValueError("Risk level too high")
    return "ok"


@tool
def risk_check_and_set(
    runtime: ToolRuntime[CustomState],
) -> Command:
    """检查风控是否达标"""
    risk_level = runtime.state["risk_level"]
    if risk_level > 3:
        raise ValueError("Risk level too high")
    return Command(update={"risk_level": 2,
                           "messages": ToolMessage("当前风险等级为2，正常范围",  tool_call_id=runtime.tool_call_id)})