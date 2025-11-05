"""
演示两种定义包含历史消息的方式
"""

from langchain.messages import AIMessage,HumanMessage,ToolMessage,SystemMessage


## 1. 使用列表 BaseMessage 实现类
system_message = SystemMessage(
    content="你是一个天气查询助手，你需要根据用户输入的地点查询天气。"
)

user_message = HumanMessage(
    content="今天北京的天气？"
)

ai_message = AIMessage(
    content=[],
    tool_calls=[{
        "name": "get_weather",
        "args": {"location": "北京"},
        "id": "call_123"
    }]
)

tool_message = ToolMessage(
    content="北京今天晴，23度",
    tool_call_id="call_123"  # Must match the call ID
)
history_messages = [
    system_message,
    user_message,
    ai_message,
    tool_message
]

## 使用openAI字典格式
system_message_dict = {"role": "system", "content": "你是一个天气查询助手，你需要根据用户输入的地点查询天气。"}
user_message_dict = {"role": "user", "content": "今天北京的天气？"}
ai_message_dict = {"role": "assistant", "content": [], "tool_calls": [{"name": "get_weather", "args": {"location": "北京"}, "id": "call_123"}]}
tool_message_dict = {"role": "tool", "content": "北京今天晴，23度", "tool_call_id": "call_123"}
history_messages_dict = [system_message_dict, user_message_dict, ai_message_dict, tool_message_dict]