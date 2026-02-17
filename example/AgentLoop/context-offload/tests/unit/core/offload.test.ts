/**
 * Unit tests for the core offload algorithm.
 * Tests offload logic in isolation using a mock FileWriter.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { offloadToolResults } from '../../../src/core/offload.js';
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

describe('offloadToolResults', () => {
  let writer: ReturnType<typeof createMockWriter>;
  const outputDir = '/tmp/offload';

  beforeEach(() => {
    writer = createMockWriter();
  });

  it('should offload string tool_result with charCount >= 100', async () => {
    const content = makeString(150);
    const messages: Message[] = [
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_abc123',
            content,
          },
        ],
      },
    ];

    const result = await offloadToolResults(messages, outputDir, writer);

    expect(result.offloadedCount).toBe(1);
    expect(result.freedChars).toBe(150);
    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toBe('/tmp/offload/tool-result-toolu_abc123.md');
    expect(result.messages[0].content[0]).toEqual({
      type: 'tool_result',
      tool_use_id: 'toolu_abc123',
      content: '[Content offloaded to: ./tool-result-toolu_abc123.md]',
    });
    expect(writer.calls).toHaveLength(1);
    expect(writer.calls[0].content).toBe(content);
  });

  it('should skip tool_result with charCount < 100', async () => {
    const content = makeString(50);
    const messages: Message[] = [
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_small',
            content,
          },
        ],
      },
    ];

    const result = await offloadToolResults(messages, outputDir, writer);

    expect(result.offloadedCount).toBe(0);
    expect(result.freedChars).toBe(0);
    expect(result.files).toHaveLength(0);
    expect(result.messages[0].content[0]).toEqual({
      type: 'tool_result',
      tool_use_id: 'toolu_small',
      content,
    });
    expect(writer.calls).toHaveLength(0);
  });

  it('should offload tool_result with exactly 100 chars (boundary)', async () => {
    const content = makeString(100);
    const messages: Message[] = [
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_boundary',
            content,
          },
        ],
      },
    ];

    const result = await offloadToolResults(messages, outputDir, writer);

    expect(result.offloadedCount).toBe(1);
    expect(result.freedChars).toBe(100);
  });

  it('should NOT offload tool_result with 99 chars (boundary)', async () => {
    const content = makeString(99);
    const messages: Message[] = [
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_99',
            content,
          },
        ],
      },
    ];

    const result = await offloadToolResults(messages, outputDir, writer);

    expect(result.offloadedCount).toBe(0);
  });

  it('should offload ContentBlock[] tool_result using JSON.stringify length', async () => {
    const blockContent = [
      { type: 'text' as const, text: makeString(200) },
    ];
    const messages: Message[] = [
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_array',
            content: blockContent,
          },
        ],
      },
    ];

    const result = await offloadToolResults(messages, outputDir, writer);

    expect(result.offloadedCount).toBe(1);
    expect(result.freedChars).toBe(JSON.stringify(blockContent).length);
    expect(writer.calls[0].content).toBe(
      JSON.stringify(blockContent, null, 2),
    );
    // Replaced content should be a string reference
    const replacedBlock = result.messages[0].content[0];
    expect(replacedBlock.type).toBe('tool_result');
    if (replacedBlock.type === 'tool_result') {
      expect(typeof replacedBlock.content).toBe('string');
    }
  });

  it('should return empty result for empty messages', async () => {
    const result = await offloadToolResults([], outputDir, writer);

    expect(result.messages).toEqual([]);
    expect(result.offloadedCount).toBe(0);
    expect(result.freedChars).toBe(0);
    expect(result.files).toEqual([]);
  });

  it('should pass through messages without tool_result', async () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: 'Hello' }],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'read_file',
            input: { path: '/tmp/test' },
          },
        ],
      },
    ];

    const result = await offloadToolResults(messages, outputDir, writer);

    expect(result.messages).toEqual(messages);
    expect(result.offloadedCount).toBe(0);
    expect(writer.calls).toHaveLength(0);
  });

  it('should handle mixed scenario — partial offload', async () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_large1',
            content: makeString(200),
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_small',
            content: makeString(50),
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_large2',
            content: makeString(300),
          },
        ],
      },
    ];

    const result = await offloadToolResults(messages, outputDir, writer);

    expect(result.offloadedCount).toBe(2);
    expect(result.freedChars).toBe(500);
    expect(result.files).toHaveLength(2);

    // Second message should remain unchanged
    expect(result.messages[1].content[0]).toEqual({
      type: 'tool_result',
      tool_use_id: 'toolu_small',
      content: makeString(50),
    });
  });

  it('should not modify original messages array', async () => {
    const originalContent = makeString(200);
    const messages: Message[] = [
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_immutable',
            content: originalContent,
          },
        ],
      },
    ];

    // Deep snapshot before offload
    const snapshot = JSON.parse(JSON.stringify(messages));

    const result = await offloadToolResults(messages, outputDir, writer);

    // Original should be untouched
    expect(JSON.stringify(messages)).toBe(JSON.stringify(snapshot));
    // Result should be a different array reference
    expect(result.messages).not.toBe(messages);
  });

  it('should handle duplicate tool_use_id with suffix', async () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_dup',
            content: makeString(150),
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_dup',
            content: makeString(200),
          },
        ],
      },
    ];

    const result = await offloadToolResults(messages, outputDir, writer);

    expect(result.offloadedCount).toBe(2);
    expect(result.files).toContain('/tmp/offload/tool-result-toolu_dup.md');
    expect(result.files).toContain('/tmp/offload/tool-result-toolu_dup-1.md');
    expect(writer.calls).toHaveLength(2);
  });
});
