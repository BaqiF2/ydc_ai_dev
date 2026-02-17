/**
 * Unit tests for core offload logic.
 * Tests the offloadToolResult function with mock FileWriter.
 */

import { describe, it, expect } from 'vitest';
import { offloadToolResult, OFFLOAD_REFERENCE_PREFIX, OFFLOAD_REFERENCE_SUFFIX } from '../../../src/core/offload.js';
import type { FileWriter, Message } from '../../../src/core/types.js';

function createMockWriter(): FileWriter & { calls: Array<{ path: string; content: string }> } {
  const calls: Array<{ path: string; content: string }> = [];
  return {
    calls,
    async writeFile(filePath: string, content: string): Promise<void> {
      calls.push({ path: filePath, content });
    },
  };
}

describe('offloadToolResult', () => {
  it('should offload string content and replace with file path reference', async () => {
    const longContent = 'x'.repeat(2000);
    const message: Message = {
      role: 'user',
      content: longContent,
    };
    const writer = createMockWriter();

    const result = await offloadToolResult(message, 'sess-1', '.offload', writer);

    expect(result.file).toBe('.offload/sess-1/unknown.md');
    expect(result.message.content).toBe(
      `${OFFLOAD_REFERENCE_PREFIX}.offload/sess-1/unknown.md${OFFLOAD_REFERENCE_SUFFIX}`,
    );
    expect(writer.calls).toHaveLength(1);
    expect(writer.calls[0].content).toBe(longContent);
  });

  it('should offload ContentBlock[] content as JSON and extract tool_use_id', async () => {
    const message: Message = {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'toolu_abc',
          content: 'x'.repeat(2000),
        },
      ],
    };
    const writer = createMockWriter();

    const result = await offloadToolResult(message, 'sess-1', '.offload', writer);

    expect(result.file).toBe('.offload/sess-1/toolu_abc.md');
    expect(result.message.content).toContain('toolu_abc.md');
    expect(writer.calls[0].content).toBe(JSON.stringify(message.content));
  });

  it('should calculate freedChars correctly for string content', async () => {
    const longContent = 'x'.repeat(5000);
    const message: Message = {
      role: 'user',
      content: longContent,
    };
    const writer = createMockWriter();

    const result = await offloadToolResult(message, 'sess-1', '/tmp/offload', writer);

    const expectedReference = `${OFFLOAD_REFERENCE_PREFIX}/tmp/offload/sess-1/unknown.md${OFFLOAD_REFERENCE_SUFFIX}`;
    expect(result.freedChars).toBe(5000 - expectedReference.length);
  });

  it('should calculate freedChars correctly for ContentBlock[] content', async () => {
    const contentBlocks = [
      {
        type: 'tool_result' as const,
        tool_use_id: 'toolu_xyz',
        content: 'x'.repeat(3000),
      },
    ];
    const message: Message = {
      role: 'user',
      content: contentBlocks,
    };
    const writer = createMockWriter();

    const result = await offloadToolResult(message, 'sess-1', '.offload', writer);

    const serializedLength = JSON.stringify(contentBlocks).length;
    const referenceLength = result.message.content.length;
    expect(result.freedChars).toBe(serializedLength - referenceLength);
  });

  it('should not modify the original message (immutability)', async () => {
    const originalContent = 'x'.repeat(2000);
    const message: Message = {
      role: 'user',
      content: originalContent,
    };
    const writer = createMockWriter();

    const result = await offloadToolResult(message, 'sess-1', '.offload', writer);

    // Original message is unchanged
    expect(message.content).toBe(originalContent);
    // Returned message is a different object
    expect(result.message).not.toBe(message);
  });

  it('should return deep cloned message that does not share references', async () => {
    const contentBlocks = [
      {
        type: 'tool_result' as const,
        tool_use_id: 'toolu_deep',
        content: 'x'.repeat(2000),
      },
    ];
    const message: Message = {
      role: 'user',
      content: contentBlocks,
    };
    const writer = createMockWriter();

    const result = await offloadToolResult(message, 'sess-1', '.offload', writer);

    // Original content array is unchanged
    expect(Array.isArray(message.content)).toBe(true);
    expect(message.content).toHaveLength(1);
    // Returned message content is replaced with string
    expect(typeof result.message.content).toBe('string');
  });

  it('should produce correct reference format', async () => {
    const message: Message = {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'toolu_fmt',
          content: 'x'.repeat(2000),
        },
      ],
    };
    const writer = createMockWriter();

    const result = await offloadToolResult(message, 'sess-fmt', '/tmp/offload', writer);

    expect(result.message.content).toBe(
      '[Tool result offloaded to file: /tmp/offload/sess-fmt/toolu_fmt.md]',
    );
  });

  it('should propagate FileWriter errors', async () => {
    const message: Message = {
      role: 'user',
      content: 'x'.repeat(2000),
    };
    const failingWriter: FileWriter = {
      async writeFile(): Promise<void> {
        throw new Error('disk full');
      },
    };

    await expect(
      offloadToolResult(message, 'sess-1', '.offload', failingWriter),
    ).rejects.toThrow('disk full');
  });

  it('should propagate permission denied errors', async () => {
    const message: Message = {
      role: 'user',
      content: 'x'.repeat(2000),
    };
    const failingWriter: FileWriter = {
      async writeFile(): Promise<void> {
        throw new Error('permission denied');
      },
    };

    await expect(
      offloadToolResult(message, 'sess-1', '.offload', failingWriter),
    ).rejects.toThrow('permission denied');
  });
});
