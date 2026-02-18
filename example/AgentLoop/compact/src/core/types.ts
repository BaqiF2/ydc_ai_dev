/**
 * Context Compact — Core Type Definitions
 *
 * Defines all types, interfaces, and constants for the context compaction module.
 *
 * Core exports:
 * - Message, ContentBlock, TextBlock, ToolUseBlock, ToolResultBlock — Message model types
 * - CompactOptions — Configuration options for compaction behavior
 * - CompactResult — Return type of compactMessages()
 * - CompactStats — Compression statistics
 * - LlmClient — Interface for LLM operations (token counting + summarization)
 * - FileWriter — Interface for file persistence
 * - Logger — Interface for logging
 * - defaultLogger — Default console-based Logger implementation
 * - CONTEXT_TOKEN_LIMIT, COMPACT_THRESHOLD_RATIO, etc. — Configurable constants
 */

// ---------------------------------------------------------------------------
// Configuration constants (all overridable via environment variables)
// ---------------------------------------------------------------------------

const CONTEXT_TOKEN_LIMIT = parseInt(
  process.env.CONTEXT_TOKEN_LIMIT || '200000',
  10,
);

const COMPACT_THRESHOLD_RATIO = parseFloat(
  process.env.COMPACT_THRESHOLD_RATIO || '0.92',
);

const TAIL_RETENTION_RATIO = parseFloat(
  process.env.TAIL_RETENTION_RATIO || '0.15',
);

const SUMMARY_MODEL = process.env.SUMMARY_MODEL || 'claude-haiku-4-5-20251001';

const COMPACT_MAX_RETRIES = parseInt(
  process.env.COMPACT_MAX_RETRIES || '2',
  10,
);

const COMPACT_OUTPUT_DIR = process.env.COMPACT_OUTPUT_DIR || '.compact';

const SUMMARY_MAX_WORDS = parseInt(
  process.env.SUMMARY_MAX_WORDS || '800',
  10,
);

export {
  CONTEXT_TOKEN_LIMIT,
  COMPACT_THRESHOLD_RATIO,
  TAIL_RETENTION_RATIO,
  SUMMARY_MODEL,
  COMPACT_MAX_RETRIES,
  COMPACT_OUTPUT_DIR,
  SUMMARY_MAX_WORDS,
};

// ---------------------------------------------------------------------------
// Message model types
// ---------------------------------------------------------------------------

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | ContentBlock[];
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentBlock[];
}

// ---------------------------------------------------------------------------
// Compact operation types
// ---------------------------------------------------------------------------

export interface CompactOptions {
  contextTokenLimit?: number;
  compactThresholdRatio?: number;
  tailRetentionRatio?: number;
  summaryModel?: string;
  maxRetries?: number;
  outputDir?: string;
  sessionId?: string;
  llmClient?: LlmClient;
  fileWriter?: FileWriter;
  logger?: Logger;
}

export interface CompactStats {
  originalTokenCount: number;
  compactedTokenCount: number;
  compactionRatio: number;
  compactedMessageCount: number;
  retainedMessageCount: number;
}

export interface CompactResult {
  messages: Message[];
  compacted: boolean;
  stats: CompactStats | null;
  originalMessagesPath: string | null;
}

export interface PartitionResult {
  head: Message[];
  middle: Message[];
  tail: Message[];
}

// ---------------------------------------------------------------------------
// Dependency injection interfaces
// ---------------------------------------------------------------------------

export interface LlmClient {
  countTokens(messages: Message[], model: string): Promise<number>;
  summarize(prompt: string, model: string): Promise<string>;
}

export interface FileWriter {
  write(filePath: string, content: string): Promise<void>;
}

export interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

// ---------------------------------------------------------------------------
// Default logger implementation
// ---------------------------------------------------------------------------

export const defaultLogger: Logger = {
  info: (msg, ctx) => console.log(`[INFO] ${msg}`, ctx ?? ''),
  warn: (msg, ctx) => console.warn(`[WARN] ${msg}`, ctx ?? ''),
  error: (msg, ctx) => console.error(`[ERROR] ${msg}`, ctx ?? ''),
};
