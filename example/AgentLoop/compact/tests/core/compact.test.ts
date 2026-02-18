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
  CompactOptions,
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
      compactMessages([msg('user', 'hi')], { fileWriter: createMockFileWriter() } as Partial<CompactOptions> as CompactOptions),
    ).rejects.toThrow('llmClient is required');
  });

  it('should throw if fileWriter is not provided', async () => {
    await expect(
      compactMessages([msg('user', 'hi')], { llmClient: createMockLlmClient() } as Partial<CompactOptions> as CompactOptions),
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

  // BDD Scenario: F-006 正常持久化原始消息
  it('should persist middle messages as indented JSON with correct path format', async () => {
    const messages = [
      msg('system', 'sys'),
      msg('user', 'u1'),
      msg('user', 'u2'),
      msg('assistant', 'reply'),
    ];
    // Call sequence: total=190000, tail scan: reply=30000 (>=30000 stop), compacted=50000
    const llm = createMockLlmClient([190000, 30000, 50000], 'Summary');
    const fw = createMockFileWriter();
    const logger = createMockLogger();

    const result = await compactMessages(messages, {
      llmClient: llm,
      fileWriter: fw,
      logger,
      contextTokenLimit: 200000,
      compactThresholdRatio: 0.92,
      tailRetentionRatio: 0.15,
      outputDir: '.compact',
      sessionId: 'session-abc123',
    });

    expect(fw.write).toHaveBeenCalledTimes(1);
    const [filePath, content] = (fw.write as ReturnType<typeof vi.fn>).mock.calls[0];

    // Path format: .compact/session-abc123/compact-<timestamp>-1.json
    expect(filePath).toMatch(/^\.compact\/session-abc123\/compact-.+-1\.json$/);

    // Content is indented JSON of middle messages [u1, u2]
    const parsed = JSON.parse(content);
    expect(parsed).toHaveLength(2);
    expect(content).toContain('  ');

    // Result returns the file path
    expect(result.originalMessagesPath).toBe(filePath);
  });

  // BDD Scenario: F-006 多次压缩生成递增序号的文件
  it('should increment sequence number on multiple compactions', async () => {
    const makeMessages = () => [
      msg('system', 'sys'),
      msg('user', 'u1'),
      msg('user', 'u2'),
      msg('assistant', 'reply'),
    ];

    // First compaction
    const llm1 = createMockLlmClient([190000, 30000, 50000], 'Summary1');
    const fw1 = createMockFileWriter();
    await compactMessages(makeMessages(), {
      llmClient: llm1, fileWriter: fw1, logger: createMockLogger(),
      contextTokenLimit: 200000, compactThresholdRatio: 0.92,
      tailRetentionRatio: 0.15, sessionId: 'test',
    });

    // Second compaction (counter persists within same beforeEach scope)
    const llm2 = createMockLlmClient([190000, 30000, 50000], 'Summary2');
    const fw2 = createMockFileWriter();
    await compactMessages(makeMessages(), {
      llmClient: llm2, fileWriter: fw2, logger: createMockLogger(),
      contextTokenLimit: 200000, compactThresholdRatio: 0.92,
      tailRetentionRatio: 0.15, sessionId: 'test',
    });

    const path1 = (fw1.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const path2 = (fw2.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;

    expect(path1).toMatch(/-1\.json$/);
    expect(path2).toMatch(/-2\.json$/);
  });

  // BDD Scenario: F-006 文件写入失败不阻塞压缩流程
  it('should continue compaction when file write fails', async () => {
    const messages = [
      msg('system', 'sys'),
      msg('user', 'u1'),
      msg('user', 'u2'),
      msg('assistant', 'reply'),
    ];
    const llm = createMockLlmClient([190000, 30000, 50000], 'Summary');
    const fw: FileWriter = {
      write: vi.fn(async () => { throw new Error('Permission denied'); }),
    };
    const logger = createMockLogger();

    const result = await compactMessages(messages, {
      llmClient: llm, fileWriter: fw, logger,
      contextTokenLimit: 200000, compactThresholdRatio: 0.92,
      tailRetentionRatio: 0.15,
    });

    expect(result.compacted).toBe(true);
    expect(result.originalMessagesPath).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to persist original messages',
      expect.objectContaining({ error: expect.stringContaining('Permission denied') }),
    );
  });

  // BDD Scenario: F-007 首次调用成功无需重试
  it('should compact successfully on first LLM call without retries', async () => {
    const messages = [
      msg('system', 'sys'),
      msg('user', 'u1'),
      msg('user', 'u2'),
      msg('assistant', 'reply'),
    ];
    const llm: LlmClient = {
      countTokens: vi.fn()
        .mockResolvedValueOnce(190000)  // total
        .mockResolvedValueOnce(30000)   // tail scan
        .mockResolvedValueOnce(50000),  // compacted total
      summarize: vi.fn().mockResolvedValueOnce('First try summary'),
    };
    const fw = createMockFileWriter();
    const logger = createMockLogger();

    const result = await compactMessages(messages, {
      llmClient: llm, fileWriter: fw, logger,
      contextTokenLimit: 200000, compactThresholdRatio: 0.92,
      tailRetentionRatio: 0.15, maxRetries: 2,
    });

    expect(result.compacted).toBe(true);
    expect(llm.summarize).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  // BDD Scenario: F-007 首次失败后重试成功
  it('should retry and succeed on second LLM call', async () => {
    try {
      vi.useFakeTimers();

      const messages = [
        msg('system', 'sys'),
        msg('user', 'u1'),
        msg('user', 'u2'),
        msg('assistant', 'reply'),
      ];
      const llm: LlmClient = {
        countTokens: vi.fn()
          .mockResolvedValueOnce(190000)
          .mockResolvedValueOnce(30000)
          .mockResolvedValueOnce(50000),
        summarize: vi.fn()
          .mockRejectedValueOnce(new Error('Network error'))
          .mockResolvedValueOnce('Retry success summary'),
      };
      const fw = createMockFileWriter();
      const logger = createMockLogger();

      const promise = compactMessages(messages, {
        llmClient: llm, fileWriter: fw, logger,
        contextTokenLimit: 200000, compactThresholdRatio: 0.92,
        tailRetentionRatio: 0.15, maxRetries: 2,
      });

      await vi.advanceTimersByTimeAsync(2000);
      const result = await promise;

      expect(result.compacted).toBe(true);
      expect(llm.summarize).toHaveBeenCalledTimes(2);
      expect(logger.warn).toHaveBeenCalledWith(
        'Summarization attempt failed',
        expect.objectContaining({ attempt: 1, totalAttempts: 3 }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  // BDD Scenario: F-007 全部重试失败后跳过压缩
  it('should skip compaction after all retry attempts fail', async () => {
    try {
      vi.useFakeTimers();

      const messages = [
        msg('system', 'sys'),
        msg('user', 'u1'),
        msg('user', 'u2'),
        msg('assistant', 'reply'),
      ];
      const llm: LlmClient = {
        countTokens: vi.fn()
          .mockResolvedValueOnce(190000)
          .mockResolvedValueOnce(30000),
        summarize: vi.fn()
          .mockRejectedValueOnce(new Error('fail 1'))
          .mockRejectedValueOnce(new Error('fail 2'))
          .mockRejectedValueOnce(new Error('fail 3')),
      };
      const fw = createMockFileWriter();
      const logger = createMockLogger();

      const promise = compactMessages(messages, {
        llmClient: llm, fileWriter: fw, logger,
        contextTokenLimit: 200000, compactThresholdRatio: 0.92,
        tailRetentionRatio: 0.15, maxRetries: 2,
      });

      await vi.advanceTimersByTimeAsync(5000);
      const result = await promise;

      expect(result.compacted).toBe(false);
      expect(result.messages).toBe(messages);
      expect(llm.summarize).toHaveBeenCalledTimes(3);
      expect(logger.warn).toHaveBeenCalledTimes(3);
      expect(logger.error).toHaveBeenCalledWith(
        'All summarization attempts failed, skipping compaction',
        expect.objectContaining({ totalAttempts: 3 }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  // BDD Scenario: F-007 COMPACT_MAX_RETRIES 为 0 时不重试
  it('should not retry when maxRetries is 0', async () => {
    const messages = [
      msg('system', 'sys'),
      msg('user', 'u1'),
      msg('user', 'u2'),
      msg('assistant', 'reply'),
    ];
    const llm: LlmClient = {
      countTokens: vi.fn()
        .mockResolvedValueOnce(190000)
        .mockResolvedValueOnce(30000),
      summarize: vi.fn().mockRejectedValueOnce(new Error('LLM unavailable')),
    };
    const fw = createMockFileWriter();
    const logger = createMockLogger();

    const result = await compactMessages(messages, {
      llmClient: llm, fileWriter: fw, logger,
      contextTokenLimit: 200000, compactThresholdRatio: 0.92,
      tailRetentionRatio: 0.15, maxRetries: 0,
    });

    expect(result.compacted).toBe(false);
    expect(llm.summarize).toHaveBeenCalledTimes(1);
  });

  // BDD Scenario: F-008 压缩成功后返回完整统计信息
  it('should return correct stats after successful compaction', async () => {
    // Build 30 messages: 1 system + 29 user/assistant
    const messages: Message[] = [msg('system', 'sys prompt')];
    for (let i = 0; i < 29; i++) {
      messages.push(msg(i % 2 === 0 ? 'user' : 'assistant', `msg-${i + 1}`));
    }

    // Call sequence:
    // 1. Total: 190000 (above threshold 184000)
    // 2-6. Tail scan from end: 5 messages × 6000 = 30000 (>= 30000 budget, stop)
    // 7. Compacted total: 60000
    const llm: LlmClient = {
      countTokens: vi.fn()
        .mockResolvedValueOnce(190000)
        .mockResolvedValueOnce(6000)
        .mockResolvedValueOnce(6000)
        .mockResolvedValueOnce(6000)
        .mockResolvedValueOnce(6000)
        .mockResolvedValueOnce(6000)
        .mockResolvedValueOnce(60000),
      summarize: vi.fn().mockResolvedValueOnce('Compacted summary'),
    };
    const fw = createMockFileWriter();
    const logger = createMockLogger();

    const result = await compactMessages(messages, {
      llmClient: llm, fileWriter: fw, logger,
      contextTokenLimit: 200000, compactThresholdRatio: 0.92,
      tailRetentionRatio: 0.15,
    });

    expect(result.compacted).toBe(true);
    expect(result.stats).not.toBeNull();
    const stats = result.stats!;
    expect(stats.originalTokenCount).toBe(190000);
    expect(stats.compactedTokenCount).toBe(60000);
    expect(stats.compactionRatio).toBeCloseTo(60000 / 190000, 5);
    expect(stats.compactedMessageCount).toBe(24);
    expect(stats.retainedMessageCount).toBe(6); // 1 head + 5 tail
  });

  // BDD Scenario: F-008 未执行压缩时统计信息为空
  it('should return null stats when compaction is not triggered', async () => {
    const messages = [msg('user', 'hello')];
    const llm = createMockLlmClient([100000]); // below threshold 184000
    const fw = createMockFileWriter();

    const result = await compactMessages(messages, {
      llmClient: llm, fileWriter: fw,
      contextTokenLimit: 200000, compactThresholdRatio: 0.92,
    });

    expect(result.compacted).toBe(false);
    expect(result.stats).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Integration tests — full compactMessages pipeline
// ---------------------------------------------------------------------------

describe('compactMessages integration', () => {
  beforeEach(() => {
    resetCompactionCounter();
  });

  // BDD Scenario: 端到端正常压缩流程
  it('should execute full pipeline: detect → partition → persist → summarize → assemble', async () => {
    // 1 system + 25 user/assistant messages = 26 total
    const messages: Message[] = [msg('system', 'You are a helpful assistant')];
    for (let i = 0; i < 25; i++) {
      messages.push(msg(i % 2 === 0 ? 'user' : 'assistant', `conv-${i + 1}`));
    }

    // Token sequence:
    // 1. Total: 190000 (above 184000 threshold)
    // 2-6. Tail scan: 5 msgs × 6000 = 30000 (>= 30000 budget), stop
    // 7. Compacted total: 55000
    const llm: LlmClient = {
      countTokens: vi.fn()
        .mockResolvedValueOnce(190000)
        .mockResolvedValueOnce(6000)
        .mockResolvedValueOnce(6000)
        .mockResolvedValueOnce(6000)
        .mockResolvedValueOnce(6000)
        .mockResolvedValueOnce(6000)
        .mockResolvedValueOnce(55000),
      summarize: vi.fn().mockResolvedValueOnce('## Summary\nGoals: fix bug\nFiles: /src/app.ts'),
    };
    const fw = createMockFileWriter();
    const logger = createMockLogger();

    const result = await compactMessages(messages, {
      llmClient: llm, fileWriter: fw, logger,
      contextTokenLimit: 200000, compactThresholdRatio: 0.92,
      tailRetentionRatio: 0.15, sessionId: 'integ-session',
    });

    // Compaction succeeded
    expect(result.compacted).toBe(true);

    // Message structure: [system, summary(user), tail×5] = 7
    expect(result.messages).toHaveLength(7);
    expect(result.messages[0].role).toBe('system');
    expect(result.messages[0].content).toBe('You are a helpful assistant');
    expect(result.messages[1].role).toBe('user');
    expect(result.messages[1].content).toContain('Summary');
    // Tail messages preserved in order
    expect(result.messages[2].content).toBe('conv-21');
    expect(result.messages[6].content).toBe('conv-25');

    // File persistence
    expect(result.originalMessagesPath).not.toBeNull();
    expect(fw.write).toHaveBeenCalledTimes(1);

    // Stats
    expect(result.stats).not.toBeNull();
    expect(result.stats!.originalTokenCount).toBe(190000);
    expect(result.stats!.compactedTokenCount).toBe(55000);
    expect(result.stats!.compactedMessageCount).toBe(20);
    expect(result.stats!.retainedMessageCount).toBe(6); // 1 head + 5 tail
  });

  // BDD Scenario: token 未达阈值时不执行压缩
  it('should not compact, call LLM, or write files when below threshold', async () => {
    const messages = [msg('user', 'hello'), msg('assistant', 'hi')];
    const llm: LlmClient = {
      countTokens: vi.fn().mockResolvedValueOnce(100000),
      summarize: vi.fn(),
    };
    const fw = createMockFileWriter();

    const result = await compactMessages(messages, {
      llmClient: llm, fileWriter: fw,
      contextTokenLimit: 200000, compactThresholdRatio: 0.92,
    });

    expect(result.compacted).toBe(false);
    expect(result.messages).toBe(messages); // same reference
    expect(result.stats).toBeNull();
    expect(result.originalMessagesPath).toBeNull();
    expect(llm.summarize).not.toHaveBeenCalled();
    expect(fw.write).not.toHaveBeenCalled();
  });

  // BDD Scenario: 无 Middle 区域时跳过压缩
  it('should skip compaction when head + tail cover all messages', async () => {
    const messages = [
      msg('system', 'sys'),
      msg('user', 'big message'),
      msg('assistant', 'reply'),
    ];
    // Total: 190000 (above threshold), tail budget=198000 (0.99 ratio)
    // Tail scan: reply=100000 (<198000, continue), big_message=100000 (200000>=198000, stop)
    // → tail covers all non-system messages, middle is empty
    const llm: LlmClient = {
      countTokens: vi.fn()
        .mockResolvedValueOnce(190000)
        .mockResolvedValueOnce(100000)
        .mockResolvedValueOnce(100000),
      summarize: vi.fn(),
    };
    const fw = createMockFileWriter();
    const logger = createMockLogger();

    const result = await compactMessages(messages, {
      llmClient: llm, fileWriter: fw, logger,
      contextTokenLimit: 200000, compactThresholdRatio: 0.92,
      tailRetentionRatio: 0.99,
    });

    expect(result.compacted).toBe(false);
    expect(llm.summarize).not.toHaveBeenCalled();
  });

  // BDD Scenario: 多次压缩叠加
  it('should compact previously summarized messages in second compaction', async () => {
    // --- First compaction ---
    const messages1 = [
      msg('system', 'sys'),
      msg('user', 'u1'),
      msg('user', 'u2'),
      msg('assistant', 'reply1'),
    ];
    const llm1: LlmClient = {
      countTokens: vi.fn()
        .mockResolvedValueOnce(190000) // total
        .mockResolvedValueOnce(30000)  // tail: reply1
        .mockResolvedValueOnce(50000), // compacted
      summarize: vi.fn().mockResolvedValueOnce('Summary of first session'),
    };
    const fw1 = createMockFileWriter();

    const result1 = await compactMessages(messages1, {
      llmClient: llm1, fileWriter: fw1, logger: createMockLogger(),
      contextTokenLimit: 200000, compactThresholdRatio: 0.92,
      tailRetentionRatio: 0.15, sessionId: 'multi',
    });
    expect(result1.compacted).toBe(true);
    // result1.messages = [sys, "Summary of first session", reply1]

    // --- Simulate continued conversation, then second compaction ---
    const messages2 = [
      ...result1.messages,
      msg('user', 'new_u1'),
      msg('user', 'new_u2'),
      msg('assistant', 'new_reply'),
    ];
    // messages2 = [sys, summary1, reply1, new_u1, new_u2, new_reply] (6 msgs)
    const llm2: LlmClient = {
      countTokens: vi.fn()
        .mockResolvedValueOnce(190000)  // total
        .mockResolvedValueOnce(15000)   // tail: new_reply
        .mockResolvedValueOnce(15000)   // tail: new_u2 → 30000 >= 30000, stop
        .mockResolvedValueOnce(45000),  // compacted
      summarize: vi.fn().mockResolvedValueOnce('Condensed summary including prior summary'),
    };
    const fw2 = createMockFileWriter();

    const result2 = await compactMessages(messages2, {
      llmClient: llm2, fileWriter: fw2, logger: createMockLogger(),
      contextTokenLimit: 200000, compactThresholdRatio: 0.92,
      tailRetentionRatio: 0.15, sessionId: 'multi',
    });

    expect(result2.compacted).toBe(true);
    // First summary was in middle and got compacted
    expect(result2.messages[1].content).toBe('Condensed summary including prior summary');
    // Sequence incremented
    const path2 = (fw2.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(path2).toMatch(/-2\.json$/);
  });

  // BDD Scenario: 与 offload 组合使用
  it('should compact messages containing offloaded tool_result references', async () => {
    const messages: Message[] = [
      msg('system', 'sys'),
      msg('user', 'analyze this file'),
      {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 't1', name: 'readFile', input: { path: '/src/big.ts' } },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 't1',
            content: '[Content offloaded to /tmp/offload-001.txt]',
          },
        ],
      },
      msg('assistant', 'analysis complete'),
      msg('user', 'fix the bug'),
      msg('assistant', 'bug fixed'),
    ];

    // Token sequence:
    // 1. Total: 185000 (above 184000 threshold)
    // 2. Tail scan: 'bug fixed'=15000, 'fix the bug'=15000 → 30000 >= 30000, stop
    // 3. Compacted total: 40000
    const llm: LlmClient = {
      countTokens: vi.fn()
        .mockResolvedValueOnce(185000)
        .mockResolvedValueOnce(15000)
        .mockResolvedValueOnce(15000)
        .mockResolvedValueOnce(40000),
      summarize: vi.fn().mockResolvedValueOnce(
        '## Summary\nFiles: /src/big.ts (offloaded to /tmp/offload-001.txt)\nActions: analyzed and fixed bug',
      ),
    };
    const fw = createMockFileWriter();

    const result = await compactMessages(messages, {
      llmClient: llm, fileWriter: fw, logger: createMockLogger(),
      contextTokenLimit: 200000, compactThresholdRatio: 0.92,
      tailRetentionRatio: 0.15,
    });

    expect(result.compacted).toBe(true);
    // Summary contains offload reference
    expect(result.messages[1].content).toContain('offload');

    // Verify offloaded content was passed to LLM for summarization
    const summarizeCall = (llm.summarize as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(summarizeCall).toContain('offload');
    expect(summarizeCall).toContain('/tmp/offload-001.txt');
  });
});
