/**
 * Summarizer — Constructs prompts and delegates summarization to LlmClient.
 *
 * Core exports:
 * - summarize — Generate a structured summary of middle messages via LLM
 * - buildSummarizePrompt — Construct the summarization prompt text
 * - serializeForSummary — Serialize messages into readable format for LLM input
 */

import type { Message, LlmClient } from './types.js';
import { SUMMARY_MODEL, SUMMARY_MAX_WORDS } from './types.js';
import { serializeMessage } from './token-counter.js';

/**
 * Serialize a list of messages into a human-readable conversation transcript
 * suitable for LLM summarization input.
 */
export function serializeForSummary(messages: Message[]): string {
  return messages
    .map((msg, i) => {
      const content = serializeMessage(msg);
      return `[${i + 1}] [${msg.role}]\n${content}`;
    })
    .join('\n\n---\n\n');
}

/**
 * Build the prompt for the summarization LLM call.
 */
export function buildSummarizePrompt(
  serializedMessages: string,
): string {
  return `<INSTRUCTIONS>
You are a conversation summarizer for an AI agent system. Your task is to create a structured summary of the conversation history below. This summary will replace the original messages to save context space, so it must preserve all critical information needed to continue the conversation.

Rules:
1. Preserve ALL of the following dimensions that are present in the conversation (skip dimensions that do not apply):
   - **Conversation goals and key decisions** — What was the user trying to accomplish? What important choices were made?
   - **File operations** — Which files were read, created, modified, or deleted? List specific file paths.
   - **Tool call summary** — Which tools were called, what were the key results (success/failure)?
   - **Current task status** — What has been completed? What remains to be done?
   - **Errors and resolutions** — What errors occurred and how were they resolved?

2. For each dimension, include 3-5 bullet points maximum, each no longer than 2 sentences.
3. If a dimension has no relevant content in the conversation, omit that section entirely.
4. Total summary length MUST NOT exceed ${SUMMARY_MAX_WORDS} words.
5. Always output in English.
</INSTRUCTIONS>

<OUTPUT_FORMAT>
Use the following Markdown structure:

## Summary

### Goals & Decisions
- [bullet points]

### File Operations
- [bullet points with file paths]

### Tool Calls
- [bullet points: tool name → result]

### Task Status
- Completed: [items]
- Remaining: [items]

### Errors & Resolutions
- [bullet points]
</OUTPUT_FORMAT>

<CONVERSATION_HISTORY>
${serializedMessages}
</CONVERSATION_HISTORY>`;
}

/**
 * Generate a structured summary of the middle messages by calling the LLM.
 * Throws an error if the LLM returns empty content.
 */
export async function summarize(
  middleMessages: Message[],
  llmClient: LlmClient,
  model: string = SUMMARY_MODEL,
): Promise<string> {
  const serialized = serializeForSummary(middleMessages);
  const prompt = buildSummarizePrompt(serialized);
  const result = await llmClient.summarize(prompt, model);

  if (!result || result.trim().length === 0) {
    throw new Error('LLM returned empty summary content');
  }

  return result;
}
