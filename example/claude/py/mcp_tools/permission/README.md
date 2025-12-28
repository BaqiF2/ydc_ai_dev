## 工具权限处理

官方文档：https://platform.claude.com/docs/zh-CN/agent-sdk/permissions

### Claude Agent SDK 提供四种互补的方式来控制工具使用：

- **权限模式** - 影响所有工具的全局权限行为设置
- **canUseTool 回调** - 用于其他规则未涵盖的情况的运行时权限处理程序
- **钩子** - 通过自定义逻辑对每个工具执行进行细粒度控制
- **权限规则 (settings.json)** - 具有集成 bash 命令解析的声明式允许/拒绝规则

**每种方法的用例**：

- 权限模式 - 设置整体权限行为（规划、自动接受编辑、绕过检查）
- canUseTool - 未涵盖情况的动态批准，提示用户获得权限
- 钩子 - 对所有工具执行的编程控制
- 权限规则 - 具有智能 bash 命令解析的静态策略

---

## 权限模式

### 四种权限模式

| 模式 | 描述 | 使用场景 |
|------|------|---------|
| `default` | 标准权限行为 | 正常开发，需要权限检查 |
| `acceptEdits` | 自动接受文件编辑 | 快速迭代，信任文件操作 |
| `bypassPermissions` | 绕过所有权限检查 | 受控环境，自动化任务（谨慎使用） |
| `plan` | 规划模式，只读工具 | SDK 中目前不支持 |

### 使用方法

#### 1. 初始化设置

在创建 query 时通过 options 参数设置：

```python
from claude_agent_sdk import query, ClaudeAgentOptions

result = await query(
    prompt="帮我分析代码",
    options=ClaudeAgentOptions(
        permission_mode="default"
    )
)
```

#### 2. 动态模式更改（使用 ClaudeSDKClient）

**重要**：动态权限模式切换需要使用 `ClaudeSDKClient` 类，而不是 `query()` 函数。

在交互式会话中动态切换权限模式：

```python
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions

# 使用 ClaudeSDKClient 进行交互式会话
async with ClaudeSDKClient(
    options=ClaudeAgentOptions(permission_mode="default")
) as client:

    # 第一个查询
    await client.query("帮我分析代码")
    async for message in client.receive_response():
        print(message)

    # 动态切换到 acceptEdits 模式
    await client.set_permission_mode("acceptEdits")

    # 第二个查询（使用新的权限模式）
    await client.query("创建测试文件")
    async for message in client.receive_response():
        print(message)
```

### 示例代码

查看 `permission_mode.py` 文件，包含三个完整示例：

1. **基础示例** - 展示如何在会话中动态切换权限模式
2. **高级示例** - 展示多次权限模式切换（探索 → 快速编辑 → 谨慎操作）
3. **bypass 模式** - 展示如何使用 bypassPermissions 模式（谨慎使用）

运行示例：

```bash
cd example/claude/py/mcp_tools/permission
python permission_mode.py
```

---

## canUseTool

`canUseTool` 回调在调用 `query` 函数时作为选项传递。它接收工具名称和输入参数，必须返回一个决定 - 允许或拒绝。

### ⚠️ 重要：can_use_tool 的使用要求

**`canUseTool` 回调需要满足以下所有条件才能触发：**

1. **必须使用流式模式**
   - ✅ 使用 `ClaudeSDKClient` 类
   - ❌ 不能用 `query()` 函数的简单字符串 prompt
   - 流式模式是指使用 `ClaudeSDKClient` 或 `query()` 的异步生成器输入

2. **使用 `permission_mode="default"`**
   - ❌ `acceptEdits` 模式会自动批准文件操作
   - ❌ `bypassPermissions` 模式会跳过所有权限检查

3. **工具未被其他规则处理**
   - 钩子和权限规则未处理该工具
   - 不在 `.claude/settings.json` 的 allow 列表中

**权限流程顺序：**
```
PreToolUse Hook → 拒绝规则 → 允许规则 → 询问规则 → 权限模式检查 → canUseTool 回调
```

### 示例代码

`can_use_tool.py` 文件展示了完整的实现：

```python
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions

async def prompt_for_tool_approval(tool_name: str, input_params: dict):
    # 显示工具信息
    print(f"\n🔧 Tool Request: {tool_name}")

    # 获取用户批准
    answer = input("\n   Approve this tool use? (y/n): ")

    if answer.lower() in ['y', 'yes']:
        return {"behavior": "allow", "updatedInput": input_params}
    else:
        return {"behavior": "deny", "message": "User denied permission"}

# ⚠️ 关键配置：
# 1. 使用 ClaudeSDKClient（流式模式）- can_use_tool 必需
# 2. 使用 permission_mode="default"
async with ClaudeSDKClient(
    options=ClaudeAgentOptions(
        permission_mode="default",  # 必须是 default 模式
        can_use_tool=prompt_for_tool_approval  # 回调函数
    )
) as client:
    # 使用 query 方法发送消息
    await client.query("Help me analyze this codebase")

    # 处理响应
    async for message in client.receive_response():
        # 处理消息...
        pass
```

**为什么 can_use_tool 不触发？**

如果你的 `can_use_tool` 回调没有被调用，检查：

1. ❌ 使用了 `query()` 函数的字符串 prompt → ✅ 改用 `ClaudeSDKClient`
2. ❌ 使用了 `permission_mode="acceptEdits"` → ✅ 改用 `"default"`
3. ❌ 工具在 `.claude/settings.json` 的 allow 列表中 → ✅ 移除或使用其他工具测试

运行示例：

```bash
cd example/claude/py/mcp_tools/permission
python can_use_tool.py
```

---

## 最佳实践

1. **默认使用 `default` 模式** - 提供最好的安全性
2. **在隔离环境使用 `acceptEdits`** - 快速迭代时很有用
3. **避免 `bypassPermissions`** - 除非在完全受控的环境中
4. **结合钩子使用** - 实现更细粒度的控制
5. **动态切换模式** - 根据任务阶段灵活调整权限策略