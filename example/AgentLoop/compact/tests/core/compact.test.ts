/**
 * Tests for core compact algorithm (v2) — partitioning, assembly, file restoration,
 * threshold detection, and full compaction workflow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  compactMessages,
  shouldCompact,
  partitionMessages,
  assembleMessages,
  restoreRecentFiles,
  resetCompactionCounter,
} from '../../src/core/compact.js';
import type {
  Message,
  CompactOptions,
  LlmClient,
  FileWriter,
  FileReader,
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

function createMockFileReader(files: Record<string, string>): FileReader {
  return {
    read: vi.fn(async (path: string) => {
      if (path in files) return files[path];
      throw new Error('ENOENT');
    }),
    exists: vi.fn(async (path: string) => path in files),
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

function readFileMsg(filePath: string): Message {
  return {
    role: 'assistant',
    content: [
      {
        type: 'tool_use',
        id: `tool_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: 'read_file',
        input: { path: filePath },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tests: shouldCompact
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

// ---------------------------------------------------------------------------
// Tests: partitionMessages (v2 — Head/Rest, synchronous)
// ---------------------------------------------------------------------------

describe('partitionMessages', () => {
  // BDD: 正常分区：system 消息归入 Head，其余归入 Rest
  it('should partition system messages into head and rest into rest', () => {
    const messages = [
      msg('system', 'sys1'),
      msg('system', 'sys2'),
      msg('user', 'u1'), msg('assistant', 'a1'),
      msg('user', 'u2'), msg('assistant', 'a2'),
      msg('user', 'u3'),
    ];

    const result = partitionMessages(messages);
    expect(result.head).toHaveLength(2);
    expect(result.head[0].role).toBe('system');
    expect(result.head[1].role).toBe('system');
    expect(result.rest).toHaveLength(5);
    expect(result.head.length + result.rest.length).toBe(messages.length);
  });

  // BDD: 无 system 消息：所有消息归入 Rest
  it('should have empty head when no system messages', () => {
    const messages = [
      msg('user', 'u1'), msg('assistant', 'a1'),
      msg('user', 'u2'), msg('assistant', 'a2'),
    ];

    const result = partitionMessages(messages);
    expect(result.head).toHaveLength(0);
    expect(result.rest).toHaveLength(4);
  });

  // BDD: 只有 system 消息：Rest 为空
  it('should have empty rest when only system messages', () => {
    const messages = [
      msg('system', 'sys1'),
      msg('system', 'sys2'),
      msg('system', 'sys3'),
    ];

    const result = partitionMessages(messages);
    expect(result.head).toHaveLength(3);
    expect(result.rest).toHaveLength(0);
  });

  // BDD: 空消息列表
  it('should return empty head and rest for empty messages', () => {
    const result = partitionMessages([]);
    expect(result.head).toHaveLength(0);
    expect(result.rest).toHaveLength(0);
  });

  // BDD: system 消息不连续：仅开头连续的归入 Head
  it('should only put consecutive leading system messages in head', () => {
    const messages = [
      msg('system', 'sys1'),
      msg('system', 'sys2'),
      msg('user', 'u1'),
      msg('system', 'sys3'),
      msg('assistant', 'a1'),
    ];

    const result = partitionMessages(messages);
    expect(result.head).toHaveLength(2);
    expect(result.rest).toHaveLength(3);
    expect(result.rest[0].content).toBe('u1');
    expect(result.rest[1].role).toBe('system');
    expect(result.rest[2].role).toBe('assistant');
  });
});

// ---------------------------------------------------------------------------
// Tests: assembleMessages (v2 — head + summary pair + restored files)
// ---------------------------------------------------------------------------

describe('assembleMessages', () => {
  // BDD: 完整组装：Head + Summary + Restored files
  it('should assemble head + summary pair + restored file pairs', () => {
    const head = [msg('system', 'sys')];
    const restoredFiles: Message[] = [
      msg('user', '[Restored after compact] a.ts:\ncontent a'),
      msg('user', '[Restored after compact] b.ts:\ncontent b'),
    ];

    const result = assembleMessages(head, 'Summary text', restoredFiles);

    expect(result).toHaveLength(7);
    // 1. system
    expect(result[0].role).toBe('system');
    // 2. summary user
    expect(result[1].role).toBe('user');
    expect(result[1].content).toContain('[Conversation compressed]');
    expect(result[1].content).toContain('Summary text');
    // 3. summary assistant ack
    expect(result[2].role).toBe('assistant');
    expect(result[2].content).toBe('Understood. I have the context from the compressed conversation. Continuing work.');
    // 4. restored file 1
    expect(result[3].role).toBe('user');
    expect((result[3].content as string)).toContain('[Restored after compact]');
    // 5. restored file 1 ack
    expect(result[4].role).toBe('assistant');
    expect(result[4].content).toBe('Noted, file content restored.');
    // 6. restored file 2
    expect(result[5].role).toBe('user');
    // 7. restored file 2 ack
    expect(result[6].role).toBe('assistant');
    expect(result[6].content).toBe('Noted, file content restored.');
  });

  // BDD: 无文件恢复：仅 Head + Summary pair
  it('should assemble head + summary pair when no restored files', () => {
    const head = [msg('system', 'sys')];
    const result = assembleMessages(head, 'Summary text', []);

    expect(result).toHaveLength(3);
    expect(result[0].role).toBe('system');
    expect(result[1].role).toBe('user');
    expect(result[1].content).toContain('Summary text');
    expect(result[2].role).toBe('assistant');
  });

  // BDD: 无 Head：Summary pair 为首条消息
  it('should put summary pair first when head is empty', () => {
    const restoredFiles: Message[] = [
      msg('user', '[Restored after compact] a.ts:\ncontent a'),
    ];
    const result = assembleMessages([], 'Summary text', restoredFiles);

    expect(result).toHaveLength(4);
    expect(result[0].role).toBe('user');
    expect(result[0].content).toContain('[Conversation compressed]');
    expect(result[1].role).toBe('assistant');
    expect(result[2].role).toBe('user');
    expect(result[3].role).toBe('assistant');
  });

  // BDD: 轮次顺序验证：user/assistant 严格交替
  it('should maintain strict user/assistant alternation after head', () => {
    const head = [msg('system', 'sys1'), msg('system', 'sys2')];
    const restoredFiles: Message[] = [
      msg('user', '[Restored after compact] a.ts:\ncontent a'),
      msg('user', '[Restored after compact] b.ts:\ncontent b'),
      msg('user', '[Restored after compact] c.ts:\ncontent c'),
    ];

    const result = assembleMessages(head, 'Summary', restoredFiles);

    // Check alternation after system messages
    const nonSystem = result.filter(m => m.role !== 'system');
    for (let i = 0; i < nonSystem.length; i++) {
      expect(nonSystem[i].role).toBe(i % 2 === 0 ? 'user' : 'assistant');
    }
  });

  // BDD: 不可变性：不修改输入参数
  it('should not mutate input arrays', () => {
    const head = [msg('system', 'sys')];
    const restoredFiles: Message[] = [msg('user', 'file content')];
    const headSnapshot = [...head];
    const filesSnapshot = [...restoredFiles];

    const result = assembleMessages(head, 'Summary', restoredFiles);

    expect(result).not.toBe(head);
    expect(result).not.toBe(restoredFiles);
    expect(head).toHaveLength(headSnapshot.length);
    expect(restoredFiles).toHaveLength(filesSnapshot.length);
    expect(head[0].content).toBe(headSnapshot[0].content);
    expect(restoredFiles[0].content).toBe(filesSnapshot[0].content);
  });
});

// ---------------------------------------------------------------------------
// Tests: restoreRecentFiles
// ---------------------------------------------------------------------------

describe('restoreRecentFiles', () => {
  const workDir = '/project';

  // BDD: 正常恢复：扫描 read_file 调用并恢复文件内容
  it('should restore files in most-recent-first order', async () => {
    const messages: Message[] = [
      readFileMsg('/project/a.ts'),
      readFileMsg('/project/b.ts'),
      readFileMsg('/project/c.ts'),
    ];
    const fileReader = createMockFileReader({
      '/project/a.ts': 'content a',
      '/project/b.ts': 'content b',
      '/project/c.ts': 'content c',
    });

    const result = await restoreRecentFiles(messages, {
      maxRestoreFiles: 5,
      maxRestoreTokensPerFile: 5000,
      maxRestoreTokensTotal: 50000,
      workDir,
      fileReader,
      logger: createMockLogger(),
    });

    expect(result.messages).toHaveLength(3);
    // Most recent first: c, b, a
    expect((result.messages[0].content as string)).toContain('c.ts');
    expect((result.messages[1].content as string)).toContain('b.ts');
    expect((result.messages[2].content as string)).toContain('a.ts');
    expect(result.messages[0].role).toBe('user');
    expect((result.messages[0].content as string)).toContain('[Restored after compact]');
  });

  // BDD: 无 read_file 调用：返回空数组
  it('should return empty array when no read_file calls', async () => {
    const messages: Message[] = [
      msg('user', 'hello'),
      msg('assistant', 'hi'),
    ];

    const result = await restoreRecentFiles(messages, {
      maxRestoreFiles: 5,
      maxRestoreTokensPerFile: 5000,
      maxRestoreTokensTotal: 50000,
      workDir,
      fileReader: createMockFileReader({}),
      logger: createMockLogger(),
    });

    expect(result.messages).toHaveLength(0);
    expect(result.totalTokens).toBe(0);
  });

  // BDD: 文件不存在：跳过并继续
  it('should skip non-existent files and continue', async () => {
    const messages: Message[] = [
      readFileMsg('/project/a.ts'),
      readFileMsg('/project/b.ts'),
      readFileMsg('/project/c.ts'),
    ];
    const fileReader = createMockFileReader({
      '/project/a.ts': 'content a',
      '/project/c.ts': 'content c',
      // b.ts missing
    });
    const logger = createMockLogger();

    const result = await restoreRecentFiles(messages, {
      maxRestoreFiles: 5,
      maxRestoreTokensPerFile: 5000,
      maxRestoreTokensTotal: 50000,
      workDir,
      fileReader,
      logger,
    });

    // c.ts and a.ts restored (most recent first, b.ts skipped)
    expect(result.messages).toHaveLength(2);
    expect((result.messages[0].content as string)).toContain('c.ts');
    expect((result.messages[1].content as string)).toContain('a.ts');
    expect(logger.warn).toHaveBeenCalledWith(
      'File not found, skipping restoration',
      expect.objectContaining({ filePath: '/project/b.ts' }),
    );
  });

  // BDD: 路径穿越：跳过 workDir 之外的文件
  it('should skip files outside workDir (path traversal)', async () => {
    const messages: Message[] = [
      readFileMsg('../../etc/passwd'),
    ];
    const fileReader = createMockFileReader({});
    const logger = createMockLogger();

    const result = await restoreRecentFiles(messages, {
      maxRestoreFiles: 5,
      maxRestoreTokensPerFile: 5000,
      maxRestoreTokensTotal: 50000,
      workDir,
      fileReader,
      logger,
    });

    expect(result.messages).toHaveLength(0);
    expect(logger.warn).toHaveBeenCalledWith(
      'Path traversal detected, skipping file',
      expect.objectContaining({ filePath: '../../etc/passwd' }),
    );
  });

  // BDD: 单文件超 token 限制：跳过该文件
  it('should skip files exceeding per-file token limit', async () => {
    const messages: Message[] = [
      readFileMsg('/project/small.ts'),
      readFileMsg('/project/large.ts'),
    ];
    // large.ts: 24000 chars ÷ 4 chars/token = 6000 tokens > 5000 limit
    // small.ts: 400 chars ÷ 4 = 100 tokens
    const fileReader = createMockFileReader({
      '/project/small.ts': 'x'.repeat(400),
      '/project/large.ts': 'x'.repeat(24000),
    });

    const result = await restoreRecentFiles(messages, {
      maxRestoreFiles: 5,
      maxRestoreTokensPerFile: 5000,
      maxRestoreTokensTotal: 50000,
      workDir,
      fileReader,
      logger: createMockLogger(),
    });

    // Only small.ts restored (large.ts most recent but exceeds limit)
    expect(result.messages).toHaveLength(1);
    expect((result.messages[0].content as string)).toContain('small.ts');
  });

  // BDD: 总 token 超限：达到上限后停止
  it('should stop when total token limit is reached', async () => {
    const messages: Message[] = [
      readFileMsg('/project/a.ts'),
      readFileMsg('/project/b.ts'),
      readFileMsg('/project/c.ts'),
      readFileMsg('/project/d.ts'),
      readFileMsg('/project/e.ts'),
    ];
    // Each file ~4000 tokens (16000 chars ÷ 4)
    const fileReader = createMockFileReader({
      '/project/a.ts': 'x'.repeat(16000),
      '/project/b.ts': 'x'.repeat(16000),
      '/project/c.ts': 'x'.repeat(16000),
      '/project/d.ts': 'x'.repeat(16000),
      '/project/e.ts': 'x'.repeat(16000),
    });

    const result = await restoreRecentFiles(messages, {
      maxRestoreFiles: 5,
      maxRestoreTokensPerFile: 5000,
      maxRestoreTokensTotal: 10000,
      workDir,
      fileReader,
      logger: createMockLogger(),
    });

    // First 2 files fit (8000), 3rd would exceed 10000, stop
    expect(result.messages).toHaveLength(2);
  });

  // BDD: maxRestoreFiles 限制：只恢复指定数量
  it('should only restore up to maxRestoreFiles', async () => {
    const messages: Message[] = [];
    for (let i = 0; i < 10; i++) {
      messages.push(readFileMsg(`/project/file${i}.ts`));
    }
    const files: Record<string, string> = {};
    for (let i = 0; i < 10; i++) {
      files[`/project/file${i}.ts`] = `content ${i}`;
    }

    const result = await restoreRecentFiles(messages, {
      maxRestoreFiles: 3,
      maxRestoreTokensPerFile: 5000,
      maxRestoreTokensTotal: 50000,
      workDir,
      fileReader: createMockFileReader(files),
      logger: createMockLogger(),
    });

    expect(result.messages).toHaveLength(3);
    // Most recent 3: file9, file8, file7
    expect((result.messages[0].content as string)).toContain('file9.ts');
    expect((result.messages[1].content as string)).toContain('file8.ts');
    expect((result.messages[2].content as string)).toContain('file7.ts');
  });

  // BDD: 同一文件多次读取：只恢复一次
  it('should deduplicate files, using last access order', async () => {
    const messages: Message[] = [
      readFileMsg('/project/a.ts'),  // order 0
      readFileMsg('/project/b.ts'),  // order 1
      readFileMsg('/project/a.ts'),  // order 2 (overwrites 0)
      readFileMsg('/project/c.ts'),  // order 3
    ];
    const fileReader = createMockFileReader({
      '/project/a.ts': 'content a',
      '/project/b.ts': 'content b',
      '/project/c.ts': 'content c',
    });

    const result = await restoreRecentFiles(messages, {
      maxRestoreFiles: 5,
      maxRestoreTokensPerFile: 5000,
      maxRestoreTokensTotal: 50000,
      workDir,
      fileReader,
      logger: createMockLogger(),
    });

    expect(result.messages).toHaveLength(3);
    // Order: c(3), a(2), b(1)
    expect((result.messages[0].content as string)).toContain('c.ts');
    expect((result.messages[1].content as string)).toContain('a.ts');
    expect((result.messages[2].content as string)).toContain('b.ts');
  });

  // BDD: 文件读取失败（OS 错误）：跳过并继续
  it('should skip files that fail to read and continue', async () => {
    const messages: Message[] = [
      readFileMsg('/project/a.ts'),
      readFileMsg('/project/b.ts'),
    ];
    // a.ts exists but throws on read
    const fileReader: FileReader = {
      read: vi.fn(async (path: string) => {
        if (path === '/project/a.ts') throw new Error('EACCES: permission denied');
        return 'content b';
      }),
      exists: vi.fn(async () => true),
    };
    const logger = createMockLogger();

    const result = await restoreRecentFiles(messages, {
      maxRestoreFiles: 5,
      maxRestoreTokensPerFile: 5000,
      maxRestoreTokensTotal: 50000,
      workDir,
      fileReader,
      logger,
    });

    // Only b.ts (most recent is b, a fails on read)
    // Actually order: b(1) > a(0), so b is tried first, then a
    // b succeeds, a fails
    expect(result.messages).toHaveLength(1);
    expect((result.messages[0].content as string)).toContain('b.ts');
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to read file, skipping restoration',
      expect.objectContaining({ error: expect.stringContaining('EACCES') }),
    );
  });

  // BDD: maxRestoreFiles 为 0：不恢复任何文件
  it('should return empty when maxRestoreFiles is 0', async () => {
    const messages: Message[] = [
      readFileMsg('/project/a.ts'),
    ];

    const result = await restoreRecentFiles(messages, {
      maxRestoreFiles: 0,
      maxRestoreTokensPerFile: 5000,
      maxRestoreTokensTotal: 50000,
      workDir,
      fileReader: createMockFileReader({ '/project/a.ts': 'content' }),
      logger: createMockLogger(),
    });

    expect(result.messages).toHaveLength(0);
    expect(result.totalTokens).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: compactMessages
// ---------------------------------------------------------------------------

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

    // Call sequence:
    // 1. Total count: 190000 (above threshold)
    // 2. Compacted total: 50000
    const llm = createMockLlmClient(
      [190000, 50000],
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
      sessionId: 'test-session',
      maxRestoreFiles: 0, // disable file restore for this test
    });

    expect(result.compacted).toBe(true);
    expect(result.stats).not.toBeNull();
    expect(result.messages[0].role).toBe('system');
    expect(result.messages[1].role).toBe('user');
    expect((result.messages[1].content as string)).toContain('[Conversation compressed]');
    expect(result.messages[2].role).toBe('assistant');
    expect(fw.write).toHaveBeenCalled();
  });

  it('should skip compaction when rest is empty (only system messages)', async () => {
    const messages = [
      msg('system', 'sys'),
    ];

    const llm = createMockLlmClient([190000]);
    const fw = createMockFileWriter();
    const logger = createMockLogger();

    const result = await compactMessages(messages, {
      llmClient: llm,
      fileWriter: fw,
      logger,
      contextTokenLimit: 200000,
      compactThresholdRatio: 0.92,
    });

    expect(result.compacted).toBe(false);
  });

  // BDD F-006: 正常持久化原始消息
  it('should persist rest messages as indented JSON with correct path format', async () => {
    const messages = [
      msg('system', 'sys'),
      msg('user', 'u1'),
      msg('user', 'u2'),
      msg('assistant', 'reply'),
    ];
    // Call sequence: total=190000, compacted=50000
    const llm = createMockLlmClient([190000, 50000], 'Summary');
    const fw = createMockFileWriter();
    const logger = createMockLogger();

    const result = await compactMessages(messages, {
      llmClient: llm,
      fileWriter: fw,
      logger,
      contextTokenLimit: 200000,
      compactThresholdRatio: 0.92,
      outputDir: '.compact',
      sessionId: 'session-abc123',
      maxRestoreFiles: 0,
    });

    expect(fw.write).toHaveBeenCalledTimes(1);
    const [filePath, content] = (fw.write as ReturnType<typeof vi.fn>).mock.calls[0];

    // Path format: .compact/session-abc123/compact-<timestamp>-1.json
    expect(filePath).toMatch(/^\.compact\/session-abc123\/compact-.+-1\.json$/);

    // Content is indented JSON of rest messages [u1, u2, reply]
    const parsed = JSON.parse(content);
    expect(parsed).toHaveLength(3);
    expect(content).toContain('  ');

    expect(result.originalMessagesPath).toBe(filePath);
  });

  // BDD F-006: 多次压缩生成递增序号的文件
  it('should increment sequence number on multiple compactions', async () => {
    const makeMessages = () => [
      msg('system', 'sys'),
      msg('user', 'u1'),
      msg('user', 'u2'),
      msg('assistant', 'reply'),
    ];

    const llm1 = createMockLlmClient([190000, 50000], 'Summary1');
    const fw1 = createMockFileWriter();
    await compactMessages(makeMessages(), {
      llmClient: llm1, fileWriter: fw1, logger: createMockLogger(),
      contextTokenLimit: 200000, compactThresholdRatio: 0.92,
      sessionId: 'test', maxRestoreFiles: 0,
    });

    const llm2 = createMockLlmClient([190000, 50000], 'Summary2');
    const fw2 = createMockFileWriter();
    await compactMessages(makeMessages(), {
      llmClient: llm2, fileWriter: fw2, logger: createMockLogger(),
      contextTokenLimit: 200000, compactThresholdRatio: 0.92,
      sessionId: 'test', maxRestoreFiles: 0,
    });

    const path1 = (fw1.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const path2 = (fw2.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;

    expect(path1).toMatch(/-1\.json$/);
    expect(path2).toMatch(/-2\.json$/);
  });

  // BDD F-006: 文件写入失败不阻塞压缩流程
  it('should continue compaction when file write fails', async () => {
    const messages = [
      msg('system', 'sys'),
      msg('user', 'u1'),
      msg('user', 'u2'),
      msg('assistant', 'reply'),
    ];
    const llm = createMockLlmClient([190000, 50000], 'Summary');
    const fw: FileWriter = {
      write: vi.fn(async () => { throw new Error('Permission denied'); }),
    };
    const logger = createMockLogger();

    const result = await compactMessages(messages, {
      llmClient: llm, fileWriter: fw, logger,
      contextTokenLimit: 200000, compactThresholdRatio: 0.92,
      maxRestoreFiles: 0,
    });

    expect(result.compacted).toBe(true);
    expect(result.originalMessagesPath).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to persist original messages',
      expect.objectContaining({ error: expect.stringContaining('Permission denied') }),
    );
  });

  // BDD F-007: 首次调用成功无需重试
  it('should compact successfully on first LLM call without retries', async () => {
    const messages = [
      msg('system', 'sys'),
      msg('user', 'u1'),
      msg('user', 'u2'),
      msg('assistant', 'reply'),
    ];
    const llm: LlmClient = {
      countTokens: vi.fn()
        .mockResolvedValueOnce(190000)
        .mockResolvedValueOnce(50000),
      summarize: vi.fn().mockResolvedValueOnce('First try summary'),
    };
    const fw = createMockFileWriter();
    const logger = createMockLogger();

    const result = await compactMessages(messages, {
      llmClient: llm, fileWriter: fw, logger,
      contextTokenLimit: 200000, compactThresholdRatio: 0.92,
      maxRetries: 2, maxRestoreFiles: 0,
    });

    expect(result.compacted).toBe(true);
    expect(llm.summarize).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  // BDD F-007: 首次失败后重试成功
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
        maxRetries: 2, maxRestoreFiles: 0,
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

  // BDD F-007: 全部重试失败后跳过压缩
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
          .mockResolvedValueOnce(190000),
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
        maxRetries: 2, maxRestoreFiles: 0,
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

  // BDD F-007: COMPACT_MAX_RETRIES 为 0 时不重试
  it('should not retry when maxRetries is 0', async () => {
    const messages = [
      msg('system', 'sys'),
      msg('user', 'u1'),
      msg('user', 'u2'),
      msg('assistant', 'reply'),
    ];
    const llm: LlmClient = {
      countTokens: vi.fn()
        .mockResolvedValueOnce(190000),
      summarize: vi.fn().mockRejectedValueOnce(new Error('LLM unavailable')),
    };
    const fw = createMockFileWriter();
    const logger = createMockLogger();

    const result = await compactMessages(messages, {
      llmClient: llm, fileWriter: fw, logger,
      contextTokenLimit: 200000, compactThresholdRatio: 0.92,
      maxRetries: 0, maxRestoreFiles: 0,
    });

    expect(result.compacted).toBe(false);
    expect(llm.summarize).toHaveBeenCalledTimes(1);
  });

  // BDD F-008/F-009: 压缩成功后返回完整统计信息
  it('should return correct stats after successful compaction', async () => {
    const messages: Message[] = [msg('system', 'sys prompt')];
    for (let i = 0; i < 29; i++) {
      messages.push(msg(i % 2 === 0 ? 'user' : 'assistant', `msg-${i + 1}`));
    }

    const llm: LlmClient = {
      countTokens: vi.fn()
        .mockResolvedValueOnce(190000)  // total
        .mockResolvedValueOnce(60000),  // compacted
      summarize: vi.fn().mockResolvedValueOnce('Compacted summary'),
    };
    const fw = createMockFileWriter();
    const logger = createMockLogger();

    const result = await compactMessages(messages, {
      llmClient: llm, fileWriter: fw, logger,
      contextTokenLimit: 200000, compactThresholdRatio: 0.92,
      maxRestoreFiles: 0,
    });

    expect(result.compacted).toBe(true);
    expect(result.stats).not.toBeNull();
    const stats = result.stats!;
    expect(stats.originalTokenCount).toBe(190000);
    expect(stats.compactedTokenCount).toBe(60000);
    expect(stats.compactionRatio).toBeCloseTo(60000 / 190000, 5);
    expect(stats.compactedMessageCount).toBe(29); // all non-system
    expect(stats.retainedMessageCount).toBe(1); // just head
    expect(stats.restoredFileCount).toBe(0);
    expect(stats.restoredTokenCount).toBe(0);
  });

  // BDD: 统计信息包含恢复文件数和 token 数
  it('should include restoredFileCount and restoredTokenCount in stats', async () => {
    const messages: Message[] = [
      msg('system', 'sys'),
      msg('user', 'analyze file'),
      readFileMsg('/project/src/app.ts'),
      msg('user', 'continue'),
      readFileMsg('/project/src/index.ts'),
      msg('assistant', 'done'),
    ];

    const llm: LlmClient = {
      countTokens: vi.fn()
        .mockResolvedValueOnce(190000) // total
        .mockResolvedValueOnce(50000), // compacted
      summarize: vi.fn().mockResolvedValueOnce('Summary'),
    };
    const fw = createMockFileWriter();
    const fileReader = createMockFileReader({
      '/project/src/app.ts': 'x'.repeat(400),   // 100 tokens
      '/project/src/index.ts': 'x'.repeat(800), // 200 tokens
    });

    const result = await compactMessages(messages, {
      llmClient: llm, fileWriter: fw, logger: createMockLogger(),
      contextTokenLimit: 200000, compactThresholdRatio: 0.92,
      fileReader,
      workDir: '/project',
    });

    expect(result.compacted).toBe(true);
    expect(result.stats!.restoredFileCount).toBe(2);
    expect(result.stats!.restoredTokenCount).toBeGreaterThan(0);
  });

  // BDD: 未执行压缩时统计信息为空
  it('should return null stats when compaction is not triggered', async () => {
    const messages = [msg('user', 'hello')];
    const llm = createMockLlmClient([100000]);
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

  // BDD: 端到端全量压缩流程：带文件恢复
  it('should execute full pipeline with file restoration', async () => {
    const messages: Message[] = [
      msg('system', 'You are a helpful assistant'),
      msg('user', 'read file'),
      readFileMsg('/project/src/app.ts'),
      msg('user', 'analyze'),
      readFileMsg('/project/src/index.ts'),
      msg('assistant', 'analysis complete'),
    ];

    const llm: LlmClient = {
      countTokens: vi.fn()
        .mockResolvedValueOnce(190000)  // total
        .mockResolvedValueOnce(55000),  // compacted
      summarize: vi.fn().mockResolvedValueOnce('## Summary\nGoals: analyze files'),
    };
    const fw = createMockFileWriter();
    const fileReader = createMockFileReader({
      '/project/src/app.ts': 'const app = express();',
      '/project/src/index.ts': 'import { app } from "./app";',
    });
    const logger = createMockLogger();

    const result = await compactMessages(messages, {
      llmClient: llm, fileWriter: fw, logger,
      contextTokenLimit: 200000, compactThresholdRatio: 0.92,
      sessionId: 'integ-session',
      fileReader,
      workDir: '/project',
    });

    expect(result.compacted).toBe(true);

    // Structure: [system, summary(user), ack(assistant), restored1(user), ack(assistant), restored2(user), ack(assistant)]
    expect(result.messages).toHaveLength(7);
    expect(result.messages[0].role).toBe('system');
    expect(result.messages[1].role).toBe('user');
    expect((result.messages[1].content as string)).toContain('[Conversation compressed]');
    expect(result.messages[2].role).toBe('assistant');
    expect(result.messages[3].role).toBe('user');
    expect((result.messages[3].content as string)).toContain('[Restored after compact]');
    expect(result.messages[4].role).toBe('assistant');
    expect(result.messages[4].content).toBe('Noted, file content restored.');

    // Stats
    expect(result.stats!.restoredFileCount).toBe(2);
    expect(result.stats!.restoredTokenCount).toBeGreaterThan(0);
    expect(result.originalMessagesPath).not.toBeNull();
  });

  // BDD: 端到端全量压缩：无文件恢复
  it('should execute full pipeline without file restoration when no read_file calls', async () => {
    const messages: Message[] = [msg('system', 'You are a helpful assistant')];
    for (let i = 0; i < 25; i++) {
      messages.push(msg(i % 2 === 0 ? 'user' : 'assistant', `conv-${i + 1}`));
    }

    const llm: LlmClient = {
      countTokens: vi.fn()
        .mockResolvedValueOnce(190000)  // total
        .mockResolvedValueOnce(55000),  // compacted
      summarize: vi.fn().mockResolvedValueOnce('## Summary\nGoals: fix bug\nFiles: /src/app.ts'),
    };
    const fw = createMockFileWriter();
    const logger = createMockLogger();

    const result = await compactMessages(messages, {
      llmClient: llm, fileWriter: fw, logger,
      contextTokenLimit: 200000, compactThresholdRatio: 0.92,
      sessionId: 'integ-session',
      maxRestoreFiles: 0,
    });

    expect(result.compacted).toBe(true);

    // Structure: [system, summary(user), ack(assistant)]
    expect(result.messages).toHaveLength(3);
    expect(result.messages[0].role).toBe('system');
    expect(result.messages[1].role).toBe('user');
    expect((result.messages[1].content as string)).toContain('[Conversation compressed]');
    expect(result.messages[2].role).toBe('assistant');

    expect(result.stats!.compactedMessageCount).toBe(25);
    expect(result.stats!.retainedMessageCount).toBe(1); // head only
    expect(result.stats!.restoredFileCount).toBe(0);
    expect(result.stats!.restoredTokenCount).toBe(0);
  });

  // BDD: token 未达阈值时不执行压缩
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
    expect(result.messages).toBe(messages);
    expect(result.stats).toBeNull();
    expect(result.originalMessagesPath).toBeNull();
    expect(llm.summarize).not.toHaveBeenCalled();
    expect(fw.write).not.toHaveBeenCalled();
  });

  // BDD: LLM 摘要失败：容错跳过压缩
  it('should skip compaction when all LLM retries fail', async () => {
    try {
      vi.useFakeTimers();

      const messages = [
        msg('system', 'sys'),
        msg('user', 'u1'),
        msg('assistant', 'reply'),
      ];
      const llm: LlmClient = {
        countTokens: vi.fn().mockResolvedValueOnce(190000),
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
        maxRetries: 2,
      });

      await vi.advanceTimersByTimeAsync(5000);
      const result = await promise;

      expect(result.compacted).toBe(false);
      expect(result.messages).toBe(messages);
      expect(logger.error).toHaveBeenCalledWith(
        'All summarization attempts failed, skipping compaction',
        expect.any(Object),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  // BDD: 多次压缩叠加
  it('should compact previously summarized messages in second compaction', async () => {
    // --- First compaction ---
    const messages1: Message[] = [
      msg('system', 'sys'),
      msg('user', 'u1'),
      readFileMsg('/project/src/app.ts'),
      msg('assistant', 'reply1'),
    ];
    const llm1: LlmClient = {
      countTokens: vi.fn()
        .mockResolvedValueOnce(190000) // total
        .mockResolvedValueOnce(50000), // compacted
      summarize: vi.fn().mockResolvedValueOnce('Summary of first session'),
    };
    const fw1 = createMockFileWriter();
    const fr1 = createMockFileReader({
      '/project/src/app.ts': 'const app = express();',
    });

    const result1 = await compactMessages(messages1, {
      llmClient: llm1, fileWriter: fw1, logger: createMockLogger(),
      contextTokenLimit: 200000, compactThresholdRatio: 0.92,
      sessionId: 'multi', fileReader: fr1, workDir: '/project',
    });
    expect(result1.compacted).toBe(true);

    // --- Second compaction ---
    const messages2 = [
      ...result1.messages,
      msg('user', 'new_u1'),
      readFileMsg('/project/src/index.ts'),
      msg('assistant', 'new_reply'),
    ];

    const llm2: LlmClient = {
      countTokens: vi.fn()
        .mockResolvedValueOnce(190000)  // total
        .mockResolvedValueOnce(45000),  // compacted
      summarize: vi.fn().mockResolvedValueOnce('Condensed summary including prior summary'),
    };
    const fw2 = createMockFileWriter();
    const fr2 = createMockFileReader({
      '/project/src/app.ts': 'const app = express();',
      '/project/src/index.ts': 'import { app } from "./app";',
    });

    const result2 = await compactMessages(messages2, {
      llmClient: llm2, fileWriter: fw2, logger: createMockLogger(),
      contextTokenLimit: 200000, compactThresholdRatio: 0.92,
      sessionId: 'multi', fileReader: fr2, workDir: '/project',
    });

    expect(result2.compacted).toBe(true);
    // Summary should contain the condensed content
    expect((result2.messages[1].content as string)).toContain('Condensed summary including prior summary');
    // Sequence incremented
    const path2 = (fw2.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(path2).toMatch(/-2\.json$/);
  });

  // BDD: 与 offload 组合使用
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

    const llm: LlmClient = {
      countTokens: vi.fn()
        .mockResolvedValueOnce(185000)
        .mockResolvedValueOnce(40000),
      summarize: vi.fn().mockResolvedValueOnce(
        '## Summary\nFiles: /src/big.ts (offloaded to /tmp/offload-001.txt)\nActions: analyzed and fixed bug',
      ),
    };
    const fw = createMockFileWriter();

    const result = await compactMessages(messages, {
      llmClient: llm, fileWriter: fw, logger: createMockLogger(),
      contextTokenLimit: 200000, compactThresholdRatio: 0.92,
      maxRestoreFiles: 0,
    });

    expect(result.compacted).toBe(true);
    expect((result.messages[1].content as string)).toContain('offload');

    const summarizeCall = (llm.summarize as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(summarizeCall).toContain('offload');
    expect(summarizeCall).toContain('/tmp/offload-001.txt');
  });
});
