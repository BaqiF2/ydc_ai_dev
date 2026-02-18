/**
 * Context Compact — Public API
 *
 * Provides the public interface for the context compaction module.
 * Assembles core logic with infrastructure implementations.
 *
 * Core exports:
 * - compactMessages — Main entry: detect, partition, summarize, persist, assemble
 * - shouldCompact — Check if messages exceed the compaction threshold
 * - countTokens — Count total tokens in a message list
 * - AnthropicLlmClient — LlmClient implementation using Anthropic SDK
 * - estimateTokens — Local fallback for token estimation when API is unavailable
 * - NodeFileWriter — FileWriter implementation using Node.js fs
 * - All types from core/types.ts
 */

// Core logic
export { compactMessages, shouldCompact, resetCompactionCounter } from './core/compact.js';
export { countTokens } from './core/token-counter.js';
export { summarize } from './core/summarizer.js';

// Infrastructure implementations
export { AnthropicLlmClient, estimateTokens } from './infrastructure/llm-client.js';
export { NodeFileWriter } from './infrastructure/file-writer.js';

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
  Logger,
} from './core/types.js';

export { defaultLogger } from './core/types.js';
