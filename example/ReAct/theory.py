"""
更好的理解ReAct原理，使用底层实现方式来调用
"""
import re

from example.chat_models import openai_tongyi_chat_model

# 1. 提示词设计

prompt = """
# 角色
你是一个智能理财助手，需要通过思考和行动来回答问题。

# 框架说明
请严格按照以下格式回答：
Thought: <你的思考过程>
Action: <要执行的动作>
Observation: <动作执行的结果>
...（这个循环可以重复多次）

# 可用工具
1. search_web(query): 搜索最新信息，参数query是搜索关键词
2. calculate(expression): 执行数学计算，参数expression是数学表达式

"""

# 2. 创建工具
def search_web(query):
    print(f"正在搜索：{query}")
    # 模拟搜索返回，实际中这里应该调用真实的搜索API
    if "黄金" in query or "gold" in query:
        return "根据最新数据，今日黄金价格约为1200元/克。"
    return "未找到相关信息"

def calculate(expression):
    print(f"正在计算：{expression}")
    try:
        return str(eval(expression))
    except Exception as e:
        return f"计算错误: {e}"


# 3. llm定义
llm  = openai_tongyi_chat_model()


max_iterations = 5  # 防止无限循环
iteration = 0

# 4. 创建ReActAgent 循环逻辑
messages : list[dict] = [{"role": "system", "content": prompt},{"role": "user", "content": "我手上有1万块钱大概能买多少克黄金？"}]

while iteration < max_iterations:
    iteration += 1
    print(f"\n=== 第{iteration}轮迭代 ===")

    # 调用LLM
    res = llm.invoke(messages)
    print("LLM响应:", res.content)

    # 解析响应内容
    content = res.content

    # 提取Thought
    thought_match = re.search(r'Thought:\s*(.*?)(?=\nAction:|\nObservation:|$)', content, re.DOTALL)
    if thought_match:
        thought = thought_match.group(1).strip()
        print(f"思考: {thought}")

    # 提取Action
    action_match = re.search(r'Action:\s*(.*?)(?=\nObservation:|\nThought:|$)', content, re.DOTALL)
    if action_match:
        action = action_match.group(1).strip()
        print(f"行动: {action}")
        # 检查是否需要结束
        if "回答用户问题" in action:
            print("=== 最终回答 ===")
            # 提取最终回答
            final_answer_match = re.search(r'Observation:\s*(.*)', content)
            if final_answer_match:
                print(f"最终答案: {final_answer_match.group(1)}")
            break

        # 执行工具调用
        observation = ""
        if action.startswith("search_web("):
            query = action[11:-1].strip('"\'')  # 提取查询参数
            observation = search_web(query)
        elif action.startswith("calculate("):
            expression = action[10:-1].strip()  # 提取计算表达式
            observation = calculate(expression)
        else:
            observation = f"未知动作: {action}"

        print(f"观察: {observation}")

        # 将观察结果添加到消息中，继续下一轮
        messages.append({"role": "assistant", "content": content})
        messages.append({"role": "user", "content": f"Observation: {observation}"})
    else:
        print("未找到有效的Action，结束循环")
        break
