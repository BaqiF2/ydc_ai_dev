"""
补充 langchain_core.messages trim_messages 方法的使用：
 修剪历史消息记录
 修剪后的消息需要满足以下的条件
 -
     1. 聊天记录要以一个human消息或一个system消息作为开始
     2. 聊天记录要以一个human消息或tool消息作为结束
     3. 工具消息只能出现在一个AIMessage之后
    可以通过设置 start_on="human" 和 end_on=("human"， "tool") 来实现。

 -
    显示最新的消息，并删除聊天记录中的旧消息。
    这可以通过设置参数“strategy=last”来实现。
 -
    通常情况下，新的聊天记录中应包含系统消息。如果存在该系统消息，它几乎总是记录中的第一条消息。
    这可以通过设置 include_system=True 来实现。
"""
from langchain_core.messages.utils import count_tokens_approximately
from langchain.messages import AIMessage,HumanMessage,ToolMessage,SystemMessage,trim_messages
from langchain_openai import ChatOpenAI
import os
from dotenv import load_dotenv
load_dotenv()


model = 5

messages = [
    SystemMessage("you're a good assistant, you always respond with a joke."),
    HumanMessage("i wonder why it's called langchain"),
    AIMessage(
        'Well, I guess they thought "WordRope" and "SentenceString" just didn\'t have the same ring to it!'
    ),
    HumanMessage("and who is harrison chasing anyways"),
    AIMessage(
        "Hmmm let me think.\n\nWhy, he's probably chasing after the last cup of coffee in the office!"
    ),
    HumanMessage("what do you call a speechless parrot"),
]

trim_message = []

base_model = ChatOpenAI(api_key=os.getenv("DASHSCOPE_API_KEY"),
                        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                        model="qwen3-max")

# 1. 通过token数量来裁剪
if model == 1:
    trim_message = trim_messages(
        messages,
        # 保留最后N个词元
        strategy="last",
        # 传递一个方法来计算词元数
        token_counter=count_tokens_approximately,
        # 最多允许45个词元
        max_tokens=45,
        # 以用户消息开始
        end_on=("human", "tool"),
        # 保留系统消息
        include_system=True,
        allow_partial=False,
    )
    print(trim_message)

# 2. 根据消息数量计数
if model == 2:
    trim_message = trim_messages(
        messages,
        # 保留最后N个消息
        strategy="last",
        token_counter=len,
        # 最多允许4个消息. 当使用len作为计数时，每条消息单独计数
        max_tokens=4,
    )
    print(trim_message)

# 3. 使用LLm计数

if model == 3:
    trim_message = trim_messages(
        messages,
        strategy= "last",
        token_counter = base_model,
        max_tokens= 45,
    )
    print(trim_message)