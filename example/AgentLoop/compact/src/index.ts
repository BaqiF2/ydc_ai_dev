/**
 * Context Compact — Public API (v2)
 *
 * Provides the public interface for the context compaction module.
 * Assembles core logic with infrastructure implementations.
 *
 * Core exports:
 * - compactMessages — Main entry: detect, partition, summarize, restore files, assemble
 * - shouldCompact — Check if messages exceed the compaction threshold
 * - restoreRecentFiles — Scan messages for read_file calls and restore file contents from disk
 * - countTokens — Count total tokens in a message list
 * - AnthropicLlmClient — LlmClient implementation using Anthropic SDK
 * - estimateTokens — Local fallback for token estimation when API is unavailable
 * - estimateStringTokens — Estimate token count for a plain text string
 * - NodeFileWriter — FileWriter implementation using Node.js fs
 * - NodeFileReader — FileReader implementation using Node.js fs
 * - All types from core/types.ts
 */

// Core logic
export { compactMessages, shouldCompact, restoreRecentFiles, resetCompactionCounter } from './core/compact.js';
export { countTokens } from './core/token-counter.js';
export { summarize } from './core/summarizer.js';

// Infrastructure implementations
export { AnthropicLlmClient, estimateTokens, estimateStringTokens } from './infrastructure/llm-client.js';
export { NodeFileWriter } from './infrastructure/file-writer.js';
export { NodeFileReader } from './infrastructure/file-reader.js';

// Types
export type {
  Message,
  ContentBlock,
  TextBlock,
  ToolUseBlock,
  ToolResultBlock,
  CompactOptions,
  CompactResult,
  CompactStats,
  PartitionResult,
  LlmClient,
  FileWriter,
  FileReader,
  Logger,
} from './core/types.js';

export { defaultLogger } from './core/types.js';
