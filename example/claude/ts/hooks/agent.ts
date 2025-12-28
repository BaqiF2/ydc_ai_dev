import { query } from "@anthropic-ai/claude-agent-sdk";

// Using top-level await (ESM only)
// @ts-ignore
for await (const message of query({
    prompt: "Suggest improvements to utils.py",
    options: {
        permissionMode: "acceptEdits",
        hooks: {
            PostToolUse: [{
                matcher: "Edit|Write",
                // @ts-ignore
                hooks: [{ type: "command", command: "echo \"$(date): file modified\" >> ./audit.log" }]
            }]
        }
    }
})) {
    console.log(message);
}