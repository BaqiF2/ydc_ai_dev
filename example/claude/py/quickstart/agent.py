import asyncio
import argparse
from claude_agent_sdk import query, ClaudeAgentOptions, AssistantMessage, ResultMessage


async def main(prompt: str):
    # Agentic loop: streams messages as Claude works
    async for message in query(
            prompt=prompt,
            options=ClaudeAgentOptions(
                allowed_tools=["Read", "Edit", "Glob", "WebSearch", "Bash"],  # Tools Claude can use
                permission_mode="acceptEdits",  # Auto-approve file edits
                system_prompt="你是一个AI助手，帮助用户完成任务",
            )
    ):
        # Print human-readable output
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if hasattr(block, "text"):
                    print(block.text)  # Claude's reasoning
                elif hasattr(block, "name"):
                    print(f"Tool: {block.name}")  # Tool being called
        elif isinstance(message, ResultMessage):
            print(f"Done: {message.subtype}")  # Final result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Claude-Agent CLI")
    parser.add_argument("prompt", nargs="?", default="", help="输入的prompt内容")
    args = parser.parse_args()

    print("=== 启动Claude-Agent ===")
    prompt = args.prompt if args.prompt else input("请输入prompt: ")
    asyncio.run(main(prompt))
