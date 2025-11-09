"""
通过装饰器的方式
自定义中间件
"""
from typing import Any, Callable

from langchain.chat_models import init_chat_model
from langchain.tools.tool_node import ToolCallRequest
from langchain_core.messages import ToolMessage
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool
from langgraph.runtime import Runtime
from langgraph.types import Command
from requests import RequestException, Timeout

import os
from dotenv import load_dotenv

load_dotenv()

from langchain.agents import create_agent, AgentState
from langchain.agents.middleware import ToolRetryMiddleware, before_agent, after_agent, before_model, after_model, \
    wrap_model_call, wrap_tool_call, dynamic_prompt, ModelRequest, ModelResponse
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import InMemorySaver


class CustomState(AgentState):
    """
    自定义的AgentState
    """
    user_id: str
    user_token: str


@tool
def get_weather(location: str) -> str:
    """Get the weather at a location."""
    return {"messages": [{"role": "assistant", "content": f"It's sunny in {location}."}]}


@before_agent
def before_agent_middleware(state: CustomState, runtime: Runtime) -> dict[str, Any] | None:
    print("调用代理运行前中间件")
    return None


@after_agent
def after_agent_middleware(state: CustomState, runtime: Runtime) -> dict[str, Any] | None:
    print("调用代理运行后中间件")
    return None


@before_model(can_jump_to=["end"])
def before_model_middleware(state: CustomState, runtime: Runtime) -> dict[str, Any] | None:
    print("调用模型运行前中间件")
    return None


@after_model
def after_model_middleware(state: CustomState, runtime: Runtime) -> dict[str, Any] | None:
    print("调用模型运行后中间件")
    return None


@wrap_model_call
def wrap_model_call_middleware(
        request: ModelRequest,
        handler: Callable[[ModelRequest], ModelResponse],
) -> ModelResponse:
    print("调用模型环绕中间件")
    if len(request.messages) > 10:
        print("选择使用基础模型")
        request.model = base_model
    else:
        print("选择使用高级模型")
        request.model = base_model
    return handler(request)


@wrap_tool_call
def wrap_tool_call_middleware(request: ToolCallRequest,
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


@dynamic_prompt
def personalized_prompt(request: ModelRequest) -> str:
    user_id = "BaqiF2"
    print("进入动态修改提示词中间件")
    return f"You are a helpful assistant for user {user_id}. Be concise and friendly."


base_model = ChatOpenAI(api_key=os.getenv("DASHSCOPE_API_KEY"),
                        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                        model="qwen3-max")

agent = create_agent(
    base_model,
    tools=[get_weather],
    middleware=[before_agent_middleware, before_model_middleware, personalized_prompt, wrap_model_call_middleware,
                wrap_tool_call_middleware, after_model_middleware, after_agent_middleware],
    checkpointer=InMemorySaver()
)
config: RunnableConfig = {"configurable": {"thread_id": "1"}}
r = agent.invoke({"messages": [{"role": "user", "content": "北京天气怎么样?"}]}, config=config)

for message in r['messages']:
    message.pretty_print()
