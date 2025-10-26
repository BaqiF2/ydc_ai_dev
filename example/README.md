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
