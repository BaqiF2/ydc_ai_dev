/**
 * Tests for token-counter — content serialization and token counting delegation.
 * Covers all 6 BDD scenarios for F-001: Token Counting.
 */

import { describe, it, expect, vi } from 'vitest';
import { countTokens, serializeContent, serializeMessage } from '../../src/core/token-counter.js';
import type { LlmClient, Message, ContentBlock, Logger } from '../../src/core/types.js';

function createMockLlmClient(returnValue: number = 100): LlmClient {
  return {
    countTokens: vi.fn(async () => returnValue),
    summarize: vi.fn(async () => ''),
  };
}

function createMockLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('countTokens', () => {
  // BDD Scenario: 空消息列表返回 0
  it('should return 0 for empty message list', async () => {
    const llm = createMockLlmClient();
    const result = await countTokens([], llm);
    expect(result).toBe(0);
    expect(llm.countTokens).not.toHaveBeenCalled();
  });

  // BDD Scenario: 计算包含纯文本消息的 token 数
  it('should return total token count for 3 TextBlock messages', async () => {
    const llm = createMockLlmClient(300);
    const messages: Message[] = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
      { role: 'user', content: 'how are you' },
    ];
    const result = await countTokens(messages, llm);
    expect(result).toBe(300);
    expect(typeof result).toBe('number');
    expect(llm.countTokens).toHaveBeenCalledWith(messages, expect.any(String));
  });

  // BDD Scenario: 计算包含 ToolUseBlock 的 token 数
  it('should delegate counting of ToolUseBlock messages to llmClient', async () => {
    const llm = createMockLlmClient(150);
    const messages: Message[] = [
      {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'tool_1',
            name: 'readFile',
            input: { path: '/src/index.ts' },
          },
        ],
      },
    ];
    const result = await countTokens(messages, llm);
    expect(result).toBe(150);
    expect(llm.countTokens).toHaveBeenCalledWith(messages, expect.any(String));
  });

  // BDD Scenario: 计算包含 ToolResultBlock 的 token 数
  it('should delegate counting of nested ToolResultBlock messages to llmClient', async () => {
    const llm = createMockLlmClient(200);
    const messages: Message[] = [
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tool_1',
            content: [{ type: 'text', text: 'nested result text' }],
          },
        ],
      },
    ];
    const result = await countTokens(messages, llm);
    expect(result).toBe(200);
    expect(llm.countTokens).toHaveBeenCalledWith(messages, expect.any(String));
  });

  // BDD Scenario: 空字符串 content 返回 0 token
  it('should return 0 for message with empty string content', async () => {
    const llm = createMockLlmClient(0);
    const messages: Message[] = [{ role: 'user', content: '' }];
    const result = await countTokens(messages, llm);
    expect(result).toBe(0);
  });
});

describe('serializeContent', () => {
  it('should serialize TextBlock', () => {
    const block: ContentBlock = { type: 'text', text: 'hello world' };
    expect(serializeContent(block)).toBe('hello world');
  });

  // BDD Scenario: 计算包含 ToolUseBlock 的 token 数 (serialization aspect)
  it('should serialize ToolUseBlock with name and input', () => {
    const block: ContentBlock = {
      type: 'tool_use',
      id: 'tool_1',
      name: 'readFile',
      input: { path: '/src/index.ts' },
    };
    const result = serializeContent(block);
    expect(result).toContain('readFile');
    expect(result).toContain('/src/index.ts');
  });

  it('should serialize ToolResultBlock with string content', () => {
    const block: ContentBlock = {
      type: 'tool_result',
      tool_use_id: 'tool_1',
      content: 'file contents here',
    };
    const result = serializeContent(block);
    expect(result).toContain('tool_1');
    expect(result).toContain('file contents here');
  });

  // BDD Scenario: 计算包含 ToolResultBlock 的 token 数 (serialization aspect)
  it('should serialize ToolResultBlock with nested ContentBlock array', () => {
    const block: ContentBlock = {
      type: 'tool_result',
      tool_use_id: 'tool_2',
      content: [{ type: 'text', text: 'nested text' }],
    };
    const result = serializeContent(block);
    expect(result).toContain('tool_2');
    expect(result).toContain('nested text');
  });

  // BDD Scenario: 未知 ContentBlock 类型被跳过并记录警告
  it('should return empty string and log warning for unknown block type', () => {
    const logger = createMockLogger();
    const unknownBlock = { type: 'custom_block', data: 'some data' } as unknown as ContentBlock;
    const result = serializeContent(unknownBlock, logger);
    expect(result).toBe('');
    expect(logger.warn).toHaveBeenCalledWith(
      'Unknown content block type, skipping',
      expect.objectContaining({ type: 'custom_block' }),
    );
  });
});

describe('serializeMessage', () => {
  it('should serialize string content directly', () => {
    const message: Message = { role: 'user', content: 'hello' };
    expect(serializeMessage(message)).toBe('hello');
  });

  it('should serialize ContentBlock array', () => {
    const message: Message = {
      role: 'assistant',
      content: [
        { type: 'text', text: 'thinking...' },
        { type: 'tool_use', id: 't1', name: 'search', input: { q: 'test' } },
      ],
    };
    const result = serializeMessage(message);
    expect(result).toContain('thinking...');
    expect(result).toContain('search');
  });

  // BDD Scenario: 未知 ContentBlock 类型被跳过 (message-level verification)
  it('should skip unknown block types and keep valid blocks in serialized output', () => {
    const message: Message = {
      role: 'assistant',
      content: [
        { type: 'unknown_type' } as unknown as ContentBlock,
        { type: 'text', text: 'valid text' },
      ],
    };
    const result = serializeMessage(message);
    expect(result).toContain('valid text');
  });
});
