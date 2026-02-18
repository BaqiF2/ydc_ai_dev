/**
 * Anthropic LLM Client — Wraps @anthropic-ai/sdk for token counting and summarization.
 *
 * Core exports:
 * - AnthropicLlmClient — LlmClient implementation using Anthropic SDK (supports apiKey + baseURL)
 * - estimateTokens — Local fallback for token estimation (~4 chars per token)
 */

import Anthropic from '@anthropic-ai/sdk';
import type { LlmClient, Message } from '../core/types.js';
import { defaultLogger } from '../core/types.js';
import { serializeMessage } from '../core/token-counter.js';

/** Average characters per token for local estimation */
const CHARS_PER_TOKEN = parseInt(process.env.CHARS_PER_TOKEN || '4', 10);

/**
 * Convert internal Message format to Anthropic SDK message format.
 */
function toAnthropicMessages(
  messages: Message[],
): Anthropic.MessageCreateParams['messages'] {
  return messages
    .filter((msg) => msg.role !== 'system')
    .map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content as string,
    }));
}

/**
 * Extract system prompt from messages if present.
 */
function extractSystemPrompt(
  messages: Message[],
): string | undefined {
  const systemMessages = messages.filter((msg) => msg.role === 'system');
  if (systemMessages.length === 0) return undefined;
  return systemMessages
    .map((msg) =>
      typeof msg.content === 'string'
        ? msg.content
        : JSON.stringify(msg.content),
    )
    .join('\n');
}

/**
 * Estimate token count locally based on character count.
 * Used as fallback when the provider does not support the countTokens API.
 */
export function estimateTokens(messages: Message[]): number {
  let totalChars = 0;
  for (const msg of messages) {
    totalChars += serializeMessage(msg).length;
  }
  return Math.ceil(totalChars / CHARS_PER_TOKEN);
}

/**
 * LlmClient implementation using the Anthropic SDK.
 * Provides token counting via countTokens API (with local fallback)
 * and summarization via messages API.
 */
export class AnthropicLlmClient implements LlmClient {
  private readonly client: Anthropic;
  private countTokensSupported = true;

  constructor(apiKey?: string, baseURL?: string, defaultHeaders?: Record<string, string>) {
    const resolvedKey = apiKey ?? process.env.ANTHROPIC_API_KEY;
    const resolvedBaseURL = baseURL ?? process.env.ANTHROPIC_BASE_URL ?? undefined;
    this.client = new Anthropic({
      apiKey: resolvedKey,
      baseURL: resolvedBaseURL,
      defaultHeaders: defaultHeaders ?? (resolvedBaseURL
        ? { Authorization: `Bearer ${resolvedKey}` }
        : undefined),
    });
  }

  async countTokens(messages: Message[], model: string): Promise<number> {
    const anthropicMessages = toAnthropicMessages(messages);

    if (anthropicMessages.length === 0) {
      return 0;
    }

    if (!this.countTokensSupported) {
      return estimateTokens(messages);
    }

    try {
      const system = extractSystemPrompt(messages);
      const result = await this.client.messages.countTokens({
        model,
        messages: anthropicMessages,
        ...(system ? { system } : {}),
      });
      return result.input_tokens;
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 404 || status === 500 || status === 501) {
        defaultLogger.warn(
          'countTokens API not supported by provider, falling back to local estimation',
          { status },
        );
        this.countTokensSupported = false;
        return estimateTokens(messages);
      }
      throw err;
    }
  }

  async summarize(prompt: string, model: string): Promise<string> {
    const response = await this.client.messages.create({
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find(
      (block) => block.type === 'text',
    );

    return textBlock && 'text' in textBlock ? textBlock.text : '';
  }
}
