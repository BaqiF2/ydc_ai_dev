/**
 * Core offload algorithm for Agent context management.
 * Scans messages for tool_result blocks and delegates large content to file storage.
 * Includes a ratio threshold guard: skips offloading when offloadable chars are below
 * a configurable percentage of total message chars (default 20%).
 *
 * Core exports:
 * - OFFLOAD_CHAR_THRESHOLD: Minimum character count for offloading (100)
 * - OFFLOAD_RATIO_THRESHOLD: Minimum offloadable-to-total char ratio (0.2)
 * - offloadToolResults: Main offload function that processes messages and returns OffloadResult
 */

import type {
  Message,
  ContentBlock,
  ToolResultBlock,
  FileWriter,
  OffloadResult,
} from './types.js';

/** Minimum character count to trigger offloading */
const OFFLOAD_CHAR_THRESHOLD = parseInt(
  process.env.OFFLOAD_CHAR_THRESHOLD || '100',
  10,
);

/** Minimum ratio of offloadable chars to total chars to proceed with offloading */
const OFFLOAD_RATIO_THRESHOLD = parseFloat(
  process.env.OFFLOAD_RATIO_THRESHOLD || '0.2',
);

/**
 * Calculate the character count of a single content block.
 * Used during pre-scan to compute total message chars.
 */
function getBlockCharCount(block: ContentBlock): number {
  switch (block.type) {
    case 'text':
      return block.text.length;
    case 'tool_use':
      return JSON.stringify(block.input).length;
    case 'tool_result':
      return getContentCharCount(block.content);
  }
}

/**
 * Pre-scan messages to determine if offloading is worthwhile.
 * Returns true when offloading should be skipped.
 */
function shouldSkipOffload(messages: Message[]): boolean {
  let totalChars = 0;
  let offloadableChars = 0;

  for (const message of messages) {
    for (const block of message.content) {
      const charCount = getBlockCharCount(block);
      totalChars += charCount;

      if (
        block.type === 'tool_result' &&
        charCount >= OFFLOAD_CHAR_THRESHOLD
      ) {
        offloadableChars += charCount;
      }
    }
  }

  if (totalChars === 0) return true;
  if (offloadableChars === 0) return true;
  if (offloadableChars / totalChars < OFFLOAD_RATIO_THRESHOLD) return true;

  return false;
}

/**
 * Calculate the character count of a tool_result's content.
 * - string: direct .length
 * - ContentBlock[]: JSON.stringify().length
 */
function getContentCharCount(content: string | ContentBlock[]): number {
  if (typeof content === 'string') {
    return content.length;
  }
  return JSON.stringify(content).length;
}

/**
 * Serialize tool_result content to a string for file storage.
 * - string: returned as-is
 * - ContentBlock[]: JSON.stringify with indentation
 */
function serializeContent(content: string | ContentBlock[]): string {
  if (typeof content === 'string') {
    return content;
  }
  return JSON.stringify(content, null, 2);
}

/**
 * Generate a unique file name for the offloaded content.
 * Appends a numeric suffix when the tool_use_id has already been used.
 */
function generateFileName(
  toolUseId: string,
  usedIds: Map<string, number>,
): string {
  const count = usedIds.get(toolUseId) ?? 0;
  usedIds.set(toolUseId, count + 1);

  if (count === 0) {
    return `tool-result-${toolUseId}.md`;
  }
  return `tool-result-${toolUseId}-${count}.md`;
}

/**
 * Build the placeholder reference string that replaces offloaded content.
 */
function buildReference(fileName: string): string {
  return `[Content offloaded to: ./${fileName}]`;
}

/**
 * Offload large tool_result content from messages to files.
 *
 * Pre-scans all messages to check if the offloadable char ratio meets the
 * threshold. If not, returns the original messages array immediately.
 * Otherwise, scans messages from earliest to latest. For each tool_result block whose
 * content character count >= OFFLOAD_CHAR_THRESHOLD, writes the content to
 * a file and replaces it with a file path reference.
 *
 * @param messages - Anthropic-style message array
 * @param outputDir - Directory to write offload files into
 * @param writer - FileWriter implementation for file system operations
 * @returns OffloadResult with new messages, stats, and file paths
 */
export async function offloadToolResults(
  messages: Message[],
  outputDir: string,
  writer: FileWriter,
): Promise<OffloadResult> {
  // Ratio threshold guard: skip when offload value is too low
  if (shouldSkipOffload(messages)) {
    return {
      messages,
      offloadedCount: 0,
      freedChars: 0,
      files: [],
    };
  }

  const usedIds = new Map<string, number>();
  const files: string[] = [];
  let offloadedCount = 0;
  let freedChars = 0;

  const newMessages: Message[] = [];

  for (const message of messages) {
    let messageModified = false;
    const newContent: ContentBlock[] = [];

    for (const block of message.content) {
      if (block.type !== 'tool_result') {
        newContent.push(block);
        continue;
      }

      const toolResult = block as ToolResultBlock;
      const charCount = getContentCharCount(toolResult.content);

      if (charCount < OFFLOAD_CHAR_THRESHOLD) {
        newContent.push(block);
        continue;
      }

      // Offload this tool_result
      const fileName = generateFileName(toolResult.tool_use_id, usedIds);
      const filePath = `${outputDir}/${fileName}`;
      const serialized = serializeContent(toolResult.content);

      await writer.writeFile(filePath, serialized);

      const replacedBlock: ToolResultBlock = {
        type: 'tool_result',
        tool_use_id: toolResult.tool_use_id,
        content: buildReference(fileName),
      };

      newContent.push(replacedBlock);
      files.push(filePath);
      offloadedCount++;
      freedChars += charCount;
      messageModified = true;
    }

    if (messageModified) {
      newMessages.push({ ...message, content: newContent });
    } else {
      newMessages.push(message);
    }
  }

  return {
    messages: newMessages,
    offloadedCount,
    freedChars,
    files,
  };
}
