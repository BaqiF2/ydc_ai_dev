/**
 * Tests for NodeFileWriter — file persistence and directory creation.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { NodeFileWriter } from '../../src/infrastructure/file-writer.js';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TEST_DIR = join(tmpdir(), 'compact-test-' + Date.now());

afterEach(async () => {
  try {
    await rm(TEST_DIR, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

describe('NodeFileWriter', () => {
  it('should write content to a file', async () => {
    const writer = new NodeFileWriter();
    const filePath = join(TEST_DIR, 'test.json');
    await writer.write(filePath, '{"hello":"world"}');

    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('{"hello":"world"}');
  });

  it('should create parent directories automatically', async () => {
    const writer = new NodeFileWriter();
    const filePath = join(TEST_DIR, 'nested', 'deep', 'test.json');
    await writer.write(filePath, 'content');

    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('content');
  });

  it('should overwrite existing files', async () => {
    const writer = new NodeFileWriter();
    const filePath = join(TEST_DIR, 'overwrite.json');
    await writer.write(filePath, 'first');
    await writer.write(filePath, 'second');

    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('second');
  });
});
