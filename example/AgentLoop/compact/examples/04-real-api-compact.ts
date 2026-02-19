/**
 * Example 04: Real API Compaction — Demonstrates compaction using the
 * real Anthropic API. Requires ANTHROPIC_API_KEY environment variable.
 *
 * This example uses AnthropicLlmClient to perform actual token counting
 * and LLM summarization via the Anthropic API.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... npx tsx examples/04-real-api-compact.ts
 */

import {
  compactMessages,
  countTokens,
  AnthropicLlmClient,
  NodeFileWriter,
  resetCompactionCounter,
} from '../src/index.js';
import type { CompactOptions } from '../src/index.js';
import { buildAgentConversation } from './message-factory.js';

const TOKEN_LIMIT = parseInt(process.env.EXAMPLE_TOKEN_LIMIT || '1000', 10);

async function main() {
  console.log('=== Example 04: Real API Compaction ===\n');

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is required.');
    console.error('Usage: ANTHROPIC_API_KEY=sk-... npx tsx examples/04-real-api-compact.ts');
    process.exit(1);
  }

  const llmClient = new AnthropicLlmClient();
  const fileWriter = new NodeFileWriter();
  resetCompactionCounter();

  // Build conversation — no padding needed, real token counting
  const messages = buildAgentConversation(5);

  console.log(`Messages: ${messages.length}`);

  // Count tokens via Anthropic API
  const totalTokens = await countTokens(messages, llmClient);
  const threshold = TOKEN_LIMIT * 0.8;

  console.log(`Tokens:    ${totalTokens}`);
  console.log(`Limit:     ${TOKEN_LIMIT}`);
  console.log(`Threshold: ${threshold}\n`);

  if (totalTokens < threshold) {
    console.log('Token count below threshold. Try lowering EXAMPLE_TOKEN_LIMIT:');
    console.log(`  EXAMPLE_TOKEN_LIMIT=2000 ANTHROPIC_API_KEY=sk-... npx tsx examples/04-real-api-compact.ts`);
    return;
  }

  // Run compaction with real API
  console.log('Running compaction with Anthropic API...\n');

  const options: CompactOptions = {
    contextTokenLimit: TOKEN_LIMIT,
    compactThresholdRatio: 0.8,
    llmClient,
    fileWriter,
    outputDir: '.compact-examples',
    sessionId: 'example-04-real-api',
    maxRestoreFiles: 0,
  };

  const result = await compactMessages(messages, options);

  console.log('--- Result ---');
  console.log(`Compacted: ${result.compacted}`);

  if (result.stats) {
    console.log(`\n--- Statistics ---`);
    console.log(`Original tokens:    ${result.stats.originalTokenCount}`);
    console.log(`Compacted tokens:   ${result.stats.compactedTokenCount}`);
    console.log(`Compression ratio:  ${(result.stats.compactionRatio * 100).toFixed(1)}%`);
    console.log(`Messages compacted: ${result.stats.compactedMessageCount}`);
    console.log(`Messages retained:  ${result.stats.retainedMessageCount}`);
  }

  if (result.originalMessagesPath) {
    console.log(`\nOriginal messages saved to: ${result.originalMessagesPath}`);
  }

  // Show the summary message
  const summaryMsg = result.messages.find(
    (m) => m.role === 'user' && typeof m.content === 'string' && m.content.includes('Summary'),
  );
  if (summaryMsg) {
    console.log(`\n--- Generated Summary ---`);
    console.log(typeof summaryMsg.content === 'string' ? summaryMsg.content : '[complex content]');
  }
}

main().catch(console.error);
