import {query} from "@anthropic-ai/claude-agent-sdk";
import * as readline from "readline";

// Agentic loop: streams messages as Claude works
// @ts-ignore
async function queryAgent(prompt: string) {
    // Wrap the for await loop in an async IIFE (Immediately Invoked Function Expression)
    // @ts-ignore
    await (async () => {
        // @ts-ignore
        for await (const message of query({
            prompt: prompt,
            options: {
                allowedTools: ["Read", "Edit", "Glob", "WebSearch", "Bash"],  // Tools Claude can use
                permissionMode: "acceptEdits",            // Auto-approve file edits
                systemPrompt: "你是一个AI助手，帮我用户完成任务",
            }
        })) {
            // Print human-readable output
            if (message.type === "assistant" && message.message?.content) {
                for (const block of message.message.content) {
                    if ("text" in block) {
                        console.log(block.text);             // Claude's reasoning
                    } else if ("name" in block) {
                        console.log(`Tool: ${block.name}`);  // Tool being called
                    }
                }
            } else if (message.type === "result") {
                console.log(`Done: ${message.subtype}`); // Final result
            }
        }
    })();
}

// Create readline interface to get user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question("请输入您的提示 (prompt): ", (userPrompt) => {
    queryAgent(userPrompt);
    rl.close();
});