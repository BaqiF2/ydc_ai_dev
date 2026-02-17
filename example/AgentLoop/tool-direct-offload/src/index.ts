/**
 * Tool Direct Offload — Public API Entry Point
 *
 * Provides the convenient API for offloading tool results using the default
 * NodeFileWriter. Also re-exports core types and the lower-level API for
 * advanced usage and testing.
 *
 * Core exports:
 * - offloadToolResult: Convenient API with default NodeFileWriter
 * - offloadToolResultWithWriter: Lower-level API accepting custom FileWriter (re-export)
 * - All types from core/types
 */

import { offloadToolResult as coreOffloadToolResult } from './core/offload.js';
import { NodeFileWriter } from './infrastructure/file-writer.js';
import type { Message, OffloadResult } from './core/types.js';

/**
 * Convenient API for offloading a single tool_result message.
 * Uses the default NodeFileWriter internally.
 *
 * @param message - The tool_result message to offload
 * @param options - Configuration with sessionId and outputDir
 * @returns OffloadResult with the new message, freed chars count, and file path
 */
export async function offloadToolResult(
  message: Message,
  options: { sessionId: string; outputDir: string },
): Promise<OffloadResult> {
  const writer = new NodeFileWriter();
  return coreOffloadToolResult(message, options.sessionId, options.outputDir, writer);
}

// Re-export core API for advanced usage / testing
export { offloadToolResult as offloadToolResultWithWriter } from './core/offload.js';

// Re-export all types
export type {
  Message,
  TextBlock,
  ToolUseBlock,
  ToolResultBlock,
  ContentBlock,
  FileWriter,
  OffloadResult,
} from './core/types.js';
