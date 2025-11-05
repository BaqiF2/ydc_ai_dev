"""
动态模型选择
"""
import os
from dotenv import load_dotenv

load_dotenv()

from langchain_openai import ChatOpenAI
from langchain.agents import create_agent
from langchain.agents.middleware import wrap_model_call, ModelRequest, ModelResponse

basic_model = ChatOpenAI(api_key=os.getenv("DASHSCOPE_API_KEY"),
                         base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                         model="qwen-plus")

advance_model = ChatOpenAI(api_key=os.getenv("DASHSCOPE_API_KEY"),
                         base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                         model="qwen3-max")

@wrap_model_call
def dynamic_select_model(request:ModelRequest,handle)-> ModelResponse:
    if request.runtime.context["vip"] == 1:
        print("使用基础模型")
        model = basic_model
    else:
        print("使用高级模型")
        model = advance_model

    request.model = model
    return handle(request)



agent = create_agent(model=basic_model, tools=[],middleware=[dynamic_select_model])
agent.invoke(input={"messages":[{"role": "user", "content": "请计算1+1"}]},
             context={"vip": 1})
#输出：使用基础模型

agent.invoke(input={"messages":[{"role": "user", "content": "请计算1+1"}]},
             context={"vip": 2})
#输出：使用高级模型