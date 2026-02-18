/**
 * Core Compact Algorithm — Orchestrates the full context compaction workflow.
 *
 * Core exports:
 * - compactMessages — Main entry: detect, partition, summarize, persist, assemble
 * - shouldCompact — Check if messages exceed the compaction threshold
 * - partitionMessages — Split messages into head / middle / tail regions
 * - assembleMessages — Combine head + summary message + tail into new list
 */

import type {
  Message,
  CompactOptions,
  CompactResult,
  PartitionResult,
  LlmClient,
  FileWriter,
  Logger,
} from './types.js';
import {
  CONTEXT_TOKEN_LIMIT,
  COMPACT_THRESHOLD_RATIO,
  TAIL_RETENTION_RATIO,
  SUMMARY_MODEL,
  COMPACT_MAX_RETRIES,
  COMPACT_OUTPUT_DIR,
  defaultLogger,
} from './types.js';
import { countTokens } from './token-counter.js';
import { summarize } from './summarizer.js';

/**
 * Check whether the current message list exceeds the compaction threshold.
 */
export async function shouldCompact(
  messages: Message[],
  llmClient: LlmClient,
  options?: CompactOptions,
): Promise<boolean> {
  if (messages.length === 0) {
    return false;
  }

  const limit = options?.contextTokenLimit ?? CONTEXT_TOKEN_LIMIT;
  const ratio = options?.compactThresholdRatio ?? COMPACT_THRESHOLD_RATIO;
  const model = options?.summaryModel ?? SUMMARY_MODEL;
  const threshold = limit * ratio;
  const totalTokens = await countTokens(messages, llmClient, model);

  return totalTokens >= threshold;
}

/**
 * Partition messages into head (system prompts), middle (compaction target),
 * and tail (retained recent messages) regions.
 */
export async function partitionMessages(
  messages: Message[],
  tailRetentionTokens: number,
  llmClient: LlmClient,
  model: string = SUMMARY_MODEL,
): Promise<PartitionResult> {
  // Head: consecutive system messages from the start
  let headEnd = 0;
  while (headEnd < messages.length && messages[headEnd].role === 'system') {
    headEnd++;
  }
  const head = messages.slice(0, headEnd);

  // Tail: scan from end, accumulate tokens until budget is reached
  let tailStart = messages.length;
  let tailTokens = 0;

  for (let i = messages.length - 1; i >= headEnd; i--) {
    const msgTokens = await countTokens([messages[i]], llmClient, model);
    tailTokens += msgTokens;
    tailStart = i;
    if (tailTokens >= tailRetentionTokens) {
      break;
    }
  }

  const tail = messages.slice(tailStart);
  const middle = messages.slice(headEnd, tailStart);

  return { head, middle, tail };
}

/**
 * Assemble the final message list from head, summary text, and tail.
 * Returns a new array without modifying the inputs.
 */
export function assembleMessages(
  head: Message[],
  summary: string,
  tail: Message[],
): Message[] {
  const summaryMessage: Message = {
    role: 'user',
    content: summary,
  };
  return [...head, summaryMessage, ...tail];
}

/**
 * Persist the original middle messages to a JSON file before compaction.
 */
async function persistOriginalMessages(
  middleMessages: Message[],
  outputDir: string,
  sessionId: string,
  sequence: number,
  fileWriter: FileWriter,
  logger: Logger,
): Promise<string | null> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `compact-${timestamp}-${sequence}.json`;
  const filePath = `${outputDir}/${sessionId}/${fileName}`;

  try {
    const content = JSON.stringify(middleMessages, null, 2);
    await fileWriter.write(filePath, content);
    return filePath;
  } catch (err) {
    logger.error('Failed to persist original messages', {
      filePath,
      error: String(err),
    });
    return null;
  }
}

/**
 * Attempt summarization with retry logic.
 */
async function summarizeWithRetry(
  middleMessages: Message[],
  llmClient: LlmClient,
  model: string,
  maxRetries: number,
  logger: Logger,
): Promise<string | null> {
  const totalAttempts = 1 + maxRetries;

  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    try {
      return await summarize(middleMessages, llmClient, model);
    } catch (err) {
      logger.warn('Summarization attempt failed', {
        attempt,
        totalAttempts,
        error: String(err),
      });

      if (attempt < totalAttempts) {
        // Simple exponential backoff: 1s, 2s, 4s, ...
        const delayMs = Math.pow(2, attempt - 1) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  logger.error('All summarization attempts failed, skipping compaction', {
    totalAttempts,
  });
  return null;
}

/**
 * Detect the next sequence number for persistence files in the session.
 */
function getNextSequence(_existingPath: string | null): number {
  // For simplicity, use a module-level counter per session.
  // In production, this could scan the directory for existing files.
  return compactionCounter++;
}

let compactionCounter = 1;

/**
 * Reset the compaction counter (for testing purposes).
 */
export function resetCompactionCounter(): void {
  compactionCounter = 1;
}

/**
 * Main entry point: detect whether compaction is needed, and if so,
 * partition messages, generate a summary, persist originals, and
 * assemble the compacted message list.
 */
export async function compactMessages(
  messages: Message[],
  options?: CompactOptions,
): Promise<CompactResult> {
  const logger = options?.logger ?? defaultLogger;
  const llmClient = options?.llmClient;
  const fileWriter = options?.fileWriter;

  if (!llmClient) {
    throw new Error('llmClient is required in CompactOptions');
  }

  if (!fileWriter) {
    throw new Error('fileWriter is required in CompactOptions');
  }

  const limit = options?.contextTokenLimit ?? CONTEXT_TOKEN_LIMIT;
  const ratio = options?.compactThresholdRatio ?? COMPACT_THRESHOLD_RATIO;
  const tailRatio = options?.tailRetentionRatio ?? TAIL_RETENTION_RATIO;
  const model = options?.summaryModel ?? SUMMARY_MODEL;
  const maxRetries = options?.maxRetries ?? COMPACT_MAX_RETRIES;
  const outputDir = options?.outputDir ?? COMPACT_OUTPUT_DIR;
  const sessionId = options?.sessionId ?? 'default';

  // Step 1: Check if compaction is needed
  const threshold = limit * ratio;
  const originalTokenCount = await countTokens(messages, llmClient, model);

  if (originalTokenCount < threshold) {
    return {
      messages,
      compacted: false,
      stats: null,
      originalMessagesPath: null,
    };
  }

  logger.info('Context compaction triggered', {
    originalTokenCount,
    threshold,
  });

  // Step 2: Partition messages
  const tailRetentionTokens = limit * tailRatio;
  const { head, middle, tail } = await partitionMessages(
    messages,
    tailRetentionTokens,
    llmClient,
    model,
  );

  // Step 3: Check if middle is empty (nothing to compact)
  if (middle.length === 0) {
    logger.info('No middle messages to compact, skipping');
    return {
      messages,
      compacted: false,
      stats: null,
      originalMessagesPath: null,
    };
  }

  // Step 4: Persist original messages
  const sequence = getNextSequence(null);
  const originalMessagesPath = await persistOriginalMessages(
    middle,
    outputDir,
    sessionId,
    sequence,
    fileWriter,
    logger,
  );

  // Step 5: Generate summary with retry
  const summaryText = await summarizeWithRetry(
    middle,
    llmClient,
    model,
    maxRetries,
    logger,
  );

  if (summaryText === null) {
    return {
      messages,
      compacted: false,
      stats: null,
      originalMessagesPath,
    };
  }

  // Step 6: Assemble compacted messages
  const compactedMessages = assembleMessages(head, summaryText, tail);
  const compactedTokenCount = await countTokens(
    compactedMessages,
    llmClient,
    model,
  );

  const stats = {
    originalTokenCount,
    compactedTokenCount,
    compactionRatio: compactedTokenCount / originalTokenCount,
    compactedMessageCount: middle.length,
    retainedMessageCount: head.length + tail.length,
  };

  logger.info('Context compaction completed', {
    originalTokenCount: stats.originalTokenCount,
    compactedTokenCount: stats.compactedTokenCount,
    compactionRatio: stats.compactionRatio.toFixed(3),
    compactedMessageCount: stats.compactedMessageCount,
  });

  return {
    messages: compactedMessages,
    compacted: true,
    stats,
    originalMessagesPath,
  };
}
