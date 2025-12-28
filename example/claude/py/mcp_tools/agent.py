import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions


async def main():
    async for message in query(
            prompt="Open example.com and describe what you see",
            options=ClaudeAgentOptions(
                mcp_servers={
                    "playwright": {"command": "npx", "args": ["@playwright/mcp_tools@latest"]}
                },
                permission_mode="bypassPermissions"
            )
    ):
        print(message)


asyncio.run(main())
