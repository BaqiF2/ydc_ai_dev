## 前提
需要配置环境变量。当前项目统一使用。自行更换
```python
ChatOpenAI(api_key=os.getenv("DASHSCOPE_API_KEY"),
                      base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                      model="qwen3-max")
```

## 示例代码

### ReAct
example： 我手上有1万块钱大概能买多少克黄金？
1. 使用最原始帮助理解ReAct的思路实现
2. 使用langchain实现
3. 使用langgraph实现
4. 使用autoGen实现