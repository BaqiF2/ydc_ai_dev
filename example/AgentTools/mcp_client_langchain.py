"""
MCP客户端 - 使用LangChain官方适配器

这个示例使用LangChain官方的langchain-mcp-adapters库来集成多个MCP服务器。
相比自己实现MCP客户端，这种方式更简洁、更标准。
┌─────────────────────────────────────────────────────────┐
│           LangGraph Agent (ReAct模式)                    │
│  • 自动工具选择和调用                                     │
│  • 多轮对话和推理                                        │
└───────────┬──────────────────────┬──────────────────────┘
            │                      │
    ┌───────▼────────┐    ┌───────▼────────┐
    │ 本地MCP (stdio)  │    │ 百炼MCP (HTTP)  │
    │ mcp_server.py   │    │ 墨迹天气API     │
    │ • 时间查询工具   │    │ • 天气查询工具   │
    └─────────────────┘    └─────────────────┘
"""

import asyncio
import os

from dotenv import load_dotenv
from langchain.messages import HumanMessage
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_openai import ChatOpenAI
from langchain.agents import create_agent

load_dotenv()


class MCPLangChainClient:
    """
    使用LangChain官方适配器的MCP客户端
    
    这个类封装了MultiServerMCPClient，提供更友好的接口
    """
    
    def __init__(self):
        """初始化MCP客户端"""
        self.client = None
        self.agent = None
        self.tools = None
        
    async def initialize(self):
        """
        初始化MCP客户端和Agent
        """
        print("初始化MCP客户端...")
        
        # 配置多个MCP服务器
        server_config = {
            # 本地时间服务（stdio传输）
            "time-service": {
                "command": "python",
                "args": ["mcp_server.py"],
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
        
        # 创建MultiServerMCPClient
        self.client = MultiServerMCPClient(server_config)
        
        # 获取所有MCP服务器的工具
        self.tools = await self.client.get_tools()
        print(f"成功加载 {len(self.tools)} 个工具")
        
        # 打印工具列表
        for tool in self.tools:
            print(f"  - {tool.name}: {tool.description}")

        # 初始化LLM
        llm = ChatOpenAI(api_key=os.getenv("DASHSCOPE_API_KEY"),
                         base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                         model="qwen3-max")
        
        # 创建ReAct Agent
        self.agent = create_agent(llm, self.tools)

    async def chat(self, message: str) -> str:
        """
        与Agent对话
        Args:
            message: 用户消息
        Returns:
            Agent的回复
        """
        if not self.agent:
            raise RuntimeError("Agent未初始化，请先调用initialize()")
        
        print(f"用户: {message}")

        # 调用Agent
        response = await self.agent.ainvoke({
            "messages": [HumanMessage(content=message)]
        })

        for message in response["messages"]:
            message.pretty_print()
        # 提取最后的回复
        final_message = response["messages"][-1].content

        return final_message
    
    async def cleanup(self):
        """清理资源"""
        if self.client:
            # 关闭所有MCP连接
            # MultiServerMCPClient会自动管理连接
            print("关闭MCP连接...")


async def example_combined_query():
    """
    综合示例：同时查询北京的天气和当前时间
    
    这个示例展示：
    1. 本地MCP服务器（时间查询）- stdio传输
    2. 百炼MCP服务器（墨迹天气）- HTTP传输
    3. LangChain自动工具编排和智能路由
    4. 多MCP服务的无缝协作
    """
    client = MCPLangChainClient()
    await client.initialize()
    try:
        await client.chat("请告诉我北京天气和当前时间")
    finally:
        await client.cleanup()


async def main():
    """主函数"""
    print("LangChain MCP适配器示例")
    try:
        # 运行综合示例
        await example_combined_query()
    except Exception as e:
        print(f"运行出错: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())

