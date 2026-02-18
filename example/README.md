## 前提
需要配置环境变量。当前项目统一使用。自行更换
```python
ChatOpenAI(api_key=os.getenv("DASHSCOPE_API_KEY"),
                      base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                      model="qwen3-max")
```
## 运行
```bash
 uv run python example/ReAct/classics_react.py
 uv run python example/ReAct/lanchain_react.py
```

## 示例代码

### ReAct
example： 我手上有1万块钱大概能买多少克黄金？
1. 使用最原始帮助理解ReAct的思路实现
2. 使用langchain实现
3. 使用langgraph实现
4. 使用autoGen实现

### Plan-and-Execute
example：我有10万元，想做稳健投资，帮我制定一个投资方案
1. classics实现 - 理解Plan-and-Execute核心思想（
2. 使用langchain实现 - 对langchain源码阅读理解

### AgentLoop
Agent Loop 上下文管理相关模块，解决长会话中 token 超限问题的三种策略：
1. [compact](AgentLoop/compact/) - 上下文压缩：通过独立 LLM 调用将中间历史消息生成结构化摘要，替换原始消息以释放 token 空间
2. [context-offload](AgentLoop/context-offload/) - 上下文卸载：将历史消息中 `tool_result` 的大段内容写入文件，替换为文件路径引用
3. [tool-direct-offload](AgentLoop/tool-direct-offload/) - 工具结果直接卸载：作为 Agent Loop 中间件，在工具执行结果返回 LLM 之前将超长内容写入文件
