import asyncio

from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain.agents import create_agent
from langchain_openai import ChatOpenAI
import os
from dotenv import load_dotenv

load_dotenv()

base_model = ChatOpenAI(api_key=os.getenv("DASHSCOPE_API_KEY"),
                        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                        model="qwen3-max")


async def get_mcp_tools():
    """
    初始化MCP客户端和Agent
    """
    print("初始化MCP客户端...")

    # 定义MCP client
    client = MultiServerMCPClient(
        {
            "time-service": {
                "command": "python",
                "args": ["math_server.py"],
                "transport": "stdio",
                "env": {},
            },
            # 百炼墨迹天气服务（HTTP传输）
            "weather-service": {
                "url": "https://dashscope.aliyuncs.com/api/v1/mcps/market-cmapi013828/mcp",
                "transport": "streamable_http",
                "headers": {
                    "Authorization": f"Bearer {os.getenv('MOJI_API_KEY')}"
                }
            }
        }
    )

    # 获取所有MCP服务器的工具
    tools = await client.get_tools()
    print(f"成功加载 {len(tools)} 个工具")

    # 打印工具列表
    for tool in tools:
        print(f"  - {tool.name}: {tool.description}")

    return tools


async def main():
    """主函数"""
    try:
        # 运行综合示例
        tools = await get_mcp_tools()
        agent = create_agent(model=base_model, tools=tools)
        r = await agent.ainvoke(
            {"messages": [{"role": "user", "content": "北京市今天的温度在是多少度? 如果再下降50%那温度是多少度？"}]})
        for message in r['messages']:
            message.pretty_print()
    except Exception as e:
        print(f"运行出错: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
