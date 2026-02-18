/**
 * Example 02: Multiple Compactions — Demonstrates successive compactions
 * simulating a long-running Agent Loop session where token limit is hit
 * multiple times.
 *
 * The example runs compaction, then adds more messages to simulate continued
 * conversation, triggering a second compaction pass.
 *
 * Usage:
 *   npx tsx examples/02-multi-compact.ts
 */

import {
  compactMessages,
  countTokens,
  resetCompactionCounter,
} from '../src/index.js';
import type { CompactOptions } from '../src/index.js';
import { NodeFileWriter } from '../src/infrastructure/file-writer.js';
import { MockLlmClient } from './mock-llm-client.js';
import {
  buildAgentConversation,
  createUserMessage,
  createAssistantMessage,
} from './message-factory.js';

const TOKEN_LIMIT = parseInt(process.env.EXAMPLE_TOKEN_LIMIT || '1000', 10);

function makeOptions(llmClient: MockLlmClient): CompactOptions {
  return {
    contextTokenLimit: TOKEN_LIMIT,
    compactThresholdRatio: 0.8,
    tailRetentionRatio: 0.15,
    llmClient,
    fileWriter: new NodeFileWriter(),
    outputDir: '.compact-examples',
    sessionId: 'example-02',
  };
}

async function main() {
  console.log('=== Example 02: Multiple Compactions ===\n');

  const llmClient = new MockLlmClient();
  resetCompactionCounter();

  // --- Round 1: Build initial conversation and compact ---
  let messages = buildAgentConversation(3, 200);
  console.log(`[Round 1] Initial messages: ${messages.length}`);
  console.log(`[Round 1] Tokens: ${await countTokens(messages, llmClient)}\n`);

  let result = await compactMessages(messages, makeOptions(llmClient));
  messages = result.messages;

  console.log(`[Round 1] Compacted: ${result.compacted}`);
  console.log(`[Round 1] Messages after compact: ${messages.length}`);
  if (result.stats) {
    console.log(`[Round 1] ${result.stats.originalTokenCount} → ${result.stats.compactedTokenCount} tokens (${(result.stats.compactionRatio * 100).toFixed(1)}%)`);
  }
  console.log(`[Round 1] Persisted: ${result.originalMessagesPath}\n`);

  // --- Simulate continued conversation ---
  console.log('--- Simulating continued conversation ---\n');
  const additionalMessages = [
    createUserMessage('Now let\'s add OAuth2 integration for Google login. ' + 'x'.repeat(300)),
    createAssistantMessage('I\'ll implement OAuth2 Google login:\n1. Install passport-google-oauth20\n2. Configure strategy\n3. Add callback route\n4. Update user model' + 'x'.repeat(300)),
    createUserMessage('Also add GitHub OAuth as an alternative provider.' + 'x'.repeat(300)),
    createAssistantMessage('Adding GitHub OAuth:\n1. Install passport-github2\n2. Configure GitHub strategy\n3. Add callback route\n4. Unify OAuth user creation' + 'x'.repeat(300)),
    createUserMessage('Let\'s also set up a session store in Redis for production.' + 'x'.repeat(300)),
    createAssistantMessage('Setting up Redis session store:\n1. Install connect-redis\n2. Configure Redis client\n3. Update session middleware\n4. Add health check for Redis connection' + 'x'.repeat(300)),
  ];

  messages.push(...additionalMessages);
  console.log(`[Round 2] Messages after adding: ${messages.length}`);
  console.log(`[Round 2] Tokens: ${await countTokens(messages, llmClient)}\n`);

  // --- Round 2: Compact again ---
  result = await compactMessages(messages, makeOptions(llmClient));
  messages = result.messages;

  console.log(`[Round 2] Compacted: ${result.compacted}`);
  console.log(`[Round 2] Messages after compact: ${messages.length}`);
  if (result.stats) {
    console.log(`[Round 2] ${result.stats.originalTokenCount} → ${result.stats.compactedTokenCount} tokens (${(result.stats.compactionRatio * 100).toFixed(1)}%)`);
    console.log(`[Round 2] Compacted ${result.stats.compactedMessageCount} messages, retained ${result.stats.retainedMessageCount}`);
  }
  console.log(`[Round 2] Persisted: ${result.originalMessagesPath}\n`);

  // --- Final summary ---
  console.log('--- Final State ---');
  console.log(`Total messages: ${messages.length}`);
  console.log(`Total tokens:   ${await countTokens(messages, llmClient)}`);
  console.log(`\nLlmClient calls — countTokens: ${llmClient.countTokensCalls}, summarize: ${llmClient.summarizeCalls}`);
}

main().catch(console.error);
