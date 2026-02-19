/**
 * Example 01: Basic Compaction — Demonstrates the core compaction workflow.
 *
 * This example builds a simulated Agent Loop conversation that exceeds the token
 * threshold, then runs compactMessages() to fully compress all messages after
 * the system prompt into a structured summary. Uses MockLlmClient for local
 * testing without API calls.
 *
 * Usage:
 *   npx tsx examples/01-basic-compact.ts
 */

import {
  compactMessages,
  shouldCompact,
  countTokens,
  resetCompactionCounter,
} from '../src/index.js';
import type { CompactOptions } from '../src/index.js';
import { NodeFileWriter } from '../src/infrastructure/file-writer.js';
import { MockLlmClient } from './mock-llm-client.js';
import { buildAgentConversation } from './message-factory.js';

const EXAMPLE_TOKEN_LIMIT = parseInt(process.env.EXAMPLE_TOKEN_LIMIT || '1000', 10);
const EXAMPLE_THRESHOLD_RATIO = parseFloat(process.env.EXAMPLE_THRESHOLD_RATIO || '0.8');

async function main() {
  console.log('=== Example 01: Basic Compaction ===\n');

  const llmClient = new MockLlmClient();
  const fileWriter = new NodeFileWriter();

  resetCompactionCounter();

  // Build a conversation with enough content to exceed the threshold
  // padding inflates each message to push total tokens over the limit
  const messages = buildAgentConversation(3, 200);

  console.log(`Message count: ${messages.length}`);
  console.log(`Roles: ${messages.map((m) => m.role).join(', ')}\n`);

  // Step 1: Count tokens
  const totalTokens = await countTokens(messages, llmClient);
  const threshold = EXAMPLE_TOKEN_LIMIT * EXAMPLE_THRESHOLD_RATIO;
  console.log(`Total tokens: ${totalTokens}`);
  console.log(`Token limit:  ${EXAMPLE_TOKEN_LIMIT}`);
  console.log(`Threshold:    ${threshold} (${EXAMPLE_THRESHOLD_RATIO * 100}%)`);
  console.log(`Needs compact: ${totalTokens >= threshold}\n`);

  // Step 2: Check shouldCompact
  const needsCompact = await shouldCompact(messages, llmClient, {
    contextTokenLimit: EXAMPLE_TOKEN_LIMIT,
    compactThresholdRatio: EXAMPLE_THRESHOLD_RATIO,
  });
  console.log(`shouldCompact() → ${needsCompact}\n`);

  if (!needsCompact) {
    console.log('Token count below threshold, try increasing turn count or padding.');
    console.log('Set EXAMPLE_TOKEN_LIMIT to a lower value, e.g.:');
    console.log('  EXAMPLE_TOKEN_LIMIT=500 npx tsx examples/01-basic-compact.ts');
    return;
  }

  // Step 3: Run compaction (v2: full compression, no tail retention)
  const options: CompactOptions = {
    contextTokenLimit: EXAMPLE_TOKEN_LIMIT,
    compactThresholdRatio: EXAMPLE_THRESHOLD_RATIO,
    llmClient,
    fileWriter,
    outputDir: '.compact-examples',
    sessionId: 'example-01',
    maxRestoreFiles: 0, // disable file restoration in this basic example
  };

  const result = await compactMessages(messages, options);

  // Step 4: Display results
  console.log('--- Compaction Result ---');
  console.log(`Compacted:      ${result.compacted}`);
  console.log(`Output path:    ${result.originalMessagesPath}`);

  if (result.stats) {
    console.log(`\n--- Statistics ---`);
    console.log(`Original tokens:   ${result.stats.originalTokenCount}`);
    console.log(`Compacted tokens:  ${result.stats.compactedTokenCount}`);
    console.log(`Compression ratio: ${(result.stats.compactionRatio * 100).toFixed(1)}%`);
    console.log(`Messages compacted: ${result.stats.compactedMessageCount}`);
    console.log(`Messages retained:  ${result.stats.retainedMessageCount}`);
    console.log(`Files restored:     ${result.stats.restoredFileCount}`);
    console.log(`Restored tokens:    ${result.stats.restoredTokenCount}`);
  }

  console.log(`\n--- Compacted Messages (${result.messages.length} total) ---`);
  for (const msg of result.messages) {
    const preview =
      typeof msg.content === 'string'
        ? msg.content.slice(0, 120)
        : JSON.stringify(msg.content).slice(0, 120);
    console.log(`  [${msg.role}] ${preview}...`);
  }

  console.log(`\nLlmClient calls — countTokens: ${llmClient.countTokensCalls}, summarize: ${llmClient.summarizeCalls}`);
}

main().catch(console.error);
