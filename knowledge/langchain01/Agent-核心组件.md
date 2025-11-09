## 前提

只做核心知识记录，对于一些非常基础的，比如“静态模型”定义，不会阐述，直接实战为准。

## 概述

Agent 将语言模型与工具相结合，创建能够进行任务推理、工具选择和迭代求解的智能系统。LangChain 的核心组件围绕 Agent 能力进行构建和完善。

create_agent使用LangGraph基于图构建。

```python
from langchain.agents import create_agent
```

## 播客

1. **在行走时也不要忘记学习。**
2. **对话方式更加人性化的理解方式**

[播客-模型.mp3](../audio/播客-模型.mp3)

[播客-消息.mp3](../audio/播客-消息.mp3)

[播客-流式输.wav](../audio/播客-流式输.wav)

[播客-Middleware.wav](../audio/播客-Middleware.wav)

[播客-短期记忆.mp3](../audio/播客-短期记忆.mp3)

## 核心组件

### 模型

模型是智能体的推理引擎。它可以通过多种方式进行指定，支持静态和动态模型选择.

#### 静态模型

静态模型在创建代理时配置一次，并在整个执行过程中保持不变。这是最常见、最直接的方法

#### 动态模型

动态模型的选择是在运行时环境基于当前状态以及上下文信息。这使得复杂的路由逻辑和成本优化成为可能。

```python
@wrap_model_call
def dynamic_select_model(request: ModelRequest, handle) -> ModelResponse:
    if request.runtime.context["vip"] == 1:
        print("使用基础模型")
        model = basic_model
    else:
        print("使用高级模型")
        model = advance_model

    request.model = model
    return handle(request)


agent = create_agent(model=basic_model, tools=[], middleware=[dynamic_select_model])
agent.invoke(input={"messages": [{"role": "user", "content": "请计算1+1"}]},
             context={"vip": 1})
# 输出：使用基础模型

agent.invoke(input={"messages": [{"role": "user", "content": "请计算1+1"}]},
             context={"vip": 2})
# 输出：使用高级模型
```

#### 关键方法

+ invoke: 同步调用，只输出最后的结果
+ stream：流式输出，实时输出token

```python
## 消息列表方式输入
messages = [{"role": "system", "content": "你是一个教学机器人，你需要回答用户提出的问题。"},
            {"role": "user", "content": "什么是牛顿力学三大定律?"}]
invoke_response = basic_model.invoke(messages)
# ....
for message in basic_model.stream([SystemMessage(content="你是一个教学机器人，你需要回答用户提出问题。"),
                                   HumanMessage(content="什么是牛顿力学三大定律?")]):
    print(message.content_blocks)
# ...

```

+ batch: 批量调用

```python
messages1 = [{"role": "system", "content": "你是一个教学机器人，你需要回答用户提出的问题。"},
             {"role": "user", "content": "什么是牛顿力学三大定律?"}]
messages2 = [{"role": "system", "content": "你是一个教学机器人，你需要回答用户提出的问题。"},
             {"role": "user", "content": "什么是勾股定律?"}]
batch_response = basic_model.batch([messages1, messages2],
                                   config={'max_concurrency': 2, })
```

#### 常用参数

+ model : 需要使用的模型名称
+ api_key: 模型提供商密钥
+ temperature:控制模型输出的随机性。更高的数值使响应更具创造性；较低的数值使它们更具确定性。
+ timeout: 调用模型超时时间
+ max_tokens: 现在相应token数量,控制输出的长度
+ max_retries: 最大重试次数
+ top_p： 指定在每一步考虑的令牌总概率质量，与temperature类似但控制方式不同。
+ reasoning_effort：限制推理模型在推理上的努力程度。支持'minimal'、'low'、'medium'和'high'值
+ verbosity：控制推理模型响应的详细程度，支持'low'、'medium'和'high'值。

```python
basic_model = ChatOpenAI(base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                         model="qwen-plus",
                         api_key=os.getenv("DASHSCOPE_API_KEY"),
                         temperature=1.0,
                         timeout=60,
                         max_tokens=1024,
                         max_retries=2)
```

#### 工具调用

```python
@tool
def get_weather(location: str) -> str:
    """Get the weather at a location."""
    return f"It's sunny in {location}."


@tool
def get_time() -> str:
    """获取当前时间"""
    from datetime import datetime
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
```

```python
tool_model = basic_model.bind_tools([get_weather])

response = tool_model.invoke("请告诉我北京天气和当前时间")
```

```python
call_message = response.tool_calls[0]
tool_result = get_weather.invoke(call_message)
```

```python
# 强制使用所有工具
choice_tool_model = basic_model.bind_tools([get_weather], tool_choice='any')
# 强制使用指定工具
choice_tool_model = basic_model.bind_tools([get_weather], tool_choice='get_weather')
```

```python
batch_tool_model = basic_model.bind_tools([get_weather, get_time])
batch_result = batch_tool_model.invoke("请告诉我北京天气和当前时间")
```

#### 结构化输出

+ Pydantic: 参数的类型，字段验证
+ TypeDict: 不需要验证参数,底层就是字典
+ JsonSchema: 返回json的描述

下面会以Pydantic为例，因为工具的调用,对参数类型，格式都有要求。

无法调用成功可以快速失败

```python

class City(BaseModel):
    name: str = Field(..., description="城市名称")
    position: str = Field(..., description="方位")
    population: int = Field(..., description="人口")


model_with_structure = basic_model.with_structured_output(City, include_raw=True, method="function_calling")
r = model_with_structure.invoke("请给我介绍下中国上海")
print(r['parsed'])
```

结构化输出是非常重要的，因为在节点与节点之间，Agent与Agent之前指定固定格式的交互，能够使应用更稳定的运行。（类比于API
doc中入参和出参）

但是不是所有模型都能支持结构化输出，如果无法使用结构化输出时，指定模型使用json或者xml返回。系统自己来转化是有必要的。

### 工具

工具赋予智能体执行操作的能力。智能体超越了简单的仅模型工具绑定，还能实现以下功能：

+ 连续调用多个工具（由单个提示触发）
+ 在适当的时候并行调用工具
+ 基于先前结果的动态工具选择
+ 工具重试逻辑和错误处理
+ 跨工具调用保持状态持久性

#### 创建自定义工具

```python
class WeatherInput(BaseModel):
    """Input for weather queries."""
    location: str = Field(description="City name or coordinates")
    units: Literal["celsius", "fahrenheit"] = Field(
        default="北京",
        description="Temperature unit preference"
    )
    include_forecast: bool = Field(
        default=False,
        description="Include 5-day forecast"
    )


@tool(name_or_callable="weather_search", description="查询天气", args_schema=WeatherInput)
def weather_search(location: str, units: str = "celsius", include_forecast: bool = False):
    """Get current weather and optional forecast."""
    temp = 22 if units == "celsius" else 72
    result = f"Current weather in {location}: {temp} degrees {units[0].upper()}"
    if include_forecast:
        result += "\nNext 5 days: Sunny"
    return result

```

+ name_or_callable: 定义工具的名称
+ description：工具的详细描述
+ args_schema：工具的参数结构，可以使用Pydantic定义的Class，进行参数上的强制要求

#### 访问上下文信息

工具可以通过该参数访问运行时信息`ToolRuntime`，只需要在工具定义的时候带上该参数。 可以存储以下信息：

+ State——在执行过程中流动的可变数据（消息、步数计算、自定义字段）
+ Context- 不可变配置，例如用户 ID、会话详细信息或应用程序特定配置
+ Store- 跨对话的持久长期记忆
+ Stream Writer- 工具执行时流式自定义更新
+ Config- 用于执行的 RunnableConfig
+ Tool Call ID - 当前工具调用的 ID

如果看过langgraph应该比较容易理解，这些参数都在Graph Api中被使用到。

用一个示例来获取 State ConText Store Config TooCallId

写入更新日志 Stream Writer

```python
@dataclass
class UserContext:
    user_id: str


@tool(name_or_callable="weather_search", description="查询天气")
def weather_search(runtime: ToolRuntime, location: str = "北京", units: str = "celsius", include_forecast: bool = False,
                   ):
    """Get current weather and optional forecast."""
    # 1. 获取到State的messages和Steps数据
    messages = runtime.state['messages']
    print(f"messages: {messages} ")

    # 2. 获取Context信息
    user_context = runtime.context.user_id
    print(f"user_id: {user_context}")

    # 3. tool_call_id
    tool_call_id = runtime.tool_call_id
    print(f"tool_call_id: {tool_call_id}")

    # 4. RuntimeConfig
    runtime_config = runtime.config['metadata']
    print(f"runtime_config: {runtime_config}")

    # 5. StreamWriter
    stream_writer = runtime.stream_writer
    stream_writer(f"运行到 weather_search 节点 了")

    # 6 Store
    store = runtime.store
    print(f"user_info: {store.store}")

    temp = 22 if units == "celsius" else 72
    result = f"Current weather in {location}: {temp} degrees {units[0].upper()}"
    if include_forecast:
        result += "\nNext 5 days: Sunny"
    return result


store = InMemoryStore()
store.mset([('users', {"user_id": "1", "name": "张三"})])
agent = create_agent(
    model=basic_model,
    tools=[weather_search],
    context_schema=UserContext,
    store=store
)
```

明白在工具中如何使用上下文，可以让我们能更简单的处理一些逻辑。比如token计算，状态更新等等

### 消息

在 LangChain 中，消息是模型的基本上下文单元。它们代表模型的输入和输出，携带与 LLM 交互时对话所需的内容和元数据。消息是包含以下内容的对象：

+ Role(角色)： 标识消息类型（例如System message ，Human message , AI message , Tool Message）
+ Content(内容)：指消息的实际内容（例如文本、图像、音频、文档等）。
+ Metadata(元数据)：可选字段，例如响应信息、消息 ID 和令牌使用情况

#### 消息分类

```python
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
ai_message_dict = {"role": "assistant", "content": [],
                   "tool_calls": [{"name": "get_weather", "args": {"location": "北京"}, "id": "call_123"}]}
tool_message_dict = {"role": "tool", "content": "北京今天晴，23度", "tool_call_id": "call_123"}
history_messages_dict = [system_message_dict, user_message_dict, ai_message_dict, tool_message_dict]
```

#### 标准内容块

LangChain v1 中引入了内容块作为消息的新属性，旨在统一不同提供商之间的内容格式，同时保持与现有代码的向后兼容性。内容块并非替代现有属性content，而是一个可用于以标准化格式访问消息内容的新属性。

+ 输出，使用deepseek-r1 深度思考的结果，输出内容块

```json
{
  "type": "reasoning",
  "reasoning": "The user is asking about...",
  "extras": {
    "signature": "abc123"
  }
}
```

```python
basic_model = ChatDeepSeek(
    model="deepseek-reasoner",
    api_key=os.getenv("DEEPSEEK_API_KEY"),
)

response = basic_model.invoke("深度思考下，如何才能实现AIGC？")

print(response)

print("==" * 20)

print(response.content_blocks)
## 输出结果
[
    {
        "type": "reasoning",
        "reasoning": "好的，用户问的是“深度思考下，如何才能实现AIGC？”这个问题看起来挺大的，得先拆解一下。首先，用户可能对AIGC有一定基础了解，但想要更深入的实现原理，而不仅仅是表面应用。\n\n嗯，用户可能是开发者、学生，或者对技术有浓厚兴趣的人。他们可能想自己动手构建AIGC系统，或者理解背后的机制以便更好地应用。深层需求可能是想掌握核心技术，避免只是调用API，而是能参与研发或优化模型。\n\n接下来得考虑回答的结构。不能只讲技术堆砌，得从宏观到微观，分层次说明。比如先分阶段，再讲核心支柱，最后到具体模块。这样用户能逐步深入，不会一下子被吓到。\n\n然后，用户可能没明说但需要知道的关键点包括：算力需求、数据的重要性、模型架构的选择，以及迭代流程。比如提到Transformer和扩散模型，得解释为什么它们成为主流，而不仅仅是列举名字。\n\n还要注意避免过于学术化，用例子帮助理解。比如用ChatGPT和Midjourney作为案例，让抽象概念更具体。同时强调实践中的挑战，比如数据清洗、算力成本，这样用户能有现实预期。\n\n最后，得总结实现AIGC不仅是技术问题，更是系统工程，需要多领域合作。这样用户能意识到背后的复杂性，同时被鼓励参与其中。"
    },
    {
        "type": "text",
        "text": "这是一个非常棒的问题，直指当今科技浪潮的核心。实现AIGC（人工智能生成内容）是一个宏大而复杂的系统工程，远不止是“用一个模型”那么简单。它需要从底层理论到上层应用的深度思考和协同工作。\n\n我们可以从 **“道、法、术、器”** 四个层面来深度拆解如何实现AIGC。\n\n---\n\n### **第一层：道 - 核心理念与理论基础**\n\n这是AIGC的灵魂，决定了它“为什么”能生成内容。\n\n1.  **核心思想：学习概率分布**\n    *   所有AIGC模型的根本目标，都是学习现实世界数据（无论是文本、图像、音频还是代码）背后隐藏的、复杂的**概率分布**。\n    *   **简单理解**：给模型看一百万张猫的图片，它不是在记忆每一只猫，而是在学习“猫”这个概念的构成规律——比如，有胡须、尖耳朵、毛茸茸的身体等特征出现的概率。当它学好了这个“猫的概率分布”，你就可以让它从这个分布中“采样”，生成一张全新的、符合“猫”的概率规律的图片。\n\n2.  **关键理论基础：**\n    *   **深度学习**：特别是深度神经网络，作为万能函数逼近器，能够拟合极其复杂的非线性关系（也就是上面说的复杂概率分布）。\n    *   **表示学习**：模型能将数据（如一个单词、一张图片的像素）转化为有意义的**向量**。这个向量可以看作是数据在“概念空间”中的坐标。AIGC生成的过程，就是在概念空间中从一个点“漫步”到另一个点的过程。\n    *   **信息论**：尤其是**压缩**的观点。有人认为，学习数据的概率分布本质上是找到一种极致的压缩方式。AIGC模型就像一个“智能压缩算法”，它学会了数据的本质规律，从而可以从压缩后的“规律”中解压出新的、符合规律的内容。\n\n---\n\n### **第二层：法 - 核心模型架构与算法**\n\n这是AIGC的骨架和肌肉，是实现“道”的具体方法。\n\n1.  **Transformer架构（文本/多模态的基石）**\n    *   **核心机制**：**自注意力机制**。它允许模型在处理一个元素（如一个单词）时，权衡所有其他元素的重要性。这使它能够理解长距离的依赖关系和上下文，非常适合处理序列数据（如自然语言）。\n    *   **代表模型**：GPT系列、BERT、T5等。它们构成了当今大语言模型的基础。\n\n2.  **扩散模型（图像/音频生成的王者）**\n    *   **核心思想**：一个“先破坏，后学习修复”的过程。\n        *   **前向过程**：逐步向一张清晰图片添加噪声，直到它变成完全的无意义噪声。\n        *   **反向过程**：训练一个神经网络，学习如何从纯噪声中，一步步地“去噪”，最终恢复出一张清晰的图片。生成时，就从随机噪声开始，让模型执行这个“去噪”过程。\n    *   **优势**：生成的图像质量高、多样性好。代表模型：Stable Diffusion、DALL-E 2/3。\n\n3.  **生成对抗网络（曾经的图像生成主力）**\n    *   **核心思想**：一个“**伪造者**”和一个“**鉴别者**”的博弈。\n        *   **生成器**：负责生成假数据，目标是骗过鉴别器。\n        *   **鉴别器**：负责区分真实数据和生成器产生的假数据。\n    *   两者在动态博弈中共同进化，最终生成器能产生足以乱真的数据。\n\n4.  **自回归模型**\n    *   **核心思想**：一次生成一个元素（如一个词、一个像素），并且每个新元素的生成都依赖于之前已经生成的所有元素。\n    *   **例子**：GPT生成文本就是典型自回归——根据“今天天气很”来预测下一个词“好”。\n\n**现代AIGC系统通常是这些方法的融合**。例如，Stable Diffusion结合了**扩散模型**的图像生成能力和**Transformer**对文本指令的理解能力。\n\n---\n\n### **第三层：术 - 实现流程与工程实践**\n\n这是将“法”落地的具体技术和流程。\n\n1.  **数据工程 - 燃料制备**\n    *   **海量数据收集**：从互联网、书籍、代码库等渠道获取万亿级别的文本、图像-文本对、音频等数据。\n    *   **数据清洗与预处理**：去除噪声、偏见、有害内容。这是决定模型“品德”和“智商”的关键一步。\n    *   **数据标注**：对于需要监督学习的任务，进行高质量标注。\n\n2.  **模型训练 - 锻造大脑**\n    *   **预训练**：在海量无标注数据上进行“自监督学习”，让模型学会通用的知识和表示。这是最耗费算力的阶段，需要成千上万的GPU数月之久。目标是得到一个“博学但未经调教”的基座模型。\n    *   **指令微调**：使用高质量的指令-回答对数据，教会模型如何理解并遵循人类的指令。这让模型从“知道”变成“会用”。\n    *   **对齐训练（如RLHF/RLAF）**：使用强化学习技术，根据人类的偏好来进一步优化模型，使其输出更**有用、诚实、无害**。这是让AI变得“友善”和“听话”的关键步骤。\n\n3.  **推理与部署 - 大脑上线**\n    *   **优化与压缩**：将训练好的庞大模型进行剪枝、量化、蒸馏，使其能在消费级硬件上高效运行。\n    *   **推理引擎**：开发高效的推理框架，如vLLM、TensorRT等，以最低的延迟和成本处理用户请求。\n    *   **提示工程**：设计与模型交互的最佳方式，通过精心构造的提示词来激发模型的最佳性能。\n\n---\n\n### **第四层：器 - 基础设施与工具链**\n\n这是支撑以上所有层面的底层基础。\n\n1.  **算力**：海量的**GPU/NPU集群**（如NVIDIA H100, A100）。没有强大的算力，一切都是空谈。\n2.  **软件框架**：**PyTorch、TensorFlow、JAX** 等深度学习框架，是研究人员和工程师构建模型的“工具箱”。\n3.  **分布式训练库**：如DeepSpeed, FairScale等，用于将训练任务高效地分布到成千上万个GPU上。\n4.  **云计算平台**：AWS, GCP, Azure等提供了弹性的算力和成熟的机器学习管线服务。\n\n### **总结：一个完整的AIGC实现视角**\n\n要实现一个像ChatGPT或Midjourney这样的AIGC系统，你需要：\n\n1.  **明确目标**：你要生成什么？文本、图像、代码？\n2.  **构建数据飞轮**：找到并清洗海量、高质量的数据。\n3.  **选择模型架构**：根据目标选择Transformer、扩散模型或它们的组合。\n4.  **投入巨量算力**：在GPU集群上进行预训练和微调。\n5.  **进行“对齐”**：通过RLHF等技术让模型符合人类价值观。\n6.  **工程化优化**：将模型压缩、加速，并部署到可扩展的服务平台上。\n7.  **构建反馈循环**：从用户使用中持续收集数据，用于模型的迭代和改进。\n\n**因此，实现AIGC不仅仅是算法问题，更是一个涉及理论、算法、数据、算力和工程的超级系统工程。** 它代表了当前人工智能领域最高水平的集成与创新。希望这个深度的思考能帮助你构建起对AIGC实现的整体认知框架。"
    }
]
```

+ 输入,多模态输入举例

```python
# Provider-native format (e.g., OpenAI)
human_message = HumanMessage(content=[
    {"type": "text", "text": "Hello, how are you?"},
    {"type": "image_url", "image_url": {"url": "https://example.com/image.jpg"}}
])

# List of standard content blocks
human_message = HumanMessage(content_blocks=[
    {"type": "text", "text": "Hello, how are you?"},
    {"type": "image", "url": "https://example.com/image.jpg"},
])
```

### 结构化输出

结构化输出允许代理以特定且可预测的格式返回数据。无需解析自然语言响应，即可获得以 JSON 对象、Pydantic
DataClass或TypeDict的结构化数据，当模型生成结构化数据时，以`'structured_response'`代理状态键的形式返回。

**下面示例统一使用Pydantic**

#### ToolStrategy

对于不支持原生结构化输出的模型，LangChain 使用工具消息（Tool Message）来实现相同的结果。这适用于所有支持工具调用的模型，而大多数现代模型都支持工具调用。

```python
agent = create_agent(
    model=basic_model,
    tools=[],
    response_format=ToolStrategy(ContactInfo)
)

result = agent.invoke({
    "messages": [{"role": "user", "content": "Extract contact info from: John Doe, john@example.com, (555) 123-4567"}]
})
for message in result['messages']:
    message.pretty_print()

# 输出
# ================================ Human Message =================================
#
# Extract contact info from: John Doe, john@example.com, (555) 123-4567
# ================================== Ai Message ==================================
# Tool Calls:
#   ContactInfo (call_Le6XWk2EniOjXJyhYf7oH4qj)
#  Call ID: call_Le6XWk2EniOjXJyhYf7oH4qj
#   Args:
#     email: john@example.com
#     name: John Doe
#     phone: (555) 123-4567
# ================================= Tool Message =================================
# Name: ContactInfo
#
# Returning structured response: name='John Doe' email='john@example.com' phone='(555) 123-4567'
```

输出结果中可以看到先返回了Ai Message 再输出了Tool Message。

##### 错误处理

模型在通过工具调用生成结构化输出时可能会出错。LangChain 提供智能重试机制来自动处理这些错误。

错误处理的方式（handle_errors）

+ 自定义错误信息

```python
ToolStrategy(
    schema=ProductRating,
    handle_errors="Please provide a valid rating between 1-5 and include a comment."
)
```

+ 自定义错误类型

如果`handle_errors`指定了异常类型，则代理仅在引发的异常类型为指定类型时才会重试（使用默认错误消息）。在所有其他情况下，都会引发该异常。

```python
ToolStrategy(
    schema=ProductRating,
    handle_errors=(ValueError, TypeError)  # Only retry on ValueError, raise others
)
```

+ 自定义错误处理函数

出现错误时，调用函数，根据函数返回内容来确定后续怎么执行

```python
def custom_error_handler(error: Exception) -> str:
    if isinstance(error, StructuredOutputValidationError):
        return "There was an issue with the format. Try again.
    elif isinstance(error, MultipleStructuredOutputsError):
        return "Multiple structured outputs were returned. Pick the most relevant one."
    else:
        return f"Error: {str(error)}"


ToolStrategy(
    schema=ToolStrategy(Union[ContactInfo, EventDetails]),
    handle_errors=custom_error_handler
)
```

#### ProviderStrategy

使用模型提供商的原生结构化输出生成功能。这种方式更可靠，但仅适用于支持原生结构化输出的提供商（例如 OpenAI）。
但是这应该是各大模型厂商后续到会支持到的。

```python
class ContactInfo(BaseModel):
    """Contact information for a person."""
    name: str = Field(description="The name of the person")
    email: str = Field(description="The email address of the person")
    phone: str = Field(description="The phone number of the person")


basic_model = ChatOpenAI(model="gpt-5", api_key=os.getenv("OPENAI_API_KEY"), base_url=os.getenv("OPEN_AI_URL"))

agent = create_agent(
    model=basic_model,
    tools=[],
    response_format=ContactInfo
)

result = agent.invoke({
    "messages": [{"role": "user", "content": "Extract contact info from: John Doe, john@example.com, (555) 123-4567"}]
})

print(result)
print(result['structured_response'])

# 输出
# ================================ Human Message =================================
# 
# Extract contact info from: John Doe, john@example.com, (555) 123-4567
# ================================== Ai Message ==================================
# 
# {"email":"john@example.com","name":"John Doe","phone":"(555) 123-4567"}
```

与ToolStrategy对比可以看出，模型厂商直接返回了AI Message

### 流式输出

对于基于 LLM 构建的应用程序而言，流式传输对于提升其响应速度至关重要。通过逐步显示输出，即使在完全响应准备就绪之前，将内容传递给用户。

通过 steam 或者 astream 方法来实现（非流式使用 invoke），设置steam_mode可以控制输出不同的内容。

+ steam_mode="update"

每个步骤后完成后发出一个事件（模型节点输出工具调用，工具节点执行完成，输出完整消息内容），可以用来输出当前的进度

```python
for event in agent.stream(
        {"messages": [{"role": "user", "content": "北京的天气如何？"}]},
        stream_mode="updates",
):
    for step, data in event.items():
        print(f"step: {step}")
        print(f"content: {data['messages'][-1].content_blocks}")

# step: model
# content: [{'type': 'tool_call', 'name': 'get_weather', 'args': {'location': '北京'}, 'id': 'call_8c08255c0a724b46bc52d3da'}]
# step: tools
# content: [{'type': 'text', 'text': '{"messages": [{"role": "assistant", "content": "It\'s sunny in 北京."}]}'}]
# step: model
# content: [{'type': 'text', 'text': '北京的天气是晴天。'}]
```

+ steam_model="messages"

逐个输出Token，可以结合SSE，改善用户交互。

```python
for token, metadata in agent.stream(
        {"messages": [{"role": "user", "content": "北京的天气如何？"}]},
        stream_mode="messages",
):
    print(f"node: {metadata['langgraph_node']}")
    print(f"content: {token.content_blocks}")
    print("\n")

# 部分输出的结果
# node: model
# content: [{'type': 'text', 'text': '北京'}]


# node: model
# content: [{'type': 'text', 'text': '的天气是'}]


# node: model
# content: [{'type': 'text', 'text': '晴天'}]


# node: model
# content: [{'type': 'text', 'text': '。'}]

```

+ 自定流式输出

在运行工具过程中输出一些反馈或者日志内容。使用 get_stream_writer 来进行写入输出

```python

@tool
def get_weather(location: str) -> str:
    """Get the weather at a location."""
    writer = get_stream_writer()
    writer(f"正在查询{location}天气。。。。")
    writer(f"查询结果：晴天.")
    return {"messages": [{"role": "assistant", "content": f"It's sunny in {location}."}]}


for event in agent.stream(
        {"messages": [{"role": "user", "content": "北京的天气如何？"}]},
        stream_mode="custom",
):
    print(event)
# 输出
# 正在查询北京天气。。。。
# 查询结果：晴天.
```

具有更高的灵活性，用户可以定制化输出工具调用信息。

+ 组合使用： custom + updates

```python
for steam_model, event in agent.stream(
        {"messages": [{"role": "user", "content": "北京的天气如何？"}]},
        # stream_mode="custom",
        stream_mode=["custom", "updates"],
):
    print(f"stream_mode: {steam_model}")
    print(f"content: {event}")

# 输出结果
# stream_mode: updates
# content: {'model': {'messages': [AIMessage(content='', additional_kwargs={'refusal': None}, response_metadata={'token_usage': {'completion_tokens': 21, 'prompt_tokens': 258, 'total_tokens': 279, 'completion_tokens_details': None, 'prompt_tokens_details': {'audio_tokens': None, 'cached_tokens': 0}}, 'model_provider': 'openai', 'model_name': 'qwen3-max', 'system_fingerprint': None, 'id': 'chatcmpl-3430001c-73a4-4638-a732-b69651ad576c', 'finish_reason': 'tool_calls', 'logprobs': None}, id='lc_run--c4663e41-884f-4378-9205-fc9e81f5f256-0', tool_calls=[{'name': 'get_weather', 'args': {'location': '北京'}, 'id': 'call_e01695d8ab0d455d876372ee', 'type': 'tool_call'}], usage_metadata={'input_tokens': 258, 'output_tokens': 21, 'total_tokens': 279, 'input_token_details': {'cache_read': 0}, 'output_token_details': {}})]}}
# stream_mode: custom
# content: 正在查询北京天气。。。。
# stream_mode: custom
# content: 查询结果：晴天.
# stream_mode: updates
# content: {'tools': {'messages': [ToolMessage(content='{"messages": [{"role": "assistant", "content": "It\'s sunny in 北京."}]}', name='get_weather', id='e8f5f8a0-038b-438c-99d7-b1ff7bd2968e', tool_call_id='call_e01695d8ab0d455d876372ee')]}}
# stream_mode: updates
# content: {'model': {'messages': [AIMessage(content='北京的天气晴朗。', additional_kwargs={'refusal': None}, response_metadata={'token_usage': {'completion_tokens': 6, 'prompt_tokens': 316, 'total_tokens': 322, 'completion_tokens_details': None, 'prompt_tokens_details': {'audio_tokens': None, 'cached_tokens': 192}}, 'model_provider': 'openai', 'model_name': 'qwen3-max', 'system_fingerprint': None, 'id': 'chatcmpl-64f3f5cb-c246-4c13-bc17-647cdb90adcf', 'finish_reason': 'stop', 'logprobs': None}, id='lc_run--000a0ba6-cf4d-4446-ba5b-e82ccfc16929-0', usage_metadata={'input_tokens': 316, 'output_tokens': 6, 'total_tokens': 322, 'input_token_details': {'cache_read': 192}, 'output_token_details': {}})]}}
```

### 中间件（1.0 最大更新）

中间件提供了强大的扩展性，可用于在执行的不同阶段自定义代理行为。

+ 在调用模型之前处理状态（例如，消息修剪、上下文注入）
+ 修改或验证模型的响应（例如，防护措施、内容过滤）
+ 使用自定义逻辑处理工具执行错误
+ 基于状态或上下文实现动态模型选择
+ 添加自定义日志记录、监控或分析功能
+ 其他自定义个性化操作。。。。。。

中间件可以无缝集成到代理的执行图中，使您能够在关键点拦截和修改数据流，而无需更改核心代理逻辑。

![](../image/10.png)

#### 内置中间件

##### 历史消息摘要 - SummarizationMiddleware

自动汇总对话历史记录，详细使用方式在**短期记忆**的历史消息管理中查看

##### 上下文编辑 - ContextEditingMiddleware

当达到token上限时，清理上下文。 比如：

+ 需要定期清理上下文的长篇对话
+ 从上下文中移除失败的工具尝试
+ 自定义上下文管理策略

```python
agent = create_agent(
    base_model,
    tools=[get_weather],
    middleware=[ContextEditingMiddleware(edits=[ClearToolUsesEdit()], token_count_method="approximate"),
                ],
    checkpointer=InMemorySaver()
)
```

参数：

+ edits：要应用的编辑策略序列。默认情况下采用单一的“ClearToolUsesEdit”
+ token_count_method:  Literal["approximate", "model"]
  是否采用近似计数方式（速度较快，但准确性较低），还是采用由聊天模型实现
  的精确计数方式（可能速度较慢，但准确性更高）推荐使用：approximate，人为给token留一定的缓冲。比如：
  90% 95% 就开始清理

##### 人机交互 - HumanInTheLoopMiddleware

在工具调用执行之前，暂停代理执行，以便人工审批、编辑或拒绝工具调用。

当多个工具调用同时暂停时，每个操作都需要单独做出决策。决策必须按照中断请求中操作出现的顺序提供。

```python
checkpointer = InMemorySaver()
agent = create_agent(
    model=base_model,
    checkpointer=checkpointer,
    tools=[get_weather, get_time],
    middleware=[
        HumanInTheLoopMiddleware(
            interrupt_on={
                # 天气工具需要审批
                "get_weather": {"allowed_decisions": ["approve", "edit", "reject"]},
                # 查询时间自动同意
                "get_time": False,
            },
            description_prefix="输入选择 approve edit reject"
        )
    ],
)

config: RunnableConfig = {"configurable": {"thread_id": "1"}}
r = agent.invoke({"messages": [{"role": "user", "content": "查询北京的今天的日期和天气？"}]}, config=config)

r = agent.invoke(Command(resume={"decisions": [{"type": "approve"}]}), config=config)
for message in r['messages']:
    message.pretty_print()

# ================================ Human Message =================================

# 查询北京的今天的日期和天气？
# ================================== Ai Message ==================================
# Tool Calls:
#   get_time (call_027760da26e84880a401a10d)
#  Call ID: call_027760da26e84880a401a10d
#   Args:
#   get_weather (call_2ff80a09b345401896917ed2)
#  Call ID: call_2ff80a09b345401896917ed2
#   Args:
#     location: 北京
# interrupt: [Interrupt(value={'action_requests': [{'name': 'get_weather', 'args': {'location': '北京'}, 'description': "Tool execution requires approval\n\nTool: get_weather\nArgs: {'location': '北京'}"}], 'review_configs': [{'action_name': 'get_weather', 'allowed_decisions': ['approve', 'edit', 'reject']}]}, id='7f93443cf29040408be31e6b22b3cbcb')]
# ====================
# 恢复运行
# ================================= Tool Message =================================
# Name: get_time

# 2025-11-08 17:14:53
# ================================= Tool Message =================================
# Name: get_weather

# {"messages": [{"role": "assistant", "content": "It's sunny in 北京."}]}
# ================================== Ai Message ==================================

# 今天是2025年11月8日，北京的天气晴朗。
```

```python
== == == == == == == == == == == == == == == == = Tool
Message == == == == == == == == == == == == == == == == =
Name: get_weather

User
rejected
the
tool
call
for `get_weather` with id call_5a49a3e01f5a4db4ac083577

== == == == == == == == == == == == == == == == = Tool
Message == == == == == == == == == == == == == == == == =
Name: get_time

2025 - 11 - 0
8
17: 27:11
== == == == == == == == == == == == == == == == == Ai
Message == == == == == == == == == == == == == == == == ==

今天是2025年11月8日。关于北京的天气，您似乎取消了查询，如果需要，请告诉我，我可以再次帮您查询！

```

```python
r = agent.invoke(Command(resume={"decisions": [
    {"type": "edit",
     "edited_action": {
         "name": "fallback_weather",
         "args": {"location": "北京"},
     }
     }
]
}), config=config)

# 输出
# interrupt: [Interrupt(value={'action_requests': [{'name': 'get_weather', 'args': {'location': '北京'}, 'description': "输入选择 approve edit reject\n\nTool: get_weather\nArgs: {'location': '北京'}"}], 'review_configs': [{'action_name': 'get_weather', 'allowed_decisions': ['approve', 'edit', 'reject']}]}, id='4808cef8f33b97ba6bf5e8b2eb0ebaf6')]
# ====================
# 恢复运行1
# ================================ Human Message =================================

# 查询北京的今天的日期和天气？
# ================================== Ai Message ==================================
# Tool Calls:
#   get_time (call_34051763479240c1bf1d605e)
#  Call ID: call_34051763479240c1bf1d605e
#   Args:
#   fallback_weather (call_5da8e4841d404414ace67215)
#  Call ID: call_5da8e4841d404414ace67215
#   Args:
#     location: 北京
# ================================= Tool Message =================================
# Name: get_time

# 2025-11-08 17:47:23
# ================================= Tool Message =================================
# Name: fallback_weather

# {"messages": [{"role": "assistant", "content": "It's sunny in 北京."}]}
# ================================== Ai Message ==================================

# 今天是2025年11月8日，北京的天气是晴天。
```

+ 必须使用：checkpointer，thread_id。需要加入检查点和运行的线程ID，因为恢复肯定需要在同一个线程
+ interrupt_on: dict[str, bool | InterruptOnConfig]：工具名称与允许操作的映射关系。True:
  无论输入什么都会被允许；False：自动允许，无需审批；InterruptOnConfig： 包含参数 allowed_decisions 和
  description。allowed_decisions 为：审批允许输入的参数。
+ description_prefix：请求时所使用的前缀。
+ Command(resume={"decisions": [{"type": "approve"}]}) ： 填写恢复的值

**生命周期**

使用中间件的 `after_model`钩子，该钩子在模型生成响应之后、任何工具调用执行之前运行：

1. 代理调用模型生成响应。
2. 中间件会检查响应中是否存在工具调用。

如果任何调用需要人工输入，中间件会构建一个`HITLRequest`带有`action_requests`和`review_configs`并调用interrupt。

3. 智能体等待人类做出决定。
4. 根据这些`HITLResponse`决定，中间件执行批准或编辑的调用，或生成拒绝调用的ToolMessage ，然后恢复执行。

##### <font style="color:rgb(31, 35, 40);">模型调用限制 - ModelCallLimitMiddleware</font>

模型调用限制在智能体中是必须加入的，避免系统异常导致无限制的去调用模型。

```python
agent = create_agent(
    base_model,
    tools=[get_weather],
    middleware=[ModelCallLimitMiddleware(
        thread_limit=3,
        run_limit=2,
        exit_behavior="end"
    )],
    checkpointer=InMemorySaver(),
    system_prompt="你是一个天气专家,请回答用户提出关于天气的问题。"
)

# 返回结果： ai 总共回复了3次，后续一直就处于线程上限了
# [
#   ('human',
#    '北京天气怎么样?'),
#   ('ai',
#    ''),
#   ('tool',
#    '{"messages": [{"role": "tool", "content": "北京 现在的天气是晴天。"}]}'),
#   ('ai',
#    '北京现在的天气是晴天。'),
#   ('human',
#    '那杭州呢？'),
#   ('ai',
#    ''),
#   ('tool',
#    '{"messages": [{"role": "tool", "content": "杭州 现在的天气是晴天。"}]}'),
#   ('ai',
#    'Model call limits exceeded: thread limit (3/3)'),
#   ('human',
#    '那上海呢？'),
#   ('ai',
#    'Model call limits exceeded: thread limit (3/3)'),
#   ('human',
#    '那广州呢？'),
#   ('ai',
#    'Model call limits exceeded: thread limit (3/3)'),
#   ('human',
#    '那深圳呢？'),
#   ('ai',
#    'Model call limits exceeded: thread limit (3/3)'),
#   ('human',
#    '那西安呢？'),
#   ('ai',
#    'Model call limits exceeded: thread limit (3/3)'),
#   ('human',
#    '那武汉呢？'),
#   ('ai',
#    'Model call limits exceeded: thread limit (3/3)'),
#   ('human',
#    '那成都呢？'),
#   ('ai',
#    'Model call limits exceeded: thread limit (3/3)')]

```

+ thread_limit: 每个线程允许的最大模型调用次数。
+ run_limit: <font style="color:rgb(63, 65, 65);">每次运行允许的最大模型调用次数</font>
+ exit_behavior: 当超出限制时应采取的操作。 "end"跳转到代理执行的末尾，并注入一条人工 AI 消息，表明已超出限制。抛出
  `ModelCallLimitExceededError` 异常。

** 注意： thread_limit和run_limit主要的区别是 run_limit不会被checkPointer记录，只在单次运行记录，每次运行都会重置。
thread_limit会在同一会话窗口中持续计数。**

##### 工具调用限制 - <font style="color:rgb(31, 35, 40);">ToolCallLimitMiddleware</font>

工具调用限制在一些外部接口，特别是需要收费的接口，必须加入，避免系统无法限制的调用。

```python
agent = create_agent(
    base_model,
    tools=[get_weather],
    middleware=[ToolCallLimitMiddleware(
        tool_name="get_weather",
        thread_limit=10,
        run_limit=5,
        exit_behavior="end"
    )],
    checkpointer=InMemorySaver(),
    system_prompt="你是一个天气专家,请回答用户提出关于天气的问题。"
)
# 输出，可以看到tool message 总共回复了3次
# [
#   ('human',
#    '北京天气怎么样?'),
#   ('ai',
#    ''),
#   ('tool',
#    '{"messages": [{"role": "tool", "content": "北京 现在的天气是晴天。"}]}'),
#   ('ai',
#    '北京现在的天气是晴天。'),
#   ('human',
#    '那杭州呢？'),
#   ('ai',
#    ''),
#   ('tool',
#    '{"messages": [{"role": "tool", "content": "杭州 现在的天气是晴天。"}]}'),
#   ('ai',
#    '杭州现在的天气是晴天。'),
#   ('human',
#    '那上海呢？'),
#   ('ai',
#    ''),
#   ('tool',
#    '{"messages": [{"role": "tool", "content": "上海 现在的天气是晴天。"}]}'),
#   ('ai',
#    "'get_weather' tool call limits exceeded: thread limit (3/3)"),
#   ('human',
#    '那广州呢？'),
#   ('ai',
#    "'get_weather' tool call limits exceeded: thread limit (3/3)"),
#   ('human',
#    '那深圳呢？'),
#   ('ai',
#    "'get_weather' tool call limits exceeded: thread limit (3/3)"),
#   ('human',
#    '那西安呢？'),
#   ('ai',
#    "'get_weather' tool call limits exceeded: thread limit (3/3)"),
#   ('human',
#    '那武汉呢？'),
#   ('ai',
#    "'get_weather' tool call limits exceeded: thread limit (3/3)"),
#   ('human',
#    '那成都呢？'),
#   ('ai',
#    "'get_weather' tool call limits exceeded: thread limit (3/3)")]

```

+ tool_name : 要限制的工具名称，不填默认所有的工具
+ thread_limit: 同<font style="color:rgb(31, 35, 40);">ModelCallLimitMiddleware</font>
+ <font style="color:rgb(31, 35, 40);">run_limit： 同ModelCallLimitMiddleware</font>
+ <font style="color:rgb(31, 35, 40);">exit_behavior：</font> continue：
  若出现超出工具调用限制的情况，则会显示错误信息并阻止其他工具及模型继续运行。而模型会根据错误信息来决定何时停止。
  end，error <font style="color:rgb(31, 35, 40);">同ModelCallLimitMiddleware</font>

##### <font style="color:rgb(31, 35, 40);">备用模型 - ModelFallbackMiddleware</font>

<font style="color:rgb(63, 65, 65);">当主模型失效时，自动回退到备用模型。</font>

```python
agent = create_agent(
    base_model,
    middleware=[ModelFallbackMiddleware(openai_model, deepseek_model)],
    checkpointer=InMemorySaver()
)
```

##### 敏感数据检测 - <font style="color:rgb(31, 35, 40);">PIIMiddleware </font>

在与代理交互的过程中，避免发送用户敏感数据，或者输出隐私数据，加入 <font style="color:rgb(31, 35, 40);">PIIMiddleware
用户隐私数据的过滤。</font>

```python

# 定义敏感词列表
sensitive_patterns = [
    r'"[^"]*pwd[^"]*"\s*:\s*"[^"]*"',
    r'"[^"]*password[^"]*"\s*:\s*"[^"]*"',
    r'"[^"]*mnemonic[^"]*"\s*:\s*"[^"]*"',
    r'"[^"]*token[^"]*"\s*:\s*"[^"]*"',
    r'"[^"]*secret[^"]*"\s*:\s*"[^"]*"',
    r'"[^"]*apiSecret[^"]*"\s*:\s*"[^"]*"',
    r'"[^"]*key[^"]*"\s*:\s*"[^"]*"',
    r'"[^"]*apiKey[^"]*"\s*:\s*"[^"]*"'
]
# 构建完整的正则表达式
combined_pattern = '|'.join(sensitive_patterns)
agent = create_agent(
    openai_model,
    middleware=[PIIMiddleware(pii_type="personal",
                              strategy="mask",
                              detector=combined_pattern,
                              apply_to_input=True,
                              apply_to_output=True,
                              apply_to_tool_results=True
                              )],
)
```

**参数：**

+ pii_type： 要检测的个人身份信息（PII）的类型。可以是内置类型（如“电子邮件”、“信用卡”、“IP 地址”、“MAC 地址”、“网址”）或自定义类型名称。
+ strategy：处理检测到的 PII策略， `block`：一旦检测到个人身份信息（PII），则抛出 PII 检测错误；`redact`：用 `[REDACTED_TYPE]`
  标记符进行替换； `mask`：对 PII 进行部分遮蔽（仅显示最后几个字符）； `hash`：用确定性哈希值进行替换（格式：`<类型哈希：摘要>`）
+ detector：自定义检测器函数或正则表达式模式。 `Callable`：表示一个函数，该函数接收内容字符串并返回一个包含 PIIMatch 对象的列表；
  `str`：表示用于匹配 PII 的正则表达式模式；None`：则使用针对特定 pii 类型的内置检测器。
+ apply_to_input：应用到输入
+ apply_to_output：应用到输出
+ apply_to_tool_results： 应用到工具

##### 工具模拟 - LLMToolEmulator

非常有意思的中间件。当实际应用中某些工具还没准备完成，或者测试成本昂贵时，希望使用LLM来模拟工具行为时，可以指定工具使用LLM来mock

```python
agent = create_agent(
    base_model,
    tools=[get_weather, get_plane_ticket, get_hotel_info, get_scenic],
    middleware=[LLMToolEmulator(model=base_model,
                                tools=[get_plane_ticket, get_hotel_info, get_scenic]
                                ),
                ],
    checkpointer=InMemorySaver()
)
config: RunnableConfig = {"configurable": {"thread_id": "1"}}
r = agent.invoke({"messages": [{"role": "user", "content": "给我制定一个去北京的旅行计划？"}]}, config=config)
```

```python
== == == == == == == == == == == == == == == == Human
Message == == == == == == == == == == == == == == == == =

给我制定一个去北京的旅行计划？
== == == == == == == == == == == == == == == == == Ai
Message == == == == == == == == == == == == == == == == ==
Tool
Calls:
get_weather(call_51b602e2cbb745239fe79714)
Call
ID: call_51b602e2cbb745239fe79714
Args:
location: 北京
get_plane_ticket(call_6d8c57069f494537b6b0a6b4)
Call
ID: call_6d8c57069f494537b6b0a6b4
Args:
location: 北京
get_hotel_info(call_aef4b7934c1544f9b5f74576)
Call
ID: call_aef4b7934c1544f9b5f74576
Args:
location: 北京
get_scenic(call_dc90e4013cb648d294056709)
Call
ID: call_dc90e4013cb648d294056709
Args:
location: 北京
== == == == == == == == == == == == == == == == = Tool
Message == == == == == == == == == == == == == == == == =
Name: get_weather

{"messages": [{"role": "assistant", "content": "It's sunny in 北京."}], "time": 123}
== == == == == == == == == == == == == == == == = Tool
Message == == == == == == == == == == == == == == == == =
Name: get_plane_ticket

{"current_location": "北京", "coordinates": {"latitude": 39.9042, "longitude": 116.4074},
 "timestamp": "2024-06-15T14:23:45+08:00"}
== == == == == == == == == == == == == == == == = Tool
Message == == == == == == == == == == == == == == == == =
Name: get_hotel_info

{
    "hotels": [
        {
            "name": "北京王府井希尔顿酒店",
            "address": "北京市东城区王府井东街8号",
            "rating": 4.7,
            "price_per_night": 1280,
            "amenities": ["免费Wi-Fi", "室内泳池", "健身中心", "餐厅", "会议室"],
            "available_rooms": 12
        },
        {
            "name": "北京国贸大酒店",
            "address": "北京市朝阳区建国门外大街1号",
            "rating": 4.9,
            "price_per_night": 2300,
            "amenities": ["高空观景台", "水疗中心", "米其林餐厅", "免费停车", "行政酒廊"],
            "available_rooms": 5
        },
        {
            "name": "如家精选酒店（北京西单店）",
            "address": "北京市西城区西单北大街131号",
            "rating": 4.3,
            "price_per_night": 398,
            "amenities": ["免费Wi-Fi", "24小时前台", "行李寄存", "自助早餐"],
            "available_rooms": 23
        }
    ],
    "total_results": 3,
    "location": "北京"
}
== == == == == == == == == == == == == == == == = Tool
Message == == == == == == == == == == == == == == == == =
Name: get_scenic

{
    "location": "北京",
    "scenic_spots": [
        {
            "name": "故宫",
            "description": "明清两代的皇家宫殿，世界上现存规模最大、保存最完整的木质结构古建筑群。",
            "rating": 4.8,
            "opening_hours": "08:30-17:00（周一闭馆）",
            "ticket_price": "60元（旺季），40元（淡季）"
        },
        {
            "name": "颐和园",
            "description": "中国现存规模最大、保存最完整的皇家园林，以昆明湖、万寿山为基础，汇集江南园林设计精华。",
            "rating": 4.7,
            "opening_hours": "06:30-18:00（旺季），07:00-17:00（淡季）",
            "ticket_price": "30元（大门票，旺季），20元（淡季）"
        },
        {
            "name": "天坛公园",
            "description": "明清皇帝祭天祈谷之所，以其严谨的建筑布局与深厚的文化内涵闻名。",
            "rating": 4.6,
            "opening_hours": "06:00-22:00（公园），08:00-17:30（景点）",
            "ticket_price": "15元（联票含祈年殿等）"
        }
    ]
}
== == == == == == == == == == == == == == == == == Ai
Message == == == == == == == == == == == == == == == == ==

为您制定一个去北京的旅行计划如下：

### 1. 天气情况
北京当前天气晴朗，非常适合出行！

### 2. 机票信息
您已在北京（坐标：39.9042°N, 116.4074°E），无需额外安排机票。

### 3. 推荐住宿
以下是几家不同价位和风格的酒店供您选择：
- ** 高端选择 **：北京国贸大酒店（评分4
.9，每晚约2300元），拥有高空观景台、水疗中心和米其林餐厅。
- ** 舒适选择 **：北京王府井希尔顿酒店（评分4
.7，每晚约1280元），设施齐全，靠近市中心。
- ** 经济选择 **：如家精选酒店（北京西单店）（评分4
.3，每晚约398元），性价比高，交通便利。

### 4. 必游景点
- ** 故宫 **
- 描述：明清皇家宫殿，世界现存最大、最完整的木质古建筑群。
- 开放时间：0
8: 30 - 17:00（周一闭馆）。
- 门票：旺季60元，淡季40元。

- ** 颐和园 **
- 描述：中国最大皇家园林，融合江南园林精华。
- 开放时间：旺季06: 30 - 18:00，淡季07: 00 - 17:00。
- 门票：旺季30元，淡季20元。

- ** 天坛公园 **
- 描述：明清皇帝祭天祈谷场所，布局严谨，文化深厚。
- 开放时间：公园06: 00 - 22:00，景点08: 00 - 17:30。
- 门票：联票15元（含祈年殿等）。

希望这份计划对您的北京之旅有所帮助！如果需要进一步调整或补充，请随时告诉我！
```

****

**参数：**

+ model：模拟工具的模型
+ tools： 需要模拟的工具

##### 待办清单 - <font style="color:rgb(31, 35, 40);">TodoListMiddleware</font>

类似claude code 等编程工具，在执行前会先先制定一个todo list。 该中间价，在执行任务前先规划，在执行。

```python
agent = create_agent(openai_model, middleware=[TodoListMiddleware()])

result = agent.invoke({"messages": [HumanMessage("帮我重构我的代码库")]})

print(result["todos"])

# 输出
# [
#   {
#     'content': '明确重构目标、范围、技术栈和代码库获取方式（链接或压缩包/代表性文件）',
#     'status': 'in_progress'
#   },
#   {
#     'content': '获取并搭建本地可运行环境：拉取仓库、安装依赖、成功构建并跑现有测试',
#     'status': 'pending'
#   },
#   {
#     'content': '自动化诊断：运行格式化与静态检查、复杂度/重复度/依赖分析，收集痛点清单',
#     'status': 'pending'
#   },
#   {
#     'content': '架构与模块依赖图分析，识别耦合点与边界划分问题',
#     'status': 'pending'
#   },
#   {
#     'content': '制定重构路线图与分支/PR拆分计划，按风险与收益排序',
#     'status': 'pending'
#   },
#   {
#     'content': '快速收益：统一代码风格、修复关键lint问题、删除死代码、局部命名改进',
#     'status': 'pending'
#   },
#   {
#     'content': '补齐防回归安全网：单元/集成/表征测试（characterization tests）',
#     'status': 'pending'
#   },
#   {
#     'content': '分阶段实施核心重构（解耦、抽象提取、依赖注入、错误处理与日志、配置隔离等），尽量使用自动化codemods/rewrites',
#     'status': 'pending'
#   },
#   {
#     'content': '更新CI/CD与质量闸（lint、测试、覆盖率、重复度、复杂度阈值）',
#     'status': 'pending'
#   },
#   {
#     'content': '文档与迁移说明：ADR、变更记录、升级指南',
#     'status': 'pending'
#   },
#   {
#     'content': '性能与安全检查（如适用），基准测试与静态安全扫描',
#     'status': 'pending'
#   },
#   {
#     'content': '交付与维护建议：约定规范、贡献流程、持续改进计划',
#     'status': 'pending'
#   }]

```

**参数**：

+ system_prompt：系统提示词,不填时使用langchain默认

```python
## `write_todos`

You
have
access
to
the
`write_todos`
tool
to
help
you
manage and plan
complex
objectives.
Use
this
tool
for complex objectives to ensure that you are tracking each necessary step and giving the user visibility into your progress.
This
tool is very
helpful
for planning complex objectives, and for breaking down these larger complex objectives into smaller steps.

It is critical
that
you
mark
todos as completed as soon as you
are
done
with a step.Do not batch up multiple steps before marking them as completed.
For
simple
objectives
that
only
require
a
few
steps, it is better
to
just
complete
the
objective
directly and NOT
use
this
tool.
Writing
todos
takes
time and tokens, use
it
when
it is helpful
for managing complex many-step problems! But not for simple few-step requests.

## Important To-Do List Usage Notes to Remember
- The
`write_todos`
tool
should
never
be
called
multiple
times in parallel.
- Don
't be afraid to revise the To-Do list as you go. New information may reveal new tasks that need to be done, or old tasks that are irrelevant.
```

```python
您可以使用
`write_todos`
工具来帮助管理和规划复杂目标。
对于复杂目标，请使用此工具以确保跟踪每个必要步骤，并让用户清楚了解您的进展。
该工具能有效帮助规划复杂目标，并将这些大型复杂目标分解为更小的步骤。

关键注意事项：完成某个步骤后请立即将待办事项标记为完成。切勿累积多个步骤后才统一标记。
对于只需少量步骤的简单目标，最好直接完成目标而不要使用此工具。
编写待办事项需要时间和资源消耗，请在处理复杂多步骤问题时使用该功能！但不要将其用于简单的少量步骤请求。

重要待办事项使用规范需牢记：
- 绝对不要并行多次调用
`write_todos`
工具。
- 随时根据进展修订待办清单。新信息可能揭示需要完成的新任务，或淘汰不再相关的旧任务。
```

+ tool_description： 工具的描述

##### <font style="color:rgb(31, 35, 40);">工具选择 - LLMToolSelectorMiddleware</font>

使用 LLM 在调用主模型之前智能地选择相关工具。在下面的几种场景下非常适用

+ 代理拥有许多工具（10 种以上），但大多数工具与每次查询无关。
+ 通过过滤无关工具来减少令牌使用量
+ 提高模型聚焦性和准确性

```python
agent = create_agent(openai_model,
                     tools=[get_weather, get_current_position, get_hotel_info, get_scenic],
                     middleware=[LLMToolSelectorMiddleware(
                         max_tools=3,
                         always_include=["get_current_position"])], debug=True)

config: RunnableConfig = {"configurable": {"thread_id": "1"}}

r = agent.invoke({"messages": [{"role": "user", "content": "我现在的位置的天气怎么样？"}]}, config=config)
# 输出
# 我现在的位置的天气怎么样？
# ================================== Ai Message ==================================
# Tool Calls:
#   get_current_position (call_vPg3HvamOSBpTSAYxj6pDbO7)
#  Call ID: call_vPg3HvamOSBpTSAYxj6pDbO7
#   Args:
#     location: current
# ================================= Tool Message =================================
# Name: get_current_position

# 当前在北京
# ================================== Ai Message ==================================
# Tool Calls:
#   get_weather (call_rhv1g4Z1gA9Y4iWq1twHOXwA)
#  Call ID: call_rhv1g4Z1gA9Y4iWq1twHOXwA
#   Args:
#     location: 北京
# ================================= Tool Message =================================
# Name: get_weather

# {"messages": [{"role": "assistant", "content": "It's sunny in 北京."}], "time": 123}
# ================================== Ai Message ==================================

# 你现在在北京，天气晴朗。


```

**参数**

+ model: 用于选择的模型。若未提供，则使用代理的主模型
+ system_prompt: 选择模型的指令。
+ max_tools: 可选择的工具数量上限。若模型选择的数量超过此上限，则仅使用前 max_tools 个工具。若未指定则无限制。
+ always_include:无论选择与否始终包含的工具名称。

这些不会计入 max_tools 限制内。

##### 工具重试 - ToolRetryMiddleware

当工具无法正常运行时，使用重试策略来进行恢复。

```python
agent = create_agent(
    base_model,
    tools=[get_weather],
    middleware=[ToolRetryMiddleware(max_retries=2,
                                    tools=[get_weather],
                                    retry_on=(RequestException, Timeout),
                                    on_failure="return_message",
                                    initial_delay=1.5
                                    ),
                ],
    checkpointer=InMemorySaver()
)

# 输出
# ================================= Tool Message =================================
# Name: get_weather

# Tool 'get_weather' failed after 3 attempts with RequestException
# ================================== Ai Message ==================================

# 很抱歉，获取北京的天气信息时出现了问题。请稍后再试，或者您可以尝试通过其他方式查询天气，比如使用天气应用或网站。
```

**参数：**

+ max_retries：首次调用后的最大重试次数（默认值为 2）
+ tools：需要重试的工具
+ retry_on: 要么是一个包含要重试的异常类型的元组，要么是一个函数，该函数接收一个异常作为参数并返回 `True` 表示是否应重试。
+ on_failure: 当所有重试都用尽时的行为。选项：
    - `"return_message"`（默认值）：返回一个包含错误详情的工具消息，使语言模型能够处理错误并可能进行恢复。
    - `"raise"`：重新抛出异常，停止代理执行。
    - 自定义可调用函数：接收异常并返回用于工具消息内容的字符串的函数，允许自定义错误格式化
+ backoff_factor：指数退避的乘数。一般使用固定即可。类似斐波那契数列不断增加延迟。
+ initial_delay：初步的延迟值
+ max_delay： 最大的延迟值
+ jitter：是否添加随机抖动（±25%）到延迟以避免“雷鸣潮涌”现象。默认值为 `True`。

从这个函数的设置上看，感觉设计的偏复杂了，有一点过度设计感觉，一般来说推荐只设置一个initial_delay参数即可，固定等待就好了。

##### 缓存命中：AnthropicPromptCachingMiddleware

在一些重复的提示词中，问题和回答时使用提示词名字，可以节约token消耗。比如：今天的AI最新新闻有哪些？今天的天气是什么？

```python
agent = create_agent(
    model=base_model,
    system_prompt=LONG_PROMPT,
    middleware=[AnthropicPromptCachingMiddleware()]
)
```

适用场景：

+ 应用程序包含冗长、重复的系统提示
+ 代理在多次调用中重用相同的上下文
+ 降低部署的 API 成本

####       

#### 自定义中间件

如果在运行过程中，只需要一个位置的钩子，没有复杂的配置。使用装饰器的方式是最方便与简洁的。

如果希望在运行过程中执行多个钩子，配置也比较复杂，在多个代理或者多个项目中复用，可以使用子类自定义实现的方式

##### 装饰器

+ @before_agent: 在代理启动之前调用。（每次运行只调用一次）
+ @after_agent:  在代理运行完成后调用。（每次运行只调用一次）
+ @before_model: 每次调用模型之前运行，持久化保存，会将记忆保存到对话历史中。
+ @after_model: 每次调用模型之后运行，持久化保存，会将记忆保存到对话历史中。
+ @wrap_model_call: 环绕钩子，在模型前后都会调用。（临时修改）
+ @wrap_tool_call: 环绕钩子，在工具前后都会调用。（临时修改）
+ @dynamic_prompt: 临时修改提示词，不影响state中的内容（相较于@before_mode）。相当于@wrap_model_call修改提示词的方式。

```python
@tool
def get_weather(location: str) -> str:
    """Get the weather at a location."""
    return {"messages": [{"role": "assistant", "content": f"It's sunny in {location}."}]}


@before_agent
def before_agent_middleware(state: CustomState, runtime: Runtime) -> dict[str, Any] | None:
    print("调用代理运行前中间件")
    return None


@after_agent
def after_agent_middleware(state: CustomState, runtime: Runtime) -> dict[str, Any] | None:
    print("a调用代理运行后中间件")
    return None


@before_model(can_jump_to=["end"])
def before_model_middleware(state: CustomState, runtime: Runtime) -> dict[str, Any] | None:
    print("调用模型运行前中间件")
    return None


@after_model
def after_model_middleware(state: CustomState, runtime: Runtime) -> dict[str, Any] | None:
    print("调用模型运行后中间件")
    return None


@wrap_model_call
def wrap_model_call_middleware(
        request: ModelRequest,
        handler: Callable[[ModelRequest], ModelResponse],
) -> ModelResponse:
    print("调用模型环绕中间件")
    if len(request.messages) > 10:
        print("选择使用基础模型")
        request.model = base_model
    else:
        print("选择使用高级模型")
        request.model = base_model
    return handler(request)


@wrap_tool_call
def wrap_tool_call_middleware(request: ToolCallRequest,
                              handler: Callable[[ToolCallRequest], ToolMessage | Command],
                              ) -> ToolMessage | Command:
    print("调用工具环绕中间件")
    print(f"Executing tool: {request.tool_call['name']}")
    print(f"Arguments: {request.tool_call['args']}")

    try:
        result = handler(request)
        print(f"Tool completed successfully")
        return result
    except Exception as e:
        print(f"Tool failed: {e}")
        raise


@dynamic_prompt
def personalized_prompt(request: ModelRequest) -> str:
    user_id = "BaqiF2"
    print("进入动态修改提示词中间件")
    return f"You are a helpful assistant for user {user_id}. Be concise and friendly."


base_model = ChatOpenAI(api_key=os.getenv("DASHSCOPE_API_KEY"),
                        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                        model="qwen3-max")

agent = create_agent(
    base_model,
    tools=[get_weather],
    middleware=[before_agent_middleware, before_model_middleware, personalized_prompt, wrap_model_call_middleware,
                wrap_tool_call_middleware, after_model_middleware, after_agent_middleware],
    checkpointer=InMemorySaver()
)

# 输出
# 调用代理运行前中间件
# 调用模型运行前中间件
# 进入动态修改提示词中间件
# 调用模型环绕中间件
# 选择使用高级模型
# 调用模型运行后中间件
# 调用工具环绕中间件
# Executing tool: get_weather
# Arguments: {'location': '北京'}
# Tool completed successfully
# 调用模型运行前中间件
# 进入动态修改提示词中间件
# 调用模型环绕中间件
# 选择使用高级模型
# 调用模型运行后中间件
# 调用代理运行后中间件
```

##### 子类自定义

继承AgentMiddleware类，自定义实现 before_agent/after_agent/before_model/after_model/wrap_model_call/wrap_tool_call

```python
class CustomMiddleware(AgentMiddleware):
    """
    自定义的AgentMiddleware
    """

    def before_agent(self, state: CustomState, runtime: Runtime) -> dict[str, Any] | None:
        print("调用代理运行前中间件")
        return None

    def before_model(self, state: CustomState, runtime: Runtime) -> dict[str, Any] | None:
        """Logic to run before the model is called."""
        print("调用模型运行前中间件")
        return None

    def after_model(self, state: CustomState, runtime: Runtime) -> dict[str, Any] | None:
        """Logic to run after the model is called."""
        print("调用模型运行后中间件")
        return None

    def after_agent(self, state: CustomState, runtime: Runtime) -> dict[str, Any] | None:
        """Logic to run after the agent execution completes."""
        print("调用代理运行后中间件")
        return None

    def wrap_model_call(
            self,
            request: ModelRequest,
            handler: Callable[[ModelRequest], ModelResponse],
    ) -> ModelCallResult:
        print("调用模型环绕中间件")
        if len(request.messages) > 10:
            print("选择使用基础模型")
            request.model = base_model
        else:
            print("选择使用高级模型")
            request.model = base_model
        return handler(request)

    def wrap_tool_call(
            self,
            request: ToolCallRequest,
            handler: Callable[[ToolCallRequest], ToolMessage | Command],
    ) -> ToolMessage | Command:
        print("调用工具环绕中间件")
        print(f"Executing tool: {request.tool_call['name']}")
        print(f"Arguments: {request.tool_call['args']}")

        try:
            result = handler(request)
            print(f"Tool completed successfully")
            return result
        except Exception as e:
            print(f"Tool failed: {e}")
            raise


agent = create_agent(
    base_model,
    tools=[get_weather],
    middleware=[CustomMiddleware()],
    checkpointer=InMemorySaver()
)
# 输出
调用代理运行前中间件
调用模型运行前中间件
调用模型环绕中间件
选择使用高级模型
调用模型运行后中间件
调用工具环绕中间件
Executing
tool: get_weather
Arguments: {'location': '北京'}
Tool
completed
successfully
调用模型运行前中间件
调用模型环绕中间件
选择使用高级模型
调用模型运行后中间件
调用代理运行后中间件
```

##### 执行流程

+ `before_*`钩子：从第一个到最后一个
+ `after_*`钩子：从后到前（反向）
+ `wrap_*`hooks：嵌套式（第一个中间件包裹所有其他中间件）

##### 特殊跳跃

要提前退出中间件，请返回一个包含以下内容的字典`jump_to`：

可跳跃目标：

+ `"end"`跳转到代理执行的末尾
+ `"tools"`跳转到工具节点
+ `"model"`跳转到模型节点（或第一个`before_model`钩子）

##### 使用场景

1. 对话历史摘要

当对话历史过长时，自动压缩消息以节省上下文窗口

2. PII（个人身份信息）检测和脱敏

在发送给模型前检测并删除邮箱、信用卡号、社保号等敏感信息

3. 人工审核（Human-in-the-loop）

在执行敏感操作（如发送邮件、删除数据）前需要人工批准

4. 消息修剪

根据 token 限制自动修剪旧消息，保持上下文在合理范围内

5. 动态模型选择

根据对话复杂度、用户级别或任务类型动态选择不同的模型

6. 内容过滤和安全防护

使用模型评估响应的安全性，阻止包含禁用关键词的请求

7. 工具错误处理

自定义工具执行失败时的错误处理逻辑

8. 动态系统提示

根据用户角色（专家/初学者）或上下文动态调整系统提示

9. 日志记录和监控

添加自定义日志、指标收集和分析功能

10. 自定义 HTTP 头部和请求拦截

在部署时添加自定义头部、检查认证、执行安全策略

### 短期记忆

Agent会通过AgentState对象自动维护对话历史记录。还可以配置自定义State方案，以便在对话过程中记住其他信息。存储在State中的信息可以被视为Agent的短期记忆。

短期记忆可以让应用程序记住**单个线程**或对话中的先前交互。

#### 自定义State管理

State存储着记忆中的历史消息和一些运行时的参数信息，第一步就是得确定厉害消息的结构。

**注意**：langchain 1.0现在只支持TypeDict类型，避免使用Pydantic（我的理解：Pyadantic在结构化输出更合适）

```python
class CustomState(AgentState):
    user_preferences: dict
```

+ 使用中间件（middleWare），赋值自定义state_schema

```python
# 1. 使用中间件
class CustomMiddleware(AgentMiddleware):
    # 定义状态
    state_schema = CustomState
    # 定义工具
    tools = [get_weather]


agent = create_agent(
    model=base_model,
    middleware=[CustomMiddleware()],
)
```

这种方式可以在运行agent之前把我们需要自定义的内容都放到钩子函数中，统一进行管理。

+ 保持之前的方式，继续使用state_schema 方式

```python
agent = create_agent(
    model=base_model,
    # 2. state_schema
    tools=[get_weather],
    state_schema=CustomState
)
```

两种方式都能使用自定义的状态，虽然官方倾向于第一种统一管理，但是state_schema，tools这些如果不了解参数就会被隐藏起来。个人倾向还是使用之前的方式更符合调用者的习惯。适当的保留这些参数，中间件更多的去处理一些个性化内容，比如上下文，历史记忆管理等等逻辑

#### 保存

+ checkPointer（检查点）

设置checkPointer参数，可以为图中每个节点完成后更新状态，保存到内存或者数据库中

+ InMemorySaver(内存)

默认的方式，只在单个线程中使用，一般都能满足需求。

```python
agent = create_agent(
    base_model,
    tools=[get_weather],
    middleware=[trim_messages],
    checkpointer=InMemorySaver(),
)
```

+ PostgresSaver(数据库)

使用postgres sql 来记录过程的历史消息，生产环境中，如果有稳定性，或者历史聊天记录需要保存的情况下，可以使用。

```python
from langgraph.checkpoint.postgres import PostgresSaver

DB_URI = "postgresql://postgres:postgres@localhost:5442/postgres?sslmode=disable"
with PostgresSaver.from_conn_string(DB_URI) as checkpointer:
    checkpointer.setup()  # auto create tables in PostgresSql
    agent = create_agent(
        "gpt-5",
        [get_user_info],
        checkpointer=checkpointer,
    )
```

#### 历史消息管理

+ trim（裁剪消息）

为了避免消息超过上下文的上限，使用消息裁剪，保留指定条目或者token数量的历史消息。

使用middleware的方式,来进行处理

```python
@before_model
def customer_trim_messages(state: AgentState, runtime: Runtime) -> dict[str, Any] | None:
    """只保留最新的3条数据"""
    messages = state["messages"]
    if len(messages) <= 3:
        return None  # No changes needed

    # 1. langchain util + 指定保留示例
    recent_messages = trim_messages(messages,
                                    # 保留最新4条数据
                                    strategy="last",
                                    # 表示使用条目的计数方式
                                    token_counter=len,
                                    # 这里表示最多允许4条消息
                                    max_tokens=4,
                                    )
    first_msg = messages[0]

    # 2. 自定义的方式
    # recent_messages = messages[-3:] if len(messages) % 2 == 0 else messages[-4:]

    new_messages = [first_msg] + recent_messages
    # 先删除所有数据然后，将第一条和最新的3条数据返回
    return {
        "messages": [
            RemoveMessage(id=REMOVE_ALL_MESSAGES),
            *new_messages
        ]
    }

# ================================ Human Message =================================

# 北京天气怎么样?
# ================================== Ai Message ==================================
# Tool Calls:
#   get_weather (call_0e1e205d8ed34af48729a441)
#  Call ID: call_0e1e205d8ed34af48729a441
#   Args:
#     location: 上海
# ================================= Tool Message =================================
# Name: get_weather

# {"messages": [{"role": "tool", "content": "It's sunny in 上海."}]}
# ================================== Ai Message ==================================

# 上海现在天气晴朗。
# ================================ Human Message =================================

# 之前问了哪些城市，分别是什么天气
# ================================== Ai Message ==================================

# 你之前询问了北京的天气，但我查询的是上海的天气，结果显示上海天气晴朗。如果你需要了解北京或其他城市的天气，请告诉我！    
```

我们最后一次问的问题是 "之前问了哪些城市，分别是什么天气",进入到trim_message
方法保留了最后的4条历史消息+第一条我们问的问题。  
因为丢失了之前我们提问的北京天气，所以它现在不知道当时的天气结果。

**备注**：官方文档中没有使用 langchain的trim_messages，trim_messages工具类提供了按照数量裁剪和token裁剪的方式，推荐使用。

```python
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
        strategy="last",
        token_counter=base_model,
        max_tokens=45,
    )
    print(trim_message)
```

+ delete (删除指定消息)

RemoveMessage: 删除指定或所有消息

**注意：**删除消息要保证历史消息的有序性，否则可能会出现错误。 比如： system-> user -> assistant -> tool -> assistant ->
user .....

```python
# 删除指定id的消息
{"messages": [RemoveMessage(id=m.id) for m in messages[:2]]}
# 删除所有的消息
{"messages": [RemoveMessage(id=m.REMOVE_ALL_MESSAGES)}
```

+ 摘要总结

在接近模型上下文的限制，可以使用摘要方式，将历史聊天消息整合为一段了历史消息，作为模型的记忆重新传递给模型，然后再继续后续的聊天方式，这也是一种常用的上下文管理方式。
摘要的总结内容，也是需要有独立的摘要智能体来进行。在langchain中可以使用SummarizationMiddleware来进行处理。

```python
summary_prompt = """
您是一位乐于助人的助手。您正在总结人类与助手之间的对话。您已获得以下消息：{messages}。
按照 城市：天气 格式输出。 如果不知道城市天气 ，先不要输出 城市: 天气, 等下一次再总结.
"""
agent = create_agent(
    base_model,
    tools=[get_weather],
    middleware=[SummarizationMiddleware(
        # 摘要模型，使用理解能力更好的模型
        model=base_model,
        # 触发摘要的token数量
        max_tokens_before_summary=100,
        # 生成后保留最近的消息数量。！！！ 最近N条会排出总结范围，不会总结消息
        messages_to_keep=1,
        # 摘要的提示词模版，这个很重要，决定最后摘要的质量
        summary_prompt=summary_prompt,
    )],
    checkpointer=InMemorySaver(),
    system_prompt="你是一个天气专家,请回答用户提出关于天气的问题。"
)
# 部分输出举例
# [('human', 'Here is a summary of the conversation to date:\n\n北京：晴天'), ('ai', ''), ('tool', '{"messages": [{"role": "tool", "content": "杭州 现在的天气是晴天。"}]}')]
# [('human', 'Here is a summary of the conversation to date:\n\n北京：晴天'), ('ai', ''), ('tool', '{"messages": [{"role": "tool", "content": "杭州 现在的天气是晴天。"}]}'), ('ai', '杭州现在的天气是晴天。')]
# [('human', 'Here is a summary of the conversation to date:\n\n北京：晴天'), ('ai', ''), ('tool', '{"messages": [{"role": "tool", "content": "杭州 现在的天气是晴天。"}]}'), ('ai', '杭州现在的天气是晴天。'), ('human', '那上海呢？')]
# [('human', 'Here is a summary of the conversation to date:\n\n北京：晴天'), ('ai', ''), ('tool', '{"messages": [{"role": "tool", "content": "杭州 现在的天气是晴天。"}]}'), ('ai', '杭州现在的天气是晴天。'), ('human', '那上海呢？'), ('ai', '')]
# [('human', 'Here is a summary of the conversation to date:\n\n北京：晴天'), ('ai', ''), ('tool', '{"messages": [{"role": "tool", "content": "杭州 现在的天气是晴天。"}]}'), ('ai', '杭州现在的天气是晴天。'), ('human', '那上海呢？'), ('ai', ''), ('tool', '{"messages": [{"role": "tool", "content": "上海 现在的天气是晴天。"}]}')]
# [('human', 'Here is a summary of the conversation to date:\n\n北京：晴天  \n杭州：晴天'), ('ai', ''), ('tool', '{"messages": [{"role": "tool", "content": "上海 现在的天气是晴天。"}]}')]
# [('human', 'Here is a summary of the conversation to date:\n\n北京：晴天  \n杭州：晴天'), ('ai', ''), ('tool', '{"messages": [{"role": "tool", "content": "上海 现在的天气是晴天。"}]}'), ('ai', '上海现在的天气是晴天。')]
# [('human', 'Here is a summary of the conversation to date:\n\n北京：晴天  \n杭州：晴天'), ('ai', ''), ('tool', '{"messages": [{"role": "tool", "content": "上海 现在的天气是晴天。"}]}'), ('ai', '上海现在的天气是晴天。'), ('human', '那广州呢？')]
# [('human', 'Here is a summary of the conversation to date:\n\n北京：晴天  \n杭州：晴天'), ('ai', ''), ('tool', '{"messages": [{"role": "tool", "content": "上海 现在的天气是晴天。"}]}'), ('ai', '上海现在的天气是晴天。'), ('human', '那广州呢？'), ('ai', '')]
# [('human', 'Here is a summary of the conversation to date:\n\n北京：晴天  \n杭州：晴天'), ('ai', ''), ('tool', '{"messages": [{"role": "tool", "content": "上海 现在的天气是晴天。"}]}'), ('ai', '上海现在的天气是晴天。'), ('human', '那广州呢？'), ('ai', ''), ('tool', '{"messages": [{"role": "tool", "content": "广州 现在的天气是晴天。"}]}')]
# [('human', 'Here is a summary of the conversation to date:\n\n北京：晴天  \n杭州：晴天  \n上海：晴天'), ('ai', ''), ('tool', '{"messages": [{"role": "tool", "content": "广州 现在的天气是晴天。"}]}')]
# [('human', 'Here is a summary of the conversation to date:\n\n北京：晴天  \n杭州：晴天  \n上海：晴天'), ('ai', ''), ('tool', '{"messages": [{"role": "tool", "content": "广州 现在的天气是晴天。"}]}'), ('ai', '广州现在的天气是晴天。')]
# [('human', 'Here is a summary of the conversation to date:\n\n北京：晴天  \n杭州：晴天  \n上海：晴天'), ('ai', ''), ('tool', '{"messages": [{"role": "tool", "content": "广州 现在的天气是晴天。"}]}'), ('ai', '广州现在的天气是晴天。'), ('human', '那深圳呢？')]

```

**注意**：messages_to_keep 参数不会将最近的N条数据放入总结的历史消息中

参数：

+ model：总结摘要的模型
+ max_tokens_before_summary：触发摘要的token数量
+ messages_to_keep：摘要后保留的消息条目数
+ **summary_prompt**：总计消息的提示词。这个我认为应该是摘要节点最最最重要的地方，直接影响摘要的质量和上下文长度
+ summary_prefix：包含在新系统提示词的前缀

#### 访问记忆

使用ToolRuntime来访问运行时参数，比如 Context，State

+ 读取记忆

访问记忆中参数状态，比如在做一个投资风控等级agent过程中，当risk_level>3时就抛出异常和告警信息

```python
class CustomState(AgentState):
    risk_level: int


@tool
def risk_check(
        runtime: ToolRuntime
) -> str:
    """检查风控是否达标"""
    risk_level = runtime.state["risk_level"]
    if risk_level > 3:
        raise ValueError("Risk level too high")
    return "ok"
```

+ 写入记忆

可以在执行完工具后，讲自定义的消息内容加入到记忆中。 比如上面说的risk_level

```python
@tool
def risk_check_and_set(
        runtime: ToolRuntime[CustomState],
) -> Command:
    """检查风控是否达标"""
    risk_level = runtime.state["risk_level"]
    if risk_level > 3:
        raise ValueError("Risk level too high")
    return Command(update={"risk_level": 2,
                           "messages": ToolMessage("当前风险等级为2，正常范围", tool_call_id=runtime.tool_call_id)})
```

+ 中间件 middleware

使用@before_model，@after_model 定义在调用模型前后的中间件，来个性化记忆

### 相关资料

完整代码：[https://github.com/BaqiF2/ydc_ai_dev](https://github.com/BaqiF2/ydc_ai_dev)



