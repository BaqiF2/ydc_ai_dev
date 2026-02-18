/**
 * Token Counter — Serializes messages and delegates token counting to LlmClient.
 *
 * Core exports:
 * - countTokens — Count total tokens in a message list via LlmClient
 * - serializeContent — Serialize ContentBlock to plain text for display/debugging
 */

import type {
  Message,
  ContentBlock,
  LlmClient,
  Logger,
} from './types.js';
import { SUMMARY_MODEL, defaultLogger } from './types.js';

/**
 * Count the total tokens in a list of messages using the LLM client's countTokens API.
 */
export async function countTokens(
  messages: Message[],
  llmClient: LlmClient,
  model: string = SUMMARY_MODEL,
): Promise<number> {
  if (messages.length === 0) {
    return 0;
  }

  return llmClient.countTokens(messages, model);
}

/**
 * Serialize a single ContentBlock to plain text representation.
 */
export function serializeContent(
  block: ContentBlock,
  logger: Logger = defaultLogger,
): string {
  switch (block.type) {
    case 'text':
      return block.text;
    case 'tool_use':
      return `[Tool Use: ${block.name}] ${JSON.stringify(block.input)}`;
    case 'tool_result': {
      const content = block.content;
      if (typeof content === 'string') {
        return `[Tool Result: ${block.tool_use_id}] ${content}`;
      }
      const nested = content.map((b) => serializeContent(b, logger)).join('\n');
      return `[Tool Result: ${block.tool_use_id}]\n${nested}`;
    }
    default: {
      logger.warn('Unknown content block type, skipping', {
        type: (block as Record<string, unknown>).type,
      });
      return '';
    }
  }
}

/**
 * Serialize a message's content to plain text.
 */
export function serializeMessage(message: Message): string {
  if (typeof message.content === 'string') {
    return message.content;
  }
  return message.content.map((b) => serializeContent(b)).join('\n');
}
