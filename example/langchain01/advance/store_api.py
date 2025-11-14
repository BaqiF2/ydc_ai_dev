"""
长期记忆 store 的使用
"""
from langgraph.store.memory import InMemoryStore

# 定义存储器
store = InMemoryStore()

# 定义命名空间 user_id + type
user_id = "baqiF2"
type = "advance_content"
name_space = (user_id, type)
# 命名空间的key
key = "long-term-memory"

# 存储数据
store.put(name_space, key, {
    "content": "这是长期记忆的内容",
    "time": 123
})

## 读取
response = store.get(name_space, key)
print(response)

## 搜索 过滤条件为"time": "123"
items = store.search(
    name_space,
    filter={"time": 123},
)
print(items)
