## 核心思想：分而治之


框架模仿人类解决复杂问题的方式，先制定一个高层次的计划，然后一步步地去执行这个计划，并在执行过程中根据需要进行调整。 它旨在解决单一智能体在处理需要多个步骤、多种技能的复杂任务时的局限性。



Plan-and-Execute框架通过角色分离来进行实现：

1. 计划阶段：

+ 角色：由一个“规划器”负责。
+ 任务：AI接收到用户的复杂指令后，规划器并不直接给出最终答案，而是先进行“思考”。
+ 过程：
    - 分解任务：将宏大目标分解成一系列清晰的、可操作的小步骤。
    - 逻辑排序：确定这些步骤之间的依赖关系和先后顺序。
    - 资源分配：思考每个步骤可能需要调用什么工具或知识（例如，计算步骤需要调用计算器，查询天气需要联网搜索）。
+ 产出：一个详细的步骤清单或思维链。

2. 执行阶段：

+ 角色：由一个或多个“执行器”负责。
+ 任务：执行器根据规划器制定的步骤清单，一步一步地完成任务。
+ 过程：
    - 专注行动：执行器不需要思考全局，只需专注于当前步骤。
    - 传递结果：将当前步骤的结果传递给下一步骤，作为输入。
+ 产出：每个步骤的中间结果，并最终汇总成最终答案。





## 框架模式
### 一个规划者 + 多个执行者
这是最经典和常见的模式。



**工作流程（Plan-and-Execute Loop）：**

1. **接收任务:** 智能体接收一个复杂的任务目标。
2. **生成计划:****规划器**利用LLM生成一个完成任务的详细分步计划。
3. **执行步骤:****执行器**按顺序接手计划中的第一个步骤。
4. **调用工具:** 执行器根据当前步骤的需求调用所需的工具。
5. **记录结果:** 执行器记录步骤的执行结果（观测值）。
6. **检查与调整（可选/再规划 Replan）:** 在执行完一个或几个步骤后，系统可以评估结果：
    - 如果一切顺利，继续执行计划的下一个步骤。
    - 如果出现错误、结果不理想或情况发生变化，**规划器**会被再次调用，结合已完成的步骤和观测值，对剩余的计划进行**修改或重新规划**。
7. **完成:** 直到所有步骤完成或规划器确定任务已完成，智能体给出最终答复。



```python
任务：“找出过去一年涨幅最大的科技股，并分析其上涨原因。”

规划者计划：

步骤1：搜索“过去一年涨幅最大的科技股列表”。

步骤2：获取列表中前3只股票的代码。

步骤3：分别搜索这三只股票的“年度财报新闻”和“重大事件”。

步骤4：根据搜集到的信息，总结每只股票的上涨原因。

步骤5：将分析结果整理成一份简洁的报告

执行过程：
  ○ 规划者将步骤1分配给搜索执行者。
  ○ 搜索执行者返回一个股票列表 [‘NVDA’， ‘AVGO’， ...]。
  ○ 规划者将步骤2和步骤3分配给搜索执行者，获取股票详情和新闻。
  ○ 规划者将步骤4和步骤5分配给写作执行者，让它生成最终报告。
```



### 树状结构：递归式分解
这种模式更加强调任务的层次化分解，类似于思维树。

**个人观点**：结构相对复杂，正确性难以保证，可以作为扩展知识去考虑未来是否能被应用。



工作流程：

    1. 一个根智能体接收到顶级任务。
    2. 它将任务分解成几个子任务。
    3. 对于每个子任务，它可能会创建一个新的子智能体来负责。
    4. 每个子智能体可以继续将自己的子任务进一步分解，创建更多的“孙智能体”。
    5. 最终，最底层的智能体执行最简单的任务，并将结果返回给其父智能体。
    6. 父智能体整合所有子任务的结果，逐级向上汇总，直到根智能体得到最终答案。

这种结构非常适合模块化程度非常高、子任务间相对独立的大型项目。



## 关键技术组件与概念


一个完整的Plan-and-Execute框架通常包含以下部分：

+ 规划者：核心大脑，需要强大的推理和分解能力。
+ 执行者：专业化的“四肢”，依赖其工具集。
+ 工具集：执行者可以调用的外部API或函数，如：搜索引擎、计算器、代码解释器、数据库查询等。
+ 工作记忆：一个共享的上下文空间，用于存储计划、已完成的步骤结果、当前状态等信息。这对于保持任务连贯性至关重要。
+ 反思与重规划机制：高级框架会引入“反思”环节。当执行者遇到困难（如工具调用失败、结果不理想）时，规划者会审视当前情况，决定是重试当前步骤、修改计划，还是彻底改变策略





## 优势
1. 处理复杂任务：能够解决单一智能体难以处理的、多步骤的开放式问题。
2. 专业化与效率：执行者各司其职，比一个“通才”智能体在特定任务上更高效、更可靠。
3. 可解释性强：整个计划和执行过程是透明的，用户可以清楚地看到问题是如何被分解和解决的，便于调试和信任。
4. 灵活性高：可以轻松地添加新的执行者和工具来扩展系统的能力。



## 挑战与局限性
1. 延迟较高：多个LLM调用和工具使用的串行过程会导致响应时间变长。
2. 规划错误累积：如果规划者的初始计划有缺陷，后续所有执行都可能是在错误的方向上进行，导致任务失败。
3. 沟通开销：在规划者和执行者之间传递信息和上下文需要消耗大量的Token，成本较高。
4. 对规划者依赖过重：规划者是单点故障，它的能力上限决定了整个系统的能力上限。



## 与 ReAct 的对比  

| 对比点 | ReAct | Plan-and-Execute |
| --- | --- | --- |
| **思维方式** | 每一步边思考边执行（Reason + Act） | 先完整规划，再分步执行 |
| **适用场景** | 即时交互、短任务 | 复杂、长时程、多阶段任务 |
| **输出形式** | Thought / Action / Observation 循环 | Plan / Execute 两阶段 |
| **优势** | 响应灵活，实时反馈 | 规划全局，执行有序 |
| **劣势** | 容易陷入循环或误判 | 初次规划可能不完美，需要修正机制 |






## 实现方式


#### 方法一：通过提示工程+核心组件（原理层面）
1. 设定好提示词
+ 将复杂问题分解为可执行子任务：提示拆解任务
+ 可用工具：提供可用的工具
+ 规则设定：整个很重要，需要迭代优化
+ 输出格式： 约束结构化输出，方便工具解析。（推荐 xml或json）
+ 少量示例（few-short）： 设定示例使得大模型能够按照规范生成

```python
你是任务规划助手，将复杂问题分解为可执行子任务。

## 可用工具
1. search_market_data - 搜索市场数据
2. calculate - 数学计算（必须使用具体数字，如: 100000*0.05）
3. query_user_profile - 查询用户画像
4. analyze_investment - 投资分析

## 重要规则
- calculate工具的参数必须是可直接计算的数学表达式
- 不要使用"投资方案参数"等描述性文字
- 如需计算，必须写出完整表达式，如: 100000*0.05, 50000/550

## 输出格式（严格遵守）
1. [工具名] 任务描述 | 参数
2. [工具名] 任务描述 | 参数 | 依赖: 1

示例：
1. [query_user_profile] 查询用户风险偏好 | user_001
2. [search_market_data] 查询理财收益 | 理财
3. [analyze_investment] 分析配置 | 10万元,稳健 | 依赖: 1,2
4. [calculate] 计算预期年收益 | 100000*0.05 | 依赖: 3

请为用户问题制定计划:
```

2. 解析输出

```python
        # <任务编号>. [<工具名>] <任务描述>|<工具输入>
        for line in lines:
            # 检查行是否以数字和点开始（例如："1."、"2."等）
            if not line.strip() or not re.match(r'^\d+\.', line.strip()):
                continue
            # 如果行是空的或者不匹配这种模式，则跳过该行
            task_match = re.match(r'^(\d+)\.\s*\[(\w+)\]\s*(.*)', line.strip())
            if not task_match:
                continue
            # 任务id
            task_id = int(task_match.group(1))
            # 工具名称
            tool_name = task_match.group(2).strip()
            # 任务描述
            rest_content = task_match.group(3).strip()
            # 将剩余内容按竖线"|"分割成多个部分 "描述|输入参数"
            parts = rest_content.split('|')
```

3. 执行工具

```python
        while len(completed_tasks) < len(plan.tasks):
            progress_made = False
            
            for task in plan.tasks:
                if task.status in [TaskStatus.COMPLETED, TaskStatus.FAILED]:
                    continue
                
                if self._can_execute_task(task, completed_tasks):
                    result = self._execute_task(task, context)
                    context[f"task_{task.id}"] = result
                    
                    if task.status == TaskStatus.COMPLETED:
                        completed_tasks.append(task.id)
                    
                    progress_made = True
            
            if not progress_made:
                logger.warning("无法继续执行")
                break
```



4. 总结输出

```python
    def _synthesize_answer(self, plan: ExecutionPlan) -> str:
        """综合任务结果生成最终答案"""

        context = f"问题: {plan.goal}\n\n结果:\n"

        logger.info(f"综合答案,上下文\n {context}")
        for task in plan.tasks:
            if task.status == TaskStatus.COMPLETED:
                context += f"- {task.description}: {task.result}\n"
```

#### 方法二：使用 Agent 框架实现（实践层面）
##### langchain：在experimental（试验包下）
还处于不可用状态，从提示词和源码上看，还不是很完善，甚至后续不一定存在。更多的考虑通过图的方式更符合真实场景。

+ planner

```python
SYSTEM_PROMPT = (
    "Let's first understand the problem and devise a plan to solve the problem."
    " Please output the plan starting with the header 'Plan:' "
    "and then followed by a numbered list of steps. "
    "Please make the plan the minimum number of steps required "
    "to accurately complete the task. If the task is a question, "
    "the final step should almost always be 'Given the above steps taken, "
    "please respond to the users original question'. "
    "At the end of your plan, say '<END_OF_PLAN>'"
)

"""

首先让我们理解问题并制定一个解决问题的计划。
请以“计划：”为标题输出该计划，
然后附上一个按编号排列的步骤列表。
请将计划制定为完成任务所需的最少步骤，
如果任务是一个问题，那么最后一步几乎总是“根据上述所采取的步骤，请回答用户最初的问题”。
在您的计划末尾，请写上“<END_OF_PLAN>”

"""
```

```python
class PlanningOutputParser(PlanOutputParser):
    """Planning output parser."""

    def parse(self, text: str) -> Plan:
        steps = [Step(value=v) for v in re.split("\n\s*\d+\. ", text)[1:]]
        return Plan(steps=steps)
```



+ execute

```python
HUMAN_MESSAGE_TEMPLATE = """Previous steps: {previous_steps}

Current objective: {current_step}

{agent_scratchpad}"""

TASK_PREFIX = """{objective}

"""
```

```python
    input_variables = ["previous_steps", "current_step", "agent_scratchpad"]
    template = HUMAN_MESSAGE_TEMPLATE

    if include_task_in_prompt:
        input_variables.append("objective")
        template = TASK_PREFIX + template

    agent = StructuredChatAgent.from_llm_and_tools(
        llm,
        tools,
        human_message_template=template,
        input_variables=input_variables,
    )
    agent_executor = AgentExecutor.from_agent_and_tools(
        agent=agent, tools=tools, verbose=verbose
    )
```

#### langgraph
更多是通过图的方式，提前规划好应用本身会执行的路径

使用 LangGraph 构建工作流 

`planner` 节点:生成初始计划

`agent` 节点:执行当前步骤

`replan` 节点:评估进度并决定下一步

条件边:根据是否完成任务决定继续执行或结束

执行流程为:START → planner → agent → replan → (agent 或 END) 



## 总结
Plan-and-Execute 是一种强大且直观的多智能体框架，它通过“思考与行动分离”以及“分而治之”的策略，极大地扩展了大语言模型处理复杂现实世界任务的能力。尽管存在延迟和成本等挑战，但它仍然是目前构建高级AI应用中最有前景的架构模式之一，是通向更自主人工智能系统的重要一步。

