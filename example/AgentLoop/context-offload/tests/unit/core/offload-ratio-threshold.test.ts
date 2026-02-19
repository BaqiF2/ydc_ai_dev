/**
 * Unit tests for the offload ratio threshold feature (F-006).
 * Tests the pre-scan logic that skips offloading when the offloadable chars
 * ratio is below OFFLOAD_RATIO_THRESHOLD.
 *
 * Core test groups:
 * - Default threshold (0.2): ratio sufficient, insufficient, boundary, empty, no tool_result
 * - Custom thresholds: threshold=0, threshold=1, threshold=0.5
 * - Side effect verification: writer not called when skipping
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Message, FileWriter } from '../../../src/core/types.js';

/** Create a mock FileWriter that records calls */
function createMockWriter(): FileWriter & {
  calls: Array<{ filePath: string; content: string }>;
} {
  const calls: Array<{ filePath: string; content: string }> = [];
  return {
    calls,
    async writeFile(filePath: string, content: string): Promise<void> {
      calls.push({ filePath, content });
    },
  };
}

/** Generate a string of exact length */
function makeString(length: number): string {
  return 'x'.repeat(length);
}

describe('offload ratio threshold (F-006)', () => {
  let writer: ReturnType<typeof createMockWriter>;
  const outputDir = '/tmp/offload';

  beforeEach(() => {
    writer = createMockWriter();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  /** Dynamic import to pick up env var changes after vi.resetModules() */
  async function importOffload() {
    const mod = await import('../../../src/core/offload.js');
    return mod.offloadToolResults;
  }

  // Scenario 1: 比例充足时正常执行卸载 (30% >= 20%)
  it('should offload when ratio >= threshold (30% >= 20%)', async () => {
    const offloadToolResults = await importOffload();

    // totalChars = 700 + 300 = 1000, offloadableChars = 300, ratio = 0.3
    const messages: Message[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: makeString(700) }],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_ratio_1',
            content: makeString(300),
          },
        ],
      },
    ];

    const result = await offloadToolResults(messages, outputDir, writer);

    expect(result.offloadedCount).toBeGreaterThan(0);
    expect(result.freedChars).toBeGreaterThan(0);
    expect(result.files.length).toBeGreaterThan(0);
    expect(result.messages).not.toBe(messages);
  });

  // Scenario 2: 比例不足时跳过卸载 (10% < 20%)
  it('should skip offload when ratio < threshold (10% < 20%)', async () => {
    const offloadToolResults = await importOffload();

    // totalChars = 900 + 100 = 1000, offloadableChars = 100, ratio = 0.1
    const messages: Message[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: makeString(900) }],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_ratio_2',
            content: makeString(100),
          },
        ],
      },
    ];

    const result = await offloadToolResults(messages, outputDir, writer);

    expect(result.offloadedCount).toBe(0);
    expect(result.freedChars).toBe(0);
    expect(result.files).toEqual([]);
    expect(result.messages).toBe(messages); // original reference
  });

  // Scenario 3: 比例恰好等于阈值时执行卸载 (20% >= 20%)
  it('should offload when ratio exactly equals threshold (20%)', async () => {
    const offloadToolResults = await importOffload();

    // totalChars = 400 + 100 = 500, offloadableChars = 100, ratio = 0.2
    const messages: Message[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: makeString(400) }],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_ratio_3',
            content: makeString(100),
          },
        ],
      },
    ];

    const result = await offloadToolResults(messages, outputDir, writer);

    expect(result.offloadedCount).toBeGreaterThan(0);
  });

  // Scenario 4: 比例略低于阈值时跳过卸载 (19.9% < 20%)
  it('should skip offload when ratio slightly below threshold (19.9%)', async () => {
    const offloadToolResults = await importOffload();

    // totalChars = 801 + 199 = 1000, offloadableChars = 199, ratio = 0.199
    const messages: Message[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: makeString(801) }],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_ratio_4',
            content: makeString(199),
          },
        ],
      },
    ];

    const result = await offloadToolResults(messages, outputDir, writer);

    expect(result.offloadedCount).toBe(0);
    expect(result.messages).toBe(messages);
  });

  // Scenario 5: 空消息列表直接跳过
  it('should skip and return original reference for empty messages', async () => {
    const offloadToolResults = await importOffload();

    const messages: Message[] = [];

    const result = await offloadToolResults(messages, outputDir, writer);

    expect(result.offloadedCount).toBe(0);
    expect(result.freedChars).toBe(0);
    expect(result.files).toEqual([]);
    expect(result.messages).toBe(messages); // original reference
  });

  // Scenario 6: 无 tool_result 时跳过
  it('should skip when no tool_result blocks exist', async () => {
    const offloadToolResults = await importOffload();

    const messages: Message[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: makeString(500) }],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_no_result',
            name: 'read_file',
            input: { path: '/tmp/test' },
          },
        ],
      },
    ];

    const result = await offloadToolResults(messages, outputDir, writer);

    expect(result.offloadedCount).toBe(0);
    expect(result.messages).toBe(messages);
  });

  // Scenario 7: 全部 tool_result 低于单块阈值时跳过
  it('should skip when all tool_results are below per-block threshold', async () => {
    const offloadToolResults = await importOffload();

    const messages: Message[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: makeString(500) }],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_small_1',
            content: makeString(50),
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_small_2',
            content: makeString(80),
          },
        ],
      },
    ];

    const result = await offloadToolResults(messages, outputDir, writer);

    expect(result.offloadedCount).toBe(0);
    expect(result.messages).toBe(messages);
  });

  // Scenario 8: threshold=0 且有可卸载内容时执行卸载
  it('should offload when threshold=0 and offloadable content exists', async () => {
    vi.stubEnv('OFFLOAD_RATIO_THRESHOLD', '0');
    const offloadToolResults = await importOffload();

    const messages: Message[] = [
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_zero_thresh',
            content: makeString(150),
          },
        ],
      },
    ];

    const result = await offloadToolResults(messages, outputDir, writer);

    expect(result.offloadedCount).toBeGreaterThan(0);
  });

  // Scenario 9: threshold=0 且无可卸载内容时跳过
  it('should skip when threshold=0 but no offloadable content', async () => {
    vi.stubEnv('OFFLOAD_RATIO_THRESHOLD', '0');
    const offloadToolResults = await importOffload();

    const messages: Message[] = [
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_zero_small',
            content: makeString(50),
          },
        ],
      },
    ];

    const result = await offloadToolResults(messages, outputDir, writer);

    expect(result.offloadedCount).toBe(0);
    expect(result.messages).toBe(messages);
  });

  // Scenario 10: threshold=1 时仅全部可卸载才执行
  it('should skip when threshold=1 and ratio is 80%', async () => {
    vi.stubEnv('OFFLOAD_RATIO_THRESHOLD', '1');
    const offloadToolResults = await importOffload();

    // totalChars = 200 + 800 = 1000, offloadableChars = 800, ratio = 0.8
    const messages: Message[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: makeString(200) }],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_full_thresh',
            content: makeString(800),
          },
        ],
      },
    ];

    const result = await offloadToolResults(messages, outputDir, writer);

    expect(result.offloadedCount).toBe(0);
    expect(result.messages).toBe(messages);
  });

  // Scenario 11: 环境变量配置自定义阈值
  it('should skip when custom threshold=0.5 and ratio is 40%', async () => {
    vi.stubEnv('OFFLOAD_RATIO_THRESHOLD', '0.5');
    const offloadToolResults = await importOffload();

    // totalChars = 600 + 400 = 1000, offloadableChars = 400, ratio = 0.4
    const messages: Message[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: makeString(600) }],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_custom',
            content: makeString(400),
          },
        ],
      },
    ];

    const result = await offloadToolResults(messages, outputDir, writer);

    expect(result.offloadedCount).toBe(0);
    expect(result.messages).toBe(messages);
  });

  // Scenario 12: 跳过时不产生文件写入副作用
  it('should not call writer.writeFile when skipping', async () => {
    const offloadToolResults = await importOffload();

    // totalChars = 900 + 100 = 1000, offloadableChars = 100, ratio = 0.1 < 0.2
    const messages: Message[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: makeString(900) }],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_no_write',
            content: makeString(100),
          },
        ],
      },
    ];

    const result = await offloadToolResults(messages, outputDir, writer);

    expect(writer.calls).toHaveLength(0);
    expect(result.offloadedCount).toBe(0);
  });
});
