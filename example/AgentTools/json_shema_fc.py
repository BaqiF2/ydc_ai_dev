"""
通过原始的json schema + 提示词 + rest调用接口的方式来练习 FunctionCalling
"""
import json
import os
from dotenv import load_dotenv
load_dotenv()

import requests
from datetime import datetime


def get_weather(city: str) -> str:
    """获取指定城市的天气信息"""
    return f"{city}的天气是晴天，温度为25度。"


def get_time() -> str:
    """获取当前时间"""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

# 构造提示词
system_prompt = f"""
你是一个专业的人工智能助手，你会根据用户的问题来解答。你可以借助工具来辅助你生成答案。

工具定义：
1. get_weather: 获取指定城市的天气信息，参数：city (string, required) - 城市名称
2. get_time: 获取当前时间，无需参数

请根据用户的问题，选择合适的工具来调用。如果你需要调用工具，请按照以下JSON格式返回：

{{
    "tool_calls": [
        {{
            "name": "工具名称",
            "arguments": {{"参数名": "参数值"}}
        }}
    ]
}}

如果不需要调用工具，请直接回答用户问题。
"""


def call_qwen_api(messages: list, tools: dict = None) -> dict:
    """调用通义千问API"""
    api_key = os.getenv("DASHSCOPE_API_KEY")
    url = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    # 构建请求数据
    data = {
        "model": "qwen3-max",
        "input": {
            "messages": messages
        },
        "parameters": {
            "result_format": "message",
            "temperature": 0.7
        }
    }

    # 如果有工具定义，添加到请求中
    if tools:
        data["input"]["tools"] = [{
            "type": "function",
            "function": {
                "name": tool_name,
                "description": tool_desc,
                "parameters": tool_schema
            }
        } for tool_name, (tool_desc, tool_schema) in tools.items()]

    try:
        response = requests.post(url, headers=headers, json=data)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"API请求失败: {e}")
        return {"error": str(e)}


def execute_tool_call(tool_name: str, arguments: dict) -> str:
    """执行工具调用"""
    if tool_name == "get_weather":
        city = arguments.get("city")
        return get_weather(city)
    elif tool_name == "get_time":
        return get_time()
    else:
        return f"未知工具: {tool_name}"


def chat_with_tools(user_message: str) -> str:
    """与带工具的助手对话"""
    # 定义工具
    tools = {
        "get_weather": (
            "获取指定城市的天气信息",
            {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "城市名称"
                    }
                },
                "required": ["city"]
            }
        ),
        "get_time": (
            "获取当前时间",
            {
                "type": "object",
                "properties": {},
                "required": []
            }
        )
    }

    # 第一次调用
    print("========= 第一次调用 =========")
    messages = [
        {
            "role": "system",
            "content": system_prompt
        },
        {
            "role": "user",
            "content": user_message
        }
    ]

    # 调用API
    response = call_qwen_api(messages, tools)

    if "error" in response:
        return f"API调用失败: {response['error']}"

    # 解析响应
    try:
        message = response["output"]["choices"][0]["message"]
        content = message.get("content", "")

        try:
            content_dict = json.loads(content)
            tool_calls = content_dict.get("tool_calls", [])
        except json.JSONDecodeError:
             print(f"解析响应失败: {content}")
             tool_calls = message.get("tool_calls", [])

        print(f"第一次返回调用结果: {content}")

        # 如果有工具调用
        if tool_calls:
            print("\n=== 工具调用 ===")
            tool_results = []
            tool_call_ids = []

            # 修改工具调用的处理方式
            for i, function in enumerate(tool_calls):
                tool_name = function["name"]
                arguments = function["arguments"]

                print(f"调用工具: {tool_name}")
                # 执行工具
                result = execute_tool_call(tool_name, arguments)
                print(f"执行结果: {result}")
                tool_results.append(result)
                # 为每个工具调用创建ID
                tool_call_ids.append(f"call_{i}")

            # 将工具调用结果添加到消息历史 - 使用正确的格式
            tool_calls_formatted = []
            for i, function in enumerate(tool_calls):
                tool_calls_formatted.append({
                    "id": tool_call_ids[i],
                    "type": "function",
                    "function": {
                        "name": function["name"],
                        "arguments": json.dumps(function["arguments"])
                    }
                })

            messages.append({
                "role": "assistant",
                "content": "",
                "tool_calls": tool_calls_formatted
            })

            # 添加工具结果
            for i, result in enumerate(tool_results):
                messages.append({
                    "role": "tool",
                    "content": result,
                    "tool_call_id": tool_call_ids[i]
                })

            # 再次调用API获取最终回答
            print("\n=== 生成最终回答 ===")
            final_response = call_qwen_api(messages)
            if "error" not in final_response:
                final_content = final_response["output"]["choices"][0]["message"]["content"]
                print(f"最终回答: {final_content}")
                return final_content

        return content

    except (KeyError, IndexError, json.JSONDecodeError) as e:
        return f"解析响应失败: {e}"


def main():
    """主函数"""
    print("=== JSON Schema Function Calling 示例 ===\n")
    # 测试问题
    question = "请告诉我北京天气和当前时间"
    print(chat_with_tools(question))


if __name__ == "__main__":
    main()
