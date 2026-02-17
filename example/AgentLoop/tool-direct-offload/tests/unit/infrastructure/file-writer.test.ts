/**
 * Unit tests for NodeFileWriter infrastructure implementation.
 * Tests real file system operations using temporary directories.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { NodeFileWriter } from '../../../src/infrastructure/file-writer.js';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('NodeFileWriter', () => {
  const testDirs: string[] = [];

  afterEach(async () => {
    for (const dir of testDirs) {
      await rm(dir, { recursive: true, force: true });
    }
    testDirs.length = 0;
  });

  it('should write content to a file and create directories', async () => {
    const writer = new NodeFileWriter();
    const testDir = join(tmpdir(), `offload-test-${Date.now()}`);
    testDirs.push(testDir);

    const filePath = join(testDir, 'sub', 'test.md');
    await writer.writeFile(filePath, 'hello world');

    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('hello world');
  });

  it('should overwrite existing file content', async () => {
    const writer = new NodeFileWriter();
    const testDir = join(tmpdir(), `offload-test-${Date.now()}`);
    testDirs.push(testDir);

    const filePath = join(testDir, 'overwrite.md');
    await writer.writeFile(filePath, 'old content');
    await writer.writeFile(filePath, 'new content');

    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('new content');
  });
});
