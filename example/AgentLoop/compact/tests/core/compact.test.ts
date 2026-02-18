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
  // BDD Scenario: 正常分区：system + 多条消息
  it('should partition into head(1 system) + middle(7) + tail(3)', async () => {
    const messages = [
      msg('system', 'system prompt'),
      msg('user', 'u1'), msg('assistant', 'a1'),
      msg('user', 'u2'), msg('assistant', 'a2'),
      msg('user', 'u3'), msg('assistant', 'a3'),
      msg('user', 'u4'),
      msg('user', 'u5'), msg('assistant', 'a5'),
      msg('user', 'u6'),
    ];
    // 11 messages: 1 system + 10 non-system
    // Tail scan from end: u6=10000, a5=10000, u5=10000 → 30000 >= 30000, stop
    const llm = createMockLlmClient([10000, 10000, 10000]);

    const result = await partitionMessages(messages, 30000, llm);
    expect(result.head).toHaveLength(1);
    expect(result.head[0].role).toBe('system');
    expect(result.tail).toHaveLength(3);
    expect(result.middle).toHaveLength(7);
  });

  // BDD Scenario: 无 system 消息时 Head 为空
  it('should have empty head when first message is user', async () => {
    const messages = [
      msg('user', 'u1'), msg('assistant', 'a1'),
      msg('user', 'u2'), msg('assistant', 'a2'),
      msg('user', 'u3'),
    ];
    // Tail scan: u3=5000 >= 5000, stop
    const llm = createMockLlmClient([5000]);

    const result = await partitionMessages(messages, 5000, llm);
    expect(result.head).toHaveLength(0);
    expect(result.middle.length + result.tail.length).toBe(5);
  });

  // BDD Scenario: 多条 system 消息全部归入 Head
  it('should put all consecutive system messages in head', async () => {
    const messages = [
      msg('system', 'sys1'),
      msg('system', 'sys2'),
      msg('user', 'u1'),
      msg('assistant', 'a1'),
      msg('user', 'u2'),
    ];
    // Tail scan: u2=5000, a1=5000 → 10000 >= 10000, stop
    const llm = createMockLlmClient([5000, 5000]);

    const result = await partitionMessages(messages, 10000, llm);
    expect(result.head).toHaveLength(2);
    expect(result.head[0].role).toBe('system');
    expect(result.head[1].role).toBe('system');
    expect(result.middle.every(m => m.role !== 'system')).toBe(true);
    expect(result.tail.every(m => m.role !== 'system')).toBe(true);
  });

  // BDD Scenario: Head + Tail 覆盖所有消息，Middle 为空
  it('should have empty middle when tail budget covers all non-system messages', async () => {
    const messages = [
      msg('system', 'sys'),
      msg('user', 'u1'),
      msg('assistant', 'a1'),
      msg('user', 'u2'),
    ];
    // Tail scan: u2=1000, a1=1000, u1=1000 → 3000, all consumed before budget 100000
    const llm = createMockLlmClient([1000, 1000, 1000]);

    const result = await partitionMessages(messages, 100000, llm);
    expect(result.head).toHaveLength(1);
    expect(result.head[0].role).toBe('system');
    expect(result.tail).toHaveLength(3);
    expect(result.middle).toHaveLength(0);
  });

  // BDD Scenario: Tail 扫描不截断消息
  it('should not truncate messages when tail scan exceeds budget', async () => {
    const messages = [
      msg('system', 'sys'),
      msg('user', 'u1'),
      msg('assistant', 'a1'),
      msg('user', 'u2'),
      msg('assistant', 'a2'),
    ];
    // Tail scan: a2=8000 (<10000, continue), u2=5000 (8000+5000=13000>=10000, stop)
    // Both messages included in tail despite total exceeding budget
    const llm = createMockLlmClient([8000, 5000]);

    const result = await partitionMessages(messages, 10000, llm);
    expect(result.tail).toHaveLength(2);
    expect(result.tail[0].content).toBe('u2');
    expect(result.tail[1].content).toBe('a2');
  });

  // BDD Scenario: 只有一条消息时归入 Tail
  it('should put single message in tail with empty head and middle', async () => {
    const messages = [msg('user', 'only message')];
    const llm = createMockLlmClient([500]);

    const result = await partitionMessages(messages, 100, llm);
    expect(result.head).toHaveLength(0);
    expect(result.middle).toHaveLength(0);
    expect(result.tail).toHaveLength(1);
    expect(result.tail[0].content).toBe('only message');
  });
});

describe('assembleMessages', () => {
  // BDD Scenario: 正常组装：Head + 摘要 + Tail
  it('should assemble head(1) + summary + tail(5) into 7 messages in order', () => {
    const head = [msg('system', 'sys')];
    const tail = [
      msg('user', 't1'), msg('assistant', 't2'),
      msg('user', 't3'), msg('assistant', 't4'),
      msg('user', 't5'),
    ];
    const result = assembleMessages(head, 'Summary text', tail);

    expect(result).toHaveLength(7);
    expect(result[0].role).toBe('system');
    expect(result[1].role).toBe('user');
    expect(result[1].content).toBe('Summary text');
    expect(result[2].content).toBe('t1');
    expect(result[6].content).toBe('t5');
  });

  // BDD Scenario: Head 为空时摘要消息为第一条
  it('should put summary first when head is empty', () => {
    const tail = [msg('user', 't1'), msg('assistant', 't2'), msg('user', 't3')];
    const result = assembleMessages([], 'Summary text', tail);

    expect(result).toHaveLength(4);
    expect(result[0].role).toBe('user');
    expect(result[0].content).toBe('Summary text');
    expect(result[1].content).toBe('t1');
    expect(result[3].content).toBe('t3');
  });

  // BDD Scenario: 不可变性：输入数组不被修改
  it('should not mutate input arrays', () => {
    const head = [msg('system', 'sys')];
    const tail = [msg('user', 'a'), msg('assistant', 'b'), msg('user', 'c')];
    const headSnapshot = [...head];
    const tailSnapshot = [...tail];

    const result = assembleMessages(head, 'Summary', tail);

    expect(result).not.toBe(head);
    expect(result).not.toBe(tail);
    expect(head).toHaveLength(headSnapshot.length);
    expect(tail).toHaveLength(tailSnapshot.length);
    expect(head[0].content).toBe(headSnapshot[0].content);
    expect(tail[0].content).toBe(tailSnapshot[0].content);
  });

  // BDD Scenario: 摘要消息格式正确
  it('should create summary message with role user and exact content', () => {
    const summaryText = '这是会话摘要内容';
    const result = assembleMessages([], summaryText, [msg('user', 'last')]);

    const summaryMsg = result[0];
    expect(summaryMsg.role).toBe('user');
    expect(summaryMsg.content).toBe(summaryText);
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
