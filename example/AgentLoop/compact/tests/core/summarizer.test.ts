/**
 * Tests for summarizer — prompt construction and summarization delegation.
 * Covers all 5 BDD scenarios for F-004: Summary Generation.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  summarize,
  buildSummarizePrompt,
  serializeForSummary,
} from '../../src/core/summarizer.js';
import type { LlmClient, Message } from '../../src/core/types.js';

function msg(role: Message['role'], text: string): Message {
  return { role, content: text };
}

describe('serializeForSummary', () => {
  it('should serialize messages with index and role labels', () => {
    const messages = [
      msg('user', 'hello'),
      msg('assistant', 'hi there'),
    ];
    const result = serializeForSummary(messages);
    expect(result).toContain('[1] [user]');
    expect(result).toContain('hello');
    expect(result).toContain('[2] [assistant]');
    expect(result).toContain('hi there');
  });

  it('should separate messages with dividers', () => {
    const messages = [
      msg('user', 'a'),
      msg('assistant', 'b'),
    ];
    const result = serializeForSummary(messages);
    expect(result).toContain('---');
  });

  // BDD Scenario: 消息序列化为可读格式 — ToolUseBlock
  it('should serialize ToolUseBlock with tool name and parameters', () => {
    const messages: Message[] = [
      {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'call_1', name: 'readFile', input: { path: '/src/app.ts' } },
        ],
      },
    ];
    const result = serializeForSummary(messages);
    expect(result).toContain('[assistant]');
    expect(result).toContain('readFile');
    expect(result).toContain('/src/app.ts');
  });

  // BDD Scenario: 消息序列化为可读格式 — ToolResultBlock
  it('should serialize ToolResultBlock with result content', () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'call_1', content: 'file content here' },
        ],
      },
    ];
    const result = serializeForSummary(messages);
    expect(result).toContain('[user]');
    expect(result).toContain('call_1');
    expect(result).toContain('file content here');
  });

  // BDD Scenario: 消息序列化为可读格式 — mixed types
  it('should serialize mixed message types with TextBlock displayed directly', () => {
    const messages: Message[] = [
      msg('user', 'please read the file'),
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'I will read the file for you.' },
          { type: 'tool_use', id: 't1', name: 'readFile', input: { path: '/index.ts' } },
        ],
      },
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 't1', content: 'export default {}' },
        ],
      },
    ];
    const result = serializeForSummary(messages);
    expect(result).toContain('please read the file');
    expect(result).toContain('I will read the file for you.');
    expect(result).toContain('readFile');
    expect(result).toContain('export default {}');
  });
});

describe('buildSummarizePrompt', () => {
  // BDD Scenario: 摘要 prompt 包含正确的指令
  it('should include all 5 required dimensions', () => {
    const prompt = buildSummarizePrompt('some conversation');
    expect(prompt).toContain('goals');
    expect(prompt).toContain('File operations');
    expect(prompt).toContain('Tool call');
    expect(prompt).toContain('task status');
    expect(prompt).toContain('Errors');
  });

  it('should include the serialized messages', () => {
    const prompt = buildSummarizePrompt('CONVERSATION CONTENT HERE');
    expect(prompt).toContain('CONVERSATION CONTENT HERE');
  });
});

describe('summarize', () => {
  // BDD Scenario: 正常生成摘要
  it('should return the LLM summary result', async () => {
    const llm: LlmClient = {
      countTokens: vi.fn(),
      summarize: vi.fn(async () => 'Generated summary'),
    };
    const messages = [msg('user', 'hello')];
    const result = await summarize(messages, llm);
    expect(result).toBe('Generated summary');
    expect(llm.summarize).toHaveBeenCalled();
  });

  // BDD Scenario: 正常生成摘要 — multi-message delegation
  it('should pass serialized multi-message conversation to LLM', async () => {
    const llm: LlmClient = {
      countTokens: vi.fn(),
      summarize: vi.fn(async (prompt: string) => {
        // Verify prompt contains serialized messages
        if (prompt.includes('user') && prompt.includes('assistant')) {
          return 'Structured summary with goals, files, tools, status, errors';
        }
        return '';
      }),
    };
    const messages: Message[] = [
      msg('user', 'help me fix bug'),
      msg('assistant', 'I will look at the code'),
      msg('user', 'found the issue'),
      msg('assistant', 'let me fix it'),
    ];
    const result = await summarize(messages, llm);
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
    expect(llm.summarize).toHaveBeenCalledWith(expect.any(String), expect.any(String));
  });

  // BDD Scenario: LLM 调用失败抛出错误
  it('should throw when LLM call fails with network error', async () => {
    const llm: LlmClient = {
      countTokens: vi.fn(),
      summarize: vi.fn(async () => { throw new Error('Network error: connection refused'); }),
    };
    await expect(summarize([msg('user', 'hello')], llm)).rejects.toThrow(
      'Network error: connection refused',
    );
  });

  // BDD Scenario: LLM 返回空内容视为失败
  it('should throw when LLM returns empty string', async () => {
    const llm: LlmClient = {
      countTokens: vi.fn(),
      summarize: vi.fn(async () => ''),
    };
    await expect(summarize([msg('user', 'hello')], llm)).rejects.toThrow(
      'LLM returned empty summary content',
    );
  });

  it('should throw when LLM returns whitespace-only string', async () => {
    const llm: LlmClient = {
      countTokens: vi.fn(),
      summarize: vi.fn(async () => '   \n  '),
    };
    await expect(summarize([msg('user', 'hello')], llm)).rejects.toThrow(
      'LLM returned empty summary content',
    );
  });
});
