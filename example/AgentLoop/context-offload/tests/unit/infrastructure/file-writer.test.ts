/**
 * Unit tests for NodeFileWriter infrastructure implementation.
 * Validates file writing with real temporary directories.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NodeFileWriter } from '../../../src/infrastructure/file-writer.js';

describe('NodeFileWriter', () => {
  let tempDir: string;
  let writer: NodeFileWriter;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'file-writer-test-'));
    writer = new NodeFileWriter();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should write file content to the specified path', async () => {
    const filePath = join(tempDir, 'test-file.md');
    await writer.writeFile(filePath, 'hello world');

    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('hello world');
  });

  it('should create parent directories recursively', async () => {
    const filePath = join(tempDir, 'deep', 'nested', 'test-file.md');
    await writer.writeFile(filePath, 'nested content');

    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('nested content');
  });
});
