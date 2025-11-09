"""
通过装饰器的方式
自定义中间件
"""
import os
from typing import Any, Callable

from dotenv import load_dotenv
from langchain.agents.middleware.types import ModelCallResult
from langchain.tools.tool_node import ToolCallRequest
from langchain_core.messages import ToolMessage
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool
from langgraph.runtime import Runtime
from langgraph.types import Command

load_dotenv()

from langchain.agents import create_agent, AgentState
from langchain.agents.middleware import ModelRequest, ModelResponse, AgentMiddleware
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import InMemorySaver


class CustomState(AgentState):
    """
    自定义的AgentState
    """
    user_id: str
    user_token: str


class CustomMiddleware(AgentMiddleware):
    """
    自定义的AgentMiddleware
    """

    def before_agent(self, state: CustomState, runtime: Runtime) -> dict[str, Any] | None:
        print("调用代理运行前中间件")
        return None

    def before_model(self, state: CustomState, runtime: Runtime) -> dict[str, Any] | None:
        """Logic to run before the model is called."""
        print("调用模型运行前中间件")
        return None

    def after_model(self, state: CustomState, runtime: Runtime) -> dict[str, Any] | None:
        """Logic to run after the model is called."""
        print("调用模型运行后中间件")
        return None

    def after_agent(self, state: CustomState, runtime: Runtime) -> dict[str, Any] | None:
        """Logic to run after the agent execution completes."""
        print("调用代理运行后中间件")
        return None

    def wrap_model_call(
            self,
            request: ModelRequest,
            handler: Callable[[ModelRequest], ModelResponse],
    ) -> ModelCallResult:
        print("调用模型环绕中间件")
        if len(request.messages) > 10:
            print("选择使用基础模型")
            request.model = base_model
        else:
            print("选择使用高级模型")
            request.model = base_model
        return handler(request)

    def wrap_tool_call(
            self,
            request: ToolCallRequest,
            handler: Callable[[ToolCallRequest], ToolMessage | Command],
    ) -> ToolMessage | Command:
        print("调用工具环绕中间件")
        print(f"Executing tool: {request.tool_call['name']}")
        print(f"Arguments: {request.tool_call['args']}")

        try:
            result = handler(request)
            print(f"Tool completed successfully")
            return result
        except Exception as e:
            print(f"Tool failed: {e}")
            raise


@tool
def get_weather(location: str) -> str:
    """Get the weather at a location."""
    return {"messages": [{"role": "assistant", "content": f"It's sunny in {location}."}]}


base_model = ChatOpenAI(api_key=os.getenv("DASHSCOPE_API_KEY"),
                        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                        model="qwen3-max")

agent = create_agent(
    base_model,
    tools=[get_weather],
    middleware=[CustomMiddleware()],
    checkpointer=InMemorySaver()
)
config: RunnableConfig = {"configurable": {"thread_id": "1"}}
r = agent.invoke({"messages": [{"role": "user", "content": "北京天气怎么样?"}]}, config=config)

for message in r['messages']:
    message.pretty_print()
