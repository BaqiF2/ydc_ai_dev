/**
 * Public API entry point for the Agent context offload module.
 * Assembles core logic with infrastructure implementation and re-exports public types.
 *
 * Core exports:
 * - offloadToolResults: Convenience wrapper that uses NodeFileWriter
 * - offloadToolResultsWithWriter: Core function accepting a custom FileWriter (for testing)
 * - All types from core/types.ts
 */

import { offloadToolResults as coreOffload } from './core/offload.js';
import { NodeFileWriter } from './infrastructure/file-writer.js';
import type { Message, OffloadResult, FileWriter } from './core/types.js';

export type {
  Message,
  ContentBlock,
  TextBlock,
  ToolUseBlock,
  ToolResultBlock,
  FileWriter,
  OffloadResult,
} from './core/types.js';

export { offloadToolResults as offloadToolResultsWithWriter } from './core/offload.js';

/**
 * Offload large tool_result content from messages to files.
 * Convenience wrapper that uses the default NodeFileWriter.
 *
 * @param messages - Anthropic-style message array
 * @param options - Configuration options
 * @param options.outputDir - Directory to write offload files into
 * @returns OffloadResult with new messages, stats, and file paths
 */
export async function offloadToolResults(
  messages: Message[],
  options: { outputDir: string },
): Promise<OffloadResult> {
  const writer: FileWriter = new NodeFileWriter();
  return coreOffload(messages, options.outputDir, writer);
}
