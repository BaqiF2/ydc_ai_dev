import { query } from "@anthropic-ai/claude-agent-sdk";

// Using top-level await (ESM only)
// @ts-ignore
for await (const message of query({
    prompt: "Analyze this codebase for security vulnerabilities",
    options: {
        allowedTools: ["Read", "Glob", "Grep", "Task"]
    }
})) {
    console.log(message);
}