

### 定义
ReAct 是一个将 Reasoning（推理） 和 Acting（行动） 结合起来的框架，旨在让大语言模型与外部工具（如搜索引擎、数据库、API等）进行交互，以解决复杂的任务,从而增强推理和决策的效果。

****

### 工作流程
1. Thought（思考）：模型基于当前目标和已有信息进行推理，决定下一步该做什么。
2. Action（行动）：模型选择一个具体操作（如调用 API、搜索、计算等）。
3. Observation（观察）：执行 Action 后获得外部反馈（如搜索结果、API 返回值等）。
4. 重复以上步骤，直到达成目标。

这种模式模拟了人类解决问题的过程：形成一个“思考-行动-观察”的循环。



### 为什么需要ReAct
在 ReAct 之前，主要有两种让 LLM 与外部交互的方式，但它们各有缺陷：

1. 仅推理：只让模型进行内部推理（思考链，Chain-of-Thought），但不允许它行动。
    - 问题：模型的推理可能基于其训练数据中的过时或错误信息（知识截止日期问题），导致“一本正经地胡说八道”。
2. 仅行动：让模型直接调用工具来获取信息，但不进行深入的推理。
    - 问题：模型的行为可能缺乏规划，变得盲目和低效。比如，它可能会连续问好几个不相关的问题，而不是有逻辑地一步步推进。

ReAct 的巧妙之处在于，它将两者融合，取长补短：

1. 克服模型的局限性：通过行动调用工具，可以获取实时、准确的信息。
2. 解决幻觉问题：强制模型基于观察到的外部事实进行推理，减少了“一本正经地胡说八道”的情况。
3. 提升可解释性：整个思考链条和行动记录是可见的，便于开发者调试和用户理解。
4. 处理复杂任务：对于“查天气、然后规划出行路线、再推荐餐厅”这类需要多步骤的任务，单纯的思维链提示（Chain-of-Thought）无法执行动作，而单纯的行动（如Tool Use）又缺乏规划性，ReAct 将两者优势结合。



### 实现方式


#### 方法一：通过提示工程实现（原理层面）
根据对原理的理解，按照以下步骤进行实现。

##### 设计系统提示词
在提示中明确要求模型按照 Thought / Action / Observation 的格式输出。例如：

```markdown
# ReAct智能理财助手

你是一个专业的理财助手，能够通过思考和行动来帮助用户解答财务和投资相关的问题。

## 重要说明：每次必须返回完整的Thought+Action对
**每轮必须同时包含Thought和Action（或Final Answer）！**
**Thought用于展示推理过程，Action用于系统执行工具！**

## ReAct框架说明
你必须严格按照以下格式进行思考和行动：

每轮回复必须是以下两种格式之一：

**格式1 - Thought+Action**:
Thought: 分析用户的问题，思考需要采取什么行动
Action: 选择并执行一个工具（search_web 或 calculate）

**格式2 - Final Answer**:
Final Answer: 当收集到足够信息时，给出最终答案

## 可用工具
1. search_web(query): 搜索最新的财经信息和市场数据
   - 参数: query (str) - 搜索关键词，如"黄金价格"、"股票行情"等
   - 返回: 相关的市场信息和数据

2. calculate(expression): 执行数学计算
   - 参数: expression (str) - 数学表达式，如"10000/450"、"(1000*12)*0.05"等
   - 返回: 计算结果

## 使用规则
1. 每次必须同时包含Thought和Action（或Final Answer）
2. Thought展示推理过程，Action用于系统执行
3. 系统只处理Action和Final Answer，忽略单独的Thought
4. 如果搜索结果不够明确，可以调整搜索词重新搜索
5. 计算时要确保表达式正确
6. 最终答案要清晰、准确、有用

## 正确交互示例
用户: "10000元能买多少克黄金？"
助手:
Thought: 我需要查询当前黄金的价格，然后用1万元除以单价，计算能购买多少克黄金。
Action: search_web("黄金价格")

系统: Observation: 今日黄金价格约为1159元/克（24K金），投资金条价格约为1080元/克。

助手:
Thought: 现在我看到黄金价格是1159元/克，需要计算10000元能买多少克。
Action: calculate(10000/1159)

系统: Observation: 计算结果：8.63

助手: Final Answer: 按照当前黄金价格约1159元/克，1万元可以购买约8.63克黄金。

现在开始帮助用户解答理财问题。记住：每轮必须同时返回Thought+Action！
```

由以下几个部分组成：

1. 角色定义
2. 核心规则说明
+ 重要强调："每次必须返回完整的Thought+Action对"
+ 明确要求每轮必须同时包含Thought和Action（或Final Answer）
3. 框架规范
+ ReAct框架说明
+ 两种标准格式定义：
    - 格式1：Thought + Action
    - 格式2：Final Answer
4. 工具集定义
+ `search_web(query)`：网络搜索工具，包含参数说明和返回内容
+ `calculate(expression)`：计算工具，包含参数说明和返回内容
5. 使用规则
+ 6条具体操作规则
+ 强调系统处理机制和用户注意事项
6. 少量样本（Few-Shot）
+ 提供少量示例：在提示词中给出1-2个完整的 ReAct 任务解决示例，让模型学会这种格式。
+ 完整的用户-助手对话示例，展示从问题到最终答案的完整流程，演示工具的正确使用方法



##### 解析模型输出
程序需要能够解析模型的响应，识别出 `Action:` 后面的内容（例如正则/json），然后调用相应的工具。

```python
...
        # 提取思考过程
        thought_pattern = r'Thought:\s*(.*?)(?=\nAction:|\nFinal Answer:|$)'
        thought_match = re.search(thought_pattern, content, re.DOTALL | re.IGNORECASE)
        if thought_match:
            result["thought"] = thought_match.group(1).strip()
        
        # 提取动作
        action_pattern = r'Action:\s*(.*?)(?=\nObservation:|\nThought:|\nFinal Answer:|$)'
        action_match = re.search(action_pattern, content, re.DOTALL | re.IGNORECASE)
        if action_match:
            action_text = action_match.group(1).strip()
            result["action"] = action_text
...
            # 解析动作类型和输入
            if '(' in action_text and ')' in action_text:
                action_parts = action_text.split('(', 1)
                action_name = action_parts[0].strip()
                action_input = action_parts[1].rsplit(')', 1)[0].strip('"\'')
...
        # 提取最终答案
        final_answer_pattern = r'Final Answer:\s*(.*?)(?=\nThought:|\nAction:|$)'
        final_answer_match = re.search(final_answer_pattern, content, re.DOTALL | re.IGNORECASE)
```



##### 将工具返回的结果作为 `Observation` 输入给模型，开启下一轮循环。
```python
# 更新消息历史
messages.append(AIMessage(content=content))
messages.append(HumanMessage(content=f"Observation: {observation}"))
```

##### 循环终止：
当模型输出 `Action: Finish[最终答案]` 时，循环结束。

```python
# 检查是否有最终答案
if step.final_answer:
    logger.info(f"=== 最终答案 ===")
    logger.info(f"答案: {step.final_answer}")
    return step.final_answer
```



**<font style="color:#DF2A3F;">./example/ReAct/theory_react.py</font>**

#### 方法二：使用 Agent 框架实现（实践层面）


使用成熟的框架，例如 LangChain，LangGraph，AutoGen 这会大大简化开发流程。



**<font style="color:#DF2A3F;">./example/ReAct/langchain_react.py</font>**

**<font style="color:#DF2A3F;">./example/ReAct/langgraph_react.py</font>**

**<font style="color:#DF2A3F;">./example/ReAct/autogen_react.py</font>**

