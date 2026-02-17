/**
 * Integration tests for offload module with real file system operations.
 * Tests the full pipeline: core logic + NodeFileWriter + actual file I/O.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { offloadToolResults } from '../../src/index.js';
import type { Message } from '../../src/core/types.js';

/** Generate a string of exact length */
function makeString(length: number): string {
  return 'x'.repeat(length);
}

describe('offloadToolResults (integration)', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'offload-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should write offload file to disk and replace content', async () => {
    const originalContent = makeString(200);
    const messages: Message[] = [
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_int_test',
            content: originalContent,
          },
        ],
      },
    ];

    const outputDir = join(tempDir, 'offload');
    const result = await offloadToolResults(messages, { outputDir });

    // Verify result structure
    expect(result.offloadedCount).toBe(1);
    expect(result.freedChars).toBe(200);
    expect(result.files).toHaveLength(1);

    // Verify file was actually written
    const filePath = result.files[0];
    const fileContent = await readFile(filePath, 'utf-8');
    expect(fileContent).toBe(originalContent);

    // Verify message replacement
    const replacedBlock = result.messages[0].content[0];
    expect(replacedBlock.type).toBe('tool_result');
    if (replacedBlock.type === 'tool_result') {
      expect(replacedBlock.content).toBe(
        '[Content offloaded to: ./tool-result-toolu_int_test.md]',
      );
    }
  });

  it('should auto-create nested output directories', async () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_nested',
            content: makeString(120),
          },
        ],
      },
    ];

    const deepDir = join(tempDir, 'deep', 'nested', 'offload');
    const result = await offloadToolResults(messages, { outputDir: deepDir });

    expect(result.offloadedCount).toBe(1);
    const fileContent = await readFile(result.files[0], 'utf-8');
    expect(fileContent).toBe(makeString(120));
  });

  it('should not create files for small tool_results', async () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_tiny',
            content: makeString(50),
          },
        ],
      },
    ];

    const outputDir = join(tempDir, 'offload');
    const result = await offloadToolResults(messages, { outputDir });

    expect(result.offloadedCount).toBe(0);
    expect(result.files).toHaveLength(0);
  });
});
