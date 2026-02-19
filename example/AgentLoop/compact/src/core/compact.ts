/**
 * Core Compact Algorithm — Orchestrates the full context compaction workflow (v2).
 *
 * v2 strategy: fully compress all messages after Head, then restore recently-read
 * files from disk. This maximizes token savings while preserving critical file context.
 *
 * Core exports:
 * - compactMessages — Main entry: detect, partition, summarize, restore files, assemble
 * - shouldCompact — Check if messages exceed the compaction threshold
 * - partitionMessages — Split messages into Head (system prompts) / Rest (everything else)
 * - assembleMessages — Combine head + summary pair + restored file pairs into new list
 * - restoreRecentFiles — Scan messages for read_file calls and restore file contents from disk
 */

import { resolve } from 'node:path';
import type {
  Message,
  CompactOptions,
  CompactResult,
  PartitionResult,
  LlmClient,
  FileWriter,
  FileReader,
  Logger,
} from './types.js';
import {
  CONTEXT_TOKEN_LIMIT,
  COMPACT_THRESHOLD_RATIO,
  SUMMARY_MODEL,
  COMPACT_MAX_RETRIES,
  COMPACT_OUTPUT_DIR,
  MAX_RESTORE_FILES,
  MAX_RESTORE_TOKENS_PER_FILE,
  MAX_RESTORE_TOKENS_TOTAL,
  defaultLogger,
} from './types.js';
import { countTokens } from './token-counter.js';
import { summarize } from './summarizer.js';
import { estimateStringTokens } from '../infrastructure/llm-client.js';
import { NodeFileReader } from '../infrastructure/file-reader.js';

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
 * Partition messages into Head (system prompts) and Rest (compaction target).
 * Pure function — no async, no token counting needed.
 */
export function partitionMessages(
  messages: Message[],
): PartitionResult {
  let headEnd = 0;
  while (headEnd < messages.length && messages[headEnd].role === 'system') {
    headEnd++;
  }
  return {
    head: messages.slice(0, headEnd),
    rest: messages.slice(headEnd),
  };
}

/**
 * Scan messages for read_file tool_use blocks and restore recent files from disk.
 */
export async function restoreRecentFiles(
  messages: Message[],
  options: {
    maxRestoreFiles: number;
    maxRestoreTokensPerFile: number;
    maxRestoreTokensTotal: number;
    workDir: string;
    fileReader: FileReader;
    logger: Logger;
  },
): Promise<{ messages: Message[]; totalTokens: number }> {
  const {
    maxRestoreFiles,
    maxRestoreTokensPerFile,
    maxRestoreTokensTotal,
    workDir,
    fileReader,
    logger,
  } = options;

  if (maxRestoreFiles <= 0) {
    return { messages: [], totalTokens: 0 };
  }

  // Step 1: Scan all assistant messages for read_file tool_use blocks
  const pathOrderMap = new Map<string, number>();
  let orderIndex = 0;

  for (const msg of messages) {
    if (msg.role !== 'assistant' || typeof msg.content === 'string') {
      continue;
    }
    for (const block of msg.content) {
      if (block.type === 'tool_use' && block.name === 'read_file') {
        const filePath = (block.input as { path?: string }).path;
        if (filePath) {
          pathOrderMap.set(filePath, orderIndex);
          orderIndex++;
        }
      }
    }
  }

  if (pathOrderMap.size === 0) {
    return { messages: [], totalTokens: 0 };
  }

  // Step 2: Sort by order descending (most recent first)
  const sortedPaths = [...pathOrderMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([path]) => path);

  // Step 3: Take first maxRestoreFiles paths
  const candidates = sortedPaths.slice(0, maxRestoreFiles);

  // Step 4: Read files and build restore messages
  const restoredMessages: Message[] = [];
  let cumulativeTokens = 0;

  for (const filePath of candidates) {
    // Resolve relative to workDir
    const resolvedPath = resolve(workDir, filePath);

    // Security check: resolved path must start with workDir
    const normalizedWorkDir = resolve(workDir);
    if (!resolvedPath.startsWith(normalizedWorkDir)) {
      logger.warn('Path traversal detected, skipping file', {
        filePath,
        resolvedPath,
        workDir: normalizedWorkDir,
      });
      continue;
    }

    // Check file exists
    const fileExists = await fileReader.exists(resolvedPath);
    if (!fileExists) {
      logger.warn('File not found, skipping restoration', {
        filePath: resolvedPath,
      });
      continue;
    }

    // Read file content
    let content: string;
    try {
      content = await fileReader.read(resolvedPath);
    } catch (err) {
      logger.warn('Failed to read file, skipping restoration', {
        filePath: resolvedPath,
        error: String(err),
      });
      continue;
    }

    // Estimate tokens
    const fileTokens = estimateStringTokens(content);

    // Skip if exceeds per-file limit
    if (fileTokens > maxRestoreTokensPerFile) {
      logger.warn('File exceeds per-file token limit, skipping', {
        filePath: resolvedPath,
        fileTokens,
        maxRestoreTokensPerFile,
      });
      continue;
    }

    // Stop if cumulative exceeds total limit
    if (cumulativeTokens + fileTokens > maxRestoreTokensTotal) {
      logger.info('Total restore token limit reached, stopping file restoration', {
        cumulativeTokens,
        fileTokens,
        maxRestoreTokensTotal,
      });
      break;
    }

    cumulativeTokens += fileTokens;
    restoredMessages.push({
      role: 'user',
      content: `[Restored after compact] ${filePath}:\n${content}`,
    });
  }

  return { messages: restoredMessages, totalTokens: cumulativeTokens };
}

/**
 * Assemble the final message list from head, summary text, and restored file messages.
 * Returns a new array without modifying the inputs.
 */
export function assembleMessages(
  head: Message[],
  summary: string,
  restoredFiles: Message[],
): Message[] {
  const result: Message[] = [
    ...head,
    { role: 'user', content: `[Conversation compressed]\n\n${summary}` },
    { role: 'assistant', content: 'Understood. I have the context from the compressed conversation. Continuing work.' },
  ];

  for (const rf of restoredFiles) {
    result.push(rf);
    result.push({ role: 'assistant', content: 'Noted, file content restored.' });
  }

  return result;
}

/**
 * Persist the original rest messages to a JSON file before compaction.
 */
async function persistOriginalMessages(
  restMessages: Message[],
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
    const content = JSON.stringify(restMessages, null, 2);
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
  restMessages: Message[],
  llmClient: LlmClient,
  model: string,
  maxRetries: number,
  logger: Logger,
): Promise<string | null> {
  const totalAttempts = 1 + maxRetries;

  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    try {
      return await summarize(restMessages, llmClient, model);
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
 * partition messages, generate a summary, restore files, persist originals,
 * and assemble the compacted message list.
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
  const model = options?.summaryModel ?? SUMMARY_MODEL;
  const maxRetries = options?.maxRetries ?? COMPACT_MAX_RETRIES;
  const outputDir = options?.outputDir ?? COMPACT_OUTPUT_DIR;
  const sessionId = options?.sessionId ?? 'default';
  const fileReader = options?.fileReader ?? new NodeFileReader();
  const workDir = options?.workDir ?? process.cwd();
  const maxRestoreFiles = options?.maxRestoreFiles ?? MAX_RESTORE_FILES;
  const maxRestoreTokensPerFile = options?.maxRestoreTokensPerFile ?? MAX_RESTORE_TOKENS_PER_FILE;
  const maxRestoreTokensTotal = options?.maxRestoreTokensTotal ?? MAX_RESTORE_TOKENS_TOTAL;

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

  // Step 2: Partition messages into head/rest
  const { head, rest } = partitionMessages(messages);

  // Step 3: Check if rest is empty (nothing to compact)
  if (rest.length === 0) {
    logger.info('No rest messages to compact, skipping');
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
    rest,
    outputDir,
    sessionId,
    sequence,
    fileWriter,
    logger,
  );

  // Step 5: Generate summary with retry
  const summaryText = await summarizeWithRetry(
    rest,
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

  // Step 6: Restore recent files from disk
  const { messages: restoredFileMessages, totalTokens: restoredTokenCount } =
    await restoreRecentFiles(messages, {
      maxRestoreFiles,
      maxRestoreTokensPerFile,
      maxRestoreTokensTotal,
      workDir,
      fileReader,
      logger,
    });

  // Step 7: Assemble compacted messages
  const compactedMessages = assembleMessages(head, summaryText, restoredFileMessages);
  const compactedTokenCount = await countTokens(
    compactedMessages,
    llmClient,
    model,
  );

  const stats = {
    originalTokenCount,
    compactedTokenCount,
    compactionRatio: compactedTokenCount / originalTokenCount,
    compactedMessageCount: rest.length,
    retainedMessageCount: head.length,
    restoredFileCount: restoredFileMessages.length,
    restoredTokenCount,
  };

  logger.info('Context compaction completed', {
    originalTokenCount: stats.originalTokenCount,
    compactedTokenCount: stats.compactedTokenCount,
    compactionRatio: stats.compactionRatio.toFixed(3),
    compactedMessageCount: stats.compactedMessageCount,
    restoredFileCount: stats.restoredFileCount,
    restoredTokenCount: stats.restoredTokenCount,
  });

  return {
    messages: compactedMessages,
    compacted: true,
    stats,
    originalMessagesPath,
  };
}
