/**
 * Tool Direct Offload — Type Definitions
 *
 * Defines the core types for the tool result offload middleware,
 * following Anthropic message format conventions.
 *
 * Core exports:
 * - TextBlock: Text content block in a message
 * - ToolUseBlock: Tool invocation content block
 * - ToolResultBlock: Tool execution result content block
 * - ContentBlock: Union type of all content block types
 * - Message: A single message in the conversation
 * - FileWriter: Abstract interface for file write operations (dependency inversion)
 * - OffloadResult: Result returned by the offload function
 */

/** Text content block */
export interface TextBlock {
  type: 'text';
  text: string;
}

/** Tool invocation content block */
export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/** Tool execution result content block */
export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | ContentBlock[];
}

/** Union type of all supported content block types */
export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

/** A single message in the conversation */
export interface Message {
  role: string;
  content: string | ContentBlock[];
}

/**
 * Abstract file writer interface.
 * Core layer depends on this interface; infrastructure layer provides the implementation.
 */
export interface FileWriter {
  writeFile(filePath: string, content: string): Promise<void>;
}

/** Result returned by the offload function */
export interface OffloadResult {
  /** The new message with content replaced by file path reference */
  message: Message;
  /** Number of characters freed by offloading */
  freedChars: number;
  /** Absolute path of the written file */
  file: string;
}
