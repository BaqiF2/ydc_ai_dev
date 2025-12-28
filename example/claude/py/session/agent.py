import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions


async def main():
    session_id = None

    # First query: capture the session ID
    async for message in query(
            prompt="Read the authentication module",
            options=ClaudeAgentOptions(allowed_tools=["Read", "Glob"])
    ):
        if hasattr(message, 'subtype') and message.subtype == 'init':
            session_id = message.data.get('session_id')

    # Resume with full context from the first query
    async for message in query(
            prompt="Now find all places that call it",  # "it" = auth module
            options=ClaudeAgentOptions(resume=session_id)
    ):
        pass


asyncio.run(main())
