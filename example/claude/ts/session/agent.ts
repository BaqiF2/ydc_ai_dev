import { query } from "@anthropic-ai/claude-agent-sdk";

let sessionId: string | undefined;

// First query: capture the session ID
for await (const message of query({
    prompt: "Read the authentication module",
    options: { allowedTools: ["Read", "Glob"] }
})) {
    if (message.type === "system" && message.subtype === "init") {
        sessionId = message.session_id;
    }
}

// Resume with full context from the first query
for await (const message of query({
    prompt: "Now find all places that call it",  // "it" = auth module
    options: { resume: sessionId }
})) {
    console.log(message)
}