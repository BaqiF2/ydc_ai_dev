import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions


async def main():
    async for message in query(
            prompt="Analyze this codebase for security vulnerabilities",
            options=ClaudeAgentOptions(allowed_tools=["Read", "Glob", "Grep", "Task"])
    ):
        print(message)


asyncio.run(main())
