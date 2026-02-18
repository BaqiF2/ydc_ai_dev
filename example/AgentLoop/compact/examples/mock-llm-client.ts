/**
 * Mock LLM Client — Provides a local mock for testing without Anthropic API calls.
 *
 * Core exports:
 * - MockLlmClient — LlmClient mock that estimates tokens locally and returns canned summaries
 */

import type { LlmClient, Message } from '../src/core/types.js';
import { serializeMessage } from '../src/core/token-counter.js';

/** Average characters per token for estimation */
const CHARS_PER_TOKEN = parseInt(process.env.MOCK_CHARS_PER_TOKEN || '4', 10);

/**
 * Mock LlmClient for local testing.
 * - countTokens: estimates tokens based on character count (≈4 chars/token)
 * - summarize: returns a canned summary echoing the prompt length
 */
export class MockLlmClient implements LlmClient {
  public countTokensCalls = 0;
  public summarizeCalls = 0;

  async countTokens(messages: Message[], _model: string): Promise<number> {
    this.countTokensCalls++;
    let totalChars = 0;
    for (const msg of messages) {
      totalChars += serializeMessage(msg).length;
    }
    return Math.ceil(totalChars / CHARS_PER_TOKEN);
  }

  async summarize(prompt: string, _model: string): Promise<string> {
    this.summarizeCalls++;
    return [
      '## Conversation Summary',
      '',
      '### Goals and Decisions',
      '- The user requested a code refactoring of the authentication module',
      '- Decided to use JWT tokens instead of session-based auth',
      '',
      '### File Operations',
      '- Read: src/auth/session.ts, src/auth/middleware.ts',
      '- Created: src/auth/jwt.ts, src/auth/token-store.ts',
      '- Modified: src/routes/login.ts, src/routes/logout.ts',
      '- Deleted: src/auth/session-store.ts',
      '',
      '### Tool Calls',
      '- ReadFile: 4 calls (all success)',
      '- WriteFile: 3 calls (all success)',
      '- RunTests: 2 calls (1 success, 1 failure → fixed)',
      '',
      '### Current Status',
      '- JWT auth implementation: complete',
      '- Migration script: pending',
      '- Integration tests: need update',
      '',
      '### Errors and Resolutions',
      '- TypeError in token validation → fixed by adding null check',
      '',
      `[Mock summary generated from ${prompt.length} chars of input]`,
    ].join('\n');
  }
}
