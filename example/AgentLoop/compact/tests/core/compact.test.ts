/**
 * Tests for core compact algorithm — partitioning, assembly, threshold detection,
 * and full compaction workflow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  compactMessages,
  shouldCompact,
  partitionMessages,
  assembleMessages,
  resetCompactionCounter,
} from '../../src/core/compact.js';
import type {
  Message,
  LlmClient,
  FileWriter,
  Logger,
} from '../../src/core/types.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createMockLlmClient(
  tokenCounts: number[] = [],
  summaryResult: string = 'Mock summary',
): LlmClient {
  let callIndex = 0;
  return {
    countTokens: vi.fn(async () => {
      const count = tokenCounts[callIndex] ?? 100;
      callIndex++;
      return count;
    }),
    summarize: vi.fn(async () => summaryResult),
  };
}

function createMockFileWriter(): FileWriter {
  return {
    write: vi.fn(async () => {}),
  };
}

function createMockLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function msg(role: Message['role'], text: string): Message {
  return { role, content: text };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('shouldCompact', () => {
  it('should return false for empty messages', async () => {
    const llm = createMockLlmClient([]);
    const result = await shouldCompact([], llm);
    expect(result).toBe(false);
  });

  it('should return true when tokens exceed threshold', async () => {
    const llm = createMockLlmClient([190000]);
    const messages = [msg('user', 'hello')];
    const result = await shouldCompact(messages, llm, {
      contextTokenLimit: 200000,
      compactThresholdRatio: 0.92,
    });
    expect(result).toBe(true);
  });

  it('should return false when tokens are below threshold', async () => {
    const llm = createMockLlmClient([100000]);
    const messages = [msg('user', 'hello')];
    const result = await shouldCompact(messages, llm, {
      contextTokenLimit: 200000,
      compactThresholdRatio: 0.92,
    });
    expect(result).toBe(false);
  });

  it('should return true when tokens exactly equal threshold', async () => {
    const llm = createMockLlmClient([184000]);
    const messages = [msg('user', 'hello')];
    const result = await shouldCompact(messages, llm, {
      contextTokenLimit: 200000,
      compactThresholdRatio: 0.92,
    });
    expect(result).toBe(true);
  });

  // BDD Scenario: 使用自定义配置参数
  it('should use custom CompactOptions to calculate threshold', async () => {
    const llm = createMockLlmClient([90000]);
    const messages = [msg('user', 'hello')];
    const result = await shouldCompact(messages, llm, {
      contextTokenLimit: 100000,
      compactThresholdRatio: 0.8,
    });
    // threshold = 100000 × 0.8 = 80000; 90000 >= 80000 → true
    expect(result).toBe(true);
  });
});

describe('partitionMessages', () => {
  it('should put system messages in head', async () => {
    const llm = createMockLlmClient([100, 100, 100]);
    const messages = [
      msg('system', 'You are a helper'),
      msg('user', 'hello'),
      msg('assistant', 'hi'),
    ];

    const result = await partitionMessages(messages, 200, llm);
    expect(result.head).toHaveLength(1);
    expect(result.head[0].role).toBe('system');
  });

  it('should have empty head when no system messages', async () => {
    const llm = createMockLlmClient([100, 100]);
    const messages = [
      msg('user', 'hello'),
      msg('assistant', 'hi'),
    ];

    const result = await partitionMessages(messages, 50, llm);
    expect(result.head).toHaveLength(0);
  });

  it('should retain tail messages based on token budget', async () => {
    const llm = createMockLlmClient([100, 100, 100, 150]);
    const messages = [
      msg('system', 'sys'),
      msg('user', 'msg1'),
      msg('user', 'msg2'),
      msg('assistant', 'msg3'),
    ];

    // Tail budget of 150: last message (150 tokens) fills the budget
    const result = await partitionMessages(messages, 150, llm);
    expect(result.tail.length).toBeGreaterThanOrEqual(1);
  });

  it('should have empty middle when all messages fit in head + tail', async () => {
    const llm = createMockLlmClient([100, 100]);
    const messages = [
      msg('system', 'sys'),
      msg('user', 'hello'),
    ];

    // Tail budget large enough to cover the user message
    const result = await partitionMessages(messages, 10000, llm);
    expect(result.middle).toHaveLength(0);
  });
});

describe('assembleMessages', () => {
  it('should create [head, summary, tail] in order', () => {
    const head = [msg('system', 'sys')];
    const tail = [msg('user', 'recent'), msg('assistant', 'reply')];
    const result = assembleMessages(head, 'My summary', tail);

    expect(result).toHaveLength(4);
    expect(result[0].role).toBe('system');
    expect(result[1].role).toBe('user');
    expect(result[1].content).toBe('My summary');
    expect(result[2].content).toBe('recent');
    expect(result[3].content).toBe('reply');
  });

  it('should put summary first when head is empty', () => {
    const result = assembleMessages([], 'Summary', [msg('user', 'last')]);
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe('user');
    expect(result[0].content).toBe('Summary');
  });

  it('should not mutate input arrays', () => {
    const head = [msg('system', 'sys')];
    const tail = [msg('user', 'last')];
    const headLen = head.length;
    const tailLen = tail.length;

    assembleMessages(head, 'Summary', tail);

    expect(head).toHaveLength(headLen);
    expect(tail).toHaveLength(tailLen);
  });
});

describe('compactMessages', () => {
  beforeEach(() => {
    resetCompactionCounter();
  });

  it('should throw if llmClient is not provided', async () => {
    await expect(
      compactMessages([msg('user', 'hi')], { fileWriter: createMockFileWriter() } as any),
    ).rejects.toThrow('llmClient is required');
  });

  it('should throw if fileWriter is not provided', async () => {
    await expect(
      compactMessages([msg('user', 'hi')], { llmClient: createMockLlmClient() } as any),
    ).rejects.toThrow('fileWriter is required');
  });

  it('should return original messages when below threshold', async () => {
    const messages = [msg('user', 'hello')];
    // countTokens returns 100, well below threshold
    const llm = createMockLlmClient([100]);
    const fw = createMockFileWriter();

    const result = await compactMessages(messages, {
      llmClient: llm,
      fileWriter: fw,
      contextTokenLimit: 200000,
      compactThresholdRatio: 0.92,
    });

    expect(result.compacted).toBe(false);
    expect(result.messages).toBe(messages);
    expect(result.stats).toBeNull();
  });

  it('should compact when above threshold', async () => {
    const messages = [
      msg('system', 'You are a helper'),
      msg('user', 'msg1'),
      msg('user', 'msg2'),
      msg('user', 'msg3'),
      msg('assistant', 'reply'),
    ];

    // Call sequence for countTokens:
    // 1. Total count: 190000 (above threshold)
    // 2-5. Individual message counts for partition: 1000, 50000, 50000, 50000, 40000
    // 6. Compacted total: 50000
    const llm = createMockLlmClient(
      [190000, 40000, 50000, 50000, 50000, 1000, 50000],
      'Compacted summary text',
    );
    const fw = createMockFileWriter();
    const logger = createMockLogger();

    const result = await compactMessages(messages, {
      llmClient: llm,
      fileWriter: fw,
      logger,
      contextTokenLimit: 200000,
      compactThresholdRatio: 0.92,
      tailRetentionRatio: 0.15,
      sessionId: 'test-session',
    });

    expect(result.compacted).toBe(true);
    expect(result.stats).not.toBeNull();
    expect(result.messages[0].role).toBe('system');
    expect(fw.write).toHaveBeenCalled();
  });

  it('should skip compaction when middle is empty', async () => {
    const messages = [
      msg('system', 'sys'),
      msg('user', 'hello'),
    ];

    // Total: 190000 (above threshold), but individual messages fill entire tail
    const llm = createMockLlmClient([190000, 190000]);
    const fw = createMockFileWriter();
    const logger = createMockLogger();

    const result = await compactMessages(messages, {
      llmClient: llm,
      fileWriter: fw,
      logger,
      contextTokenLimit: 200000,
      compactThresholdRatio: 0.92,
      tailRetentionRatio: 0.99,
    });

    expect(result.compacted).toBe(false);
  });
});
