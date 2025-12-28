"""
动态权限模式切换示例

本示例展示如何在 Claude Agent SDK 的流式会话中动态切换权限模式。

重要说明：
- 动态权限模式切换需要使用 ClaudeSDKClient 类，而不是 query() 函数
- query() 函数只支持单次查询，不支持动态修改权限模式
- ClaudeSDKClient 提供完整的双向交互能力

权限模式类型：
- default: 标准权限行为，应用正常权限检查
- acceptEdits: 自动接受文件编辑和文件系统操作
- bypassPermissions: 绕过所有权限检查（谨慎使用）
- plan: 规划模式，只能使用只读工具（SDK 中目前不支持）
"""

import asyncio
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions


async def demo_basic_permission_mode():
    """基础示例：展示如何动态切换权限模式"""
    print("=" * 60)
    print("示例 1: 基础权限模式动态切换")
    print("=" * 60)

    # 创建客户端，初始使用 default 权限模式
    async with ClaudeSDKClient(
        options=ClaudeAgentOptions(permission_mode="default")
    ) as client:

        # 第一阶段：使用默认权限分析文件
        print("\n阶段 1: 使用 default 模式")
        await client.query("请列出当前目录下的主要文件")

        # 接收第一阶段的响应
        async for message in client.receive_response():
            print(f"📨 {message}")

        # 切换到 acceptEdits 模式
        print("\n⚙️  切换权限模式: default -> acceptEdits")
        await client.set_permission_mode("acceptEdits")
        print("✅ 现在文件编辑将自动被批准，无需手动确认\n")

        # 第二阶段：使用 acceptEdits 模式进行文件操作
        print("阶段 2: 使用 acceptEdits 模式")
        await client.query("创建一个测试文件 test.txt")

        # 接收第二阶段的响应
        async for message in client.receive_response():
            print(f"📨 {message}")


async def demo_multiple_mode_switches():
    """高级示例：展示多次权限模式切换"""
    print("\n" + "=" * 60)
    print("示例 2: 多次权限模式切换")
    print("=" * 60)

    # 创建客户端
    async with ClaudeSDKClient(
        options=ClaudeAgentOptions(permission_mode="default")
    ) as client:

        # 阶段 1: 探索阶段 - 使用 default 模式
        print("\n⚙️  阶段 1: 使用 default 模式进行探索")
        await client.query("分析当前目录的文件结构")
        async for message in client.receive_response():
            print(f"📨 {message}")

        # 阶段 2: 快速编辑阶段 - 切换到 acceptEdits 模式
        print("\n⚙️  阶段 2: 切换到 acceptEdits 模式加速开发")
        await client.set_permission_mode("acceptEdits")
        await client.query("创建一个示例配置文件 config.json")
        async for message in client.receive_response():
            print(f"📨 {message}")

        # 阶段 3: 谨慎操作阶段 - 切换回 default 模式
        print("\n⚙️  阶段 3: 切换回 default 模式进行谨慎操作")
        await client.set_permission_mode("default")
        await client.query("检查刚才创建的文件内容")
        async for message in client.receive_response():
            print(f"📨 {message}")


async def demo_bypass_permissions():
    """演示 bypassPermissions 模式（谨慎使用）"""
    print("\n" + "=" * 60)
    print("示例 3: bypassPermissions 模式（仅用于受控环境）")
    print("=" * 60)
    print("⚠️  警告: 此模式会绕过所有权限检查，仅在完全信任的环境中使用\n")

    # 创建客户端，使用 bypassPermissions 模式
    async with ClaudeSDKClient(
        options=ClaudeAgentOptions(permission_mode="bypassPermissions")
    ) as client:

        await client.query("列出当前目录的所有文件")

        # 在 bypassPermissions 模式下，所有工具调用都会自动批准
        async for message in client.receive_response():
            print(f"📨 {message}")


async def main():
    """主函数：运行所有示例"""
    try:
        # 运行基础示例
        await demo_basic_permission_mode()

        # 运行高级示例
        # await demo_multiple_mode_switches()

        # 运行 bypass 模式示例（注释掉以避免意外执行）
        # await demo_bypass_permissions()

        print("\n" + "=" * 60)
        print("✅ 所有示例执行完成")
        print("=" * 60)

    except Exception as e:
        print(f"\n❌ 错误: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    # 运行主函数
    asyncio.run(main())
