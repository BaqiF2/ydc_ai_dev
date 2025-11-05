"""
模型-工具调用
强制使用工具
并行工具调用
"""
import os
from dotenv import load_dotenv
load_dotenv()

from langchain_openai import ChatOpenAI
from langchain.tools import tool

basic_model = ChatOpenAI(base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                         model="qwen3-max",
                         api_key=os.getenv("DASHSCOPE_API_KEY"))


@tool
def get_weather(location: str) -> str:
    """Get the weather at a location."""
    return f"It's sunny in {location}."

# 绑定工具
tool_model = basic_model.bind_tools([get_weather])

response = tool_model.invoke("请告诉我北京天气和当前时间")

print(response.content_blocks)

print("工具调用：")
for tool in response.tool_calls:
    print(tool.get('name'))
    print(tool.get('args'))


# 工具的调用
call_message = response.tool_calls[0]
tool_result = get_weather.invoke(call_message)
print(tool_result)

## 强制使用工具
# choice_tool_model = basic_model.bind_tools([get_weather],tool_choice='any')
# choice_any_result = choice_tool_model.invoke("请告诉我北京当前时间")
# print(f'choice_any_result: {choice_any_result.content_blocks}')
#
# # 强制指定使用工具
# choice_tool_model = basic_model.bind_tools([get_weather],tool_choice='get_weather')
# choice_select_result = choice_tool_model.invoke("请告诉我北京当前时间")
# print(f'choice_select_result: {choice_select_result.content_blocks}')

## 并行工具调用
# @tool
# def get_time() -> str:
#     """获取当前时间"""
#     from datetime import datetime
#     return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
#
# batch_tool_model = basic_model.bind_tools([get_weather,get_time])
# batch_result = batch_tool_model.invoke("请告诉我北京天气和当前时间")
# print(f'batch_result: {batch_result.content_blocks}')

## 流式工具调用（个人觉得意义不大，就不作为知识点整理了）

