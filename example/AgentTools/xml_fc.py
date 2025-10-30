# -*- coding: utf-8 -*-
"""
通过XML格式来提示工具的使用，实现 FunctionCalling
"""
import json
import os
from dotenv import load_dotenv
load_dotenv()

import requests
from datetime import datetime
import re


def get_weather(city: str) -> str:
    """获取指定城市的天气信息"""
    return f"{city}的天气是晴天，温度为25度。"


def get_time() -> str:
    """获取当前时间"""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


# 构造XML格式的提示词
system_prompt = """
你是一个专业的人工智能助手，你会根据用户的问题来解答。你可以借助工具来辅助你生成答案。

工具定义：
1. get_weather: 获取指定城市的天气信息，参数：city (string, required) - 城市名称
2. get_time: 获取当前时间，无需参数

请根据用户的问题，选择合适的工具来调用。如果你需要调用工具，请按照以下XML格式返回：

<tool_calls>
    <invoke name="工具名称">
        <parameter name="参数名">参数值</parameter>
        <parameter name="参数名">参数值</parameter>
    </invoke>
    <invoke name="另一个工具名称">
        <parameter name="参数名">参数值</parameter>
    </invoke>
</tool_calls>

如果不需要调用工具，请直接回答用户问题。
"""


def call_qwen_api(messages: list) -> dict:
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

    try:
        response = requests.post(url, headers=headers, json=data)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"API请求失败: {e}")
        return {"error": str(e)}


def parse_xml_tool_calls(content: str) -> list:
    """解析XML格式的工具调用"""
    tool_calls = []

    # 使用正则表达式解析XML
    # 匹配 <tool_calls> 标签内的内容
    tool_calls_match = re.search(r'<tool_calls>(.*?)</tool_calls>', content, re.DOTALL)
    if not tool_calls_match:
        return tool_calls

    tool_calls_content = tool_calls_match.group(1)

    # 匹配所有 <invoke> 标签
    invoke_pattern = r'<invoke name="([^"]+)">(.*?)</invoke>'
    invoke_matches = re.findall(invoke_pattern, tool_calls_content, re.DOTALL)

    for tool_name, params_content in invoke_matches:
        # 解析参数
        param_pattern = r'<parameter name="([^"]+)">([^<]*)</parameter>'
        param_matches = re.findall(param_pattern, params_content, re.DOTALL)

        arguments = {}
        for param_name, param_value in param_matches:
            arguments[param_name] = param_value.strip()

        tool_calls.append({
            "name": tool_name,
            "arguments": arguments
        })

    return tool_calls


def execute_tool_call(tool_name: str, arguments: dict) -> str:
    """执行工具调用"""
    if tool_name == "get_weather":
        city = arguments.get("city")
        return get_weather(city)
    elif tool_name == "get_time":
        return get_time()
    else:
        return f"未知工具: {tool_name}"


def chat_with_xml_tools(user_message: str) -> str:
    """与XML格式工具的助手对话"""
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
    response = call_qwen_api(messages)

    if "error" in response:
        return f"API调用失败: {response['error']}"

    # 解析响应
    try:
        message = response["output"]["choices"][0]["message"]
        content = message.get("content", "")

        print(f"第一次返回调用结果: {content}")

        # 解析XML格式的工具调用
        tool_calls = parse_xml_tool_calls(content)

        # 如果有工具调用
        if tool_calls:
            print("\n=== 工具调用 ===")
            tool_results = []
            tool_call_ids = []

            # 处理每个工具调用
            for i, function in enumerate(tool_calls):
                tool_name = function["name"]
                arguments = function["arguments"]

                print(f"调用工具: {tool_name}")
                print(f"调用参数: {arguments}")

                # 执行工具
                result = execute_tool_call(tool_name, arguments)
                print(f"执行结果: {result}")
                tool_results.append(result)
                # 为每个工具调用创建ID
                tool_call_ids.append(f"call_{i}")

            # 将工具调用结果添加到消息历史
            # 由于使用XML格式，我们需要构造一个assistant消息来表示工具调用
            tool_calls_text = f"<tool_calls>\n"
            for i, function in enumerate(tool_calls):
                tool_calls_text += f'    <invoke name="{function["name"]}">\n'
                for param_name, param_value in function["arguments"].items():
                    tool_calls_text += f'        <parameter name="{param_name}">{param_value}</parameter>\n'
                tool_calls_text += f"    </invoke>\n"
            tool_calls_text += "</tool_calls>"

            messages.append({
                "role": "assistant",
                "content": tool_calls_text
            })

            # 添加工具结果
            for i, result in enumerate(tool_results):
                messages.append({
                    "role": "user",
                    "content": f"工具 {tool_calls[i]['name']} 的执行结果: {result}"
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
    print("=== XML Function Calling 示例 ===\n")
    # 测试问题
    question = "请告诉我北京天气和当前时间"
    print(chat_with_xml_tools(question))


if __name__ == "__main__":
    main()