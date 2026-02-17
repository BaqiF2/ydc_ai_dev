/**
 * Tool Direct Offload — Core Offload Logic
 *
 * Implements the core algorithm for offloading a single tool_result message
 * to a file and replacing the content with a file path reference.
 *
 * Core exports:
 * - OFFLOAD_REFERENCE_PREFIX: Prefix for the offload reference string
 * - OFFLOAD_REFERENCE_SUFFIX: Suffix for the offload reference string
 * - offloadToolResult: Offloads a single tool_result message to a file
 */

import type {
  Message,
  FileWriter,
  OffloadResult,
  ContentBlock,
} from './types.js';

/** Prefix for the offload reference string */
export const OFFLOAD_REFERENCE_PREFIX = '[Tool result offloaded to file: ';

/** Suffix for the offload reference string */
export const OFFLOAD_REFERENCE_SUFFIX = ']';

/**
 * Serialize message content to a string for file writing.
 * - string content: returned as-is
 * - ContentBlock[] content: JSON.stringify
 */
function serializeContent(content: string | ContentBlock[]): string {
  if (typeof content === 'string') {
    return content;
  }
  return JSON.stringify(content);
}

/**
 * Build the offload reference string from a file path.
 */
function buildReference(filePath: string): string {
  return `${OFFLOAD_REFERENCE_PREFIX}${filePath}${OFFLOAD_REFERENCE_SUFFIX}`;
}

/**
 * Deep clone a message to ensure immutability.
 */
function cloneMessage(message: Message): Message {
  return JSON.parse(JSON.stringify(message)) as Message;
}

/**
 * Offload a single tool_result message to a file.
 *
 * Writes the full content to `<outputDir>/<sessionId>/<tool_use_id>.md`,
 * then returns a new message with content replaced by a path reference string.
 *
 * @param message - The tool_result message to offload
 * @param sessionId - Current agent session identifier
 * @param outputDir - Root directory for offload files
 * @param writer - FileWriter implementation (dependency injection)
 * @returns OffloadResult with the new message, freed chars count, and file path
 */
export async function offloadToolResult(
  message: Message,
  sessionId: string,
  outputDir: string,
  writer: FileWriter,
): Promise<OffloadResult> {
  const content = message.content;

  // Serialize content for file writing
  const serialized = serializeContent(content);

  // Determine tool_use_id for file naming
  let toolUseId = 'unknown';
  if (Array.isArray(content)) {
    const toolResultBlock = content.find((block) => block.type === 'tool_result');
    if (toolResultBlock && toolResultBlock.type === 'tool_result') {
      toolUseId = toolResultBlock.tool_use_id;
    }
  }
  // For string content, extract tool_use_id from the message if content is a ToolResultBlock wrapper
  // Since Message.content can be string, the caller should ensure proper structure.
  // We look for tool_use_id in array content blocks.

  const filePath = `${outputDir}/${sessionId}/${toolUseId}.md`;

  // Write full content to file
  await writer.writeFile(filePath, serialized);

  // Build reference string
  const reference = buildReference(filePath);

  // Calculate freed characters
  const freedChars = serialized.length - reference.length;

  // Create new message (deep clone to ensure immutability)
  const newMessage = cloneMessage(message);
  newMessage.content = reference;

  return {
    message: newMessage,
    freedChars,
    file: filePath,
  };
}
