/**
 * Anthropic-style message type definitions for Agent context offloading.
 *
 * Core exports:
 * - TextBlock: Text content block
 * - ToolUseBlock: Tool invocation block
 * - ToolResultBlock: Tool result block (offload target)
 * - ContentBlock: Union type of all content blocks
 * - Message: Conversation message with role and content
 * - FileWriter: Interface for file system write operations (dependency inversion)
 * - OffloadResult: Return value of the offload operation
 */

/** Text content block */
export interface TextBlock {
  type: 'text';
  text: string;
}

/** Tool invocation block */
export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/** Tool result block — the primary target for offloading */
export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | ContentBlock[];
}

/** Union type of all supported content blocks */
export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

/** A single conversation message in Anthropic format */
export interface Message {
  role: 'user' | 'assistant';
  content: ContentBlock[];
}

/**
 * Interface for file system write operations.
 * Core layer depends on this abstraction; infrastructure layer provides the implementation.
 */
export interface FileWriter {
  /**
   * Write content to a file at the given path.
   * Must create parent directories if they do not exist.
   */
  writeFile(filePath: string, content: string): Promise<void>;
}

/** Result returned by the offload operation */
export interface OffloadResult {
  /** New message list with offloaded tool_result content replaced by file path references */
  messages: Message[];
  /** Number of tool_result blocks that were offloaded */
  offloadedCount: number;
  /** Total characters freed from offloaded content */
  freedChars: number;
  /** Absolute paths of all written offload files */
  files: string[];
}
