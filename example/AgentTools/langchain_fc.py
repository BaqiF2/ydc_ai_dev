"""
使用langchain已经封装好的SDK
进行functionCalling的练习
"""

import os

from langchain_core.tools import tool
from langchain_openai import ChatOpenAI

# 初始化LLM
llm = ChatOpenAI(api_key=os.getenv("DASHSCOPE_API_KEY"),
                 base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                 model="qwen3-max")

# 使用@tool装饰器定义工具函数
@tool
def get_weather(city: str) -> str:
    """获取指定城市的天气信息"""
    return f"{city}的天气是晴天，温度为25度。"

@tool
def get_time() -> str:
    """获取当前时间"""
    from datetime import datetime
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

# 绑定多个工具到LLM -
tool_llm = llm.bind_tools(tools=[get_weather, get_time])

message_history = [{"role":"user", "content":"请告诉我北京天气和当前时间"}]

# 测试多个工具调用 -
print("\n=== 测试多个工具调用 ===")
multi_response = tool_llm.invoke(message_history)
print(f'内容: {multi_response.content}')
print(f'工具调用: {multi_response.tool_calls}')


# 将助手的响应添加到消息历史中
message_history.append({
    "role": "assistant",
    "content": multi_response.content,
    "tool_calls": multi_response.tool_calls
})

# 演示LangChain 1.0的新特性 - content_blocks
print("\n=== LangChain 1.0新特性 - content_blocks ===")
if hasattr(multi_response, 'content_blocks'):
    print(f'内容块: {multi_response.content_blocks}')
else:
    print("当前模型可能不支持content_blocks特性")

# 演示工具调用的结构化处理
print("\n=== 工具调用结果处理 ===")
if multi_response.tool_calls:
    for tool_call in multi_response.tool_calls:
        print(f"工具名称: {tool_call['name']}")
        print(f"参数: {tool_call['args']}")
        # 实际项目中这里会执行工具函数
        if tool_call['name'] == 'get_weather':
            # 调用基础函数
            result = get_weather.invoke(tool_call['args']['city'])
            print(f"执行结果: {result}")
            message_history.append({"role": "tool", "content": result, "tool_call_id": tool_call['id']})
        elif tool_call['name'] == 'get_time':
            # 调用基础函数
            result = get_time.invoke(None)
            print(f"执行结果: {result}")
            message_history.append({"role": "tool", "content": result, "tool_call_id": tool_call['id']})


final_result = tool_llm.invoke(message_history)

print(f"最终结果: {final_result.content}")

# 完整日志
"""
=== 测试多个工具调用 ===
内容: 
工具调用: [{'name': 'get_weather', 'args': {'city': '北京'}, 'id': 'call_2f7397098f7648f18bf3ff95', 'type': 'tool_call'}, {'name': 'get_time', 'args': {}, 'id': 'call_c49f888c34814863928c1506', 'type': 'tool_call'}]

=== LangChain 1.0新特性 - content_blocks ===
内容块: [{'type': 'tool_call', 'name': 'get_weather', 'args': {'city': '北京'}, 'id': 'call_2f7397098f7648f18bf3ff95'}, {'type': 'tool_call', 'name': 'get_time', 'args': {}, 'id': 'call_c49f888c34814863928c1506'}]

=== 工具调用结果处理 ===
工具名称: get_weather
参数: {'city': '北京'}
执行结果: 北京的天气是晴天，温度为25度。
工具名称: get_time
参数: {}
执行结果: 2025-10-30 21:28:42
最终结果: 北京当前天气是晴天，温度为25度。当前时间为2025年10月30日21点28分42秒。
"""



