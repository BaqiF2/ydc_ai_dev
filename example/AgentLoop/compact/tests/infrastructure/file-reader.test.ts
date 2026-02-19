/**
 * Tests for NodeFileReader — file reading and existence checking.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { NodeFileReader } from '../../src/infrastructure/file-reader.js';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TEST_DIR = join(tmpdir(), 'compact-reader-test-' + Date.now());

afterEach(async () => {
  try {
    await rm(TEST_DIR, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

describe('NodeFileReader', () => {
  it('should read file content as UTF-8 string', async () => {
    const reader = new NodeFileReader();
    const filePath = join(TEST_DIR, 'test.txt');
    await mkdir(TEST_DIR, { recursive: true });
    await writeFile(filePath, 'hello world', 'utf-8');

    const content = await reader.read(filePath);
    expect(content).toBe('hello world');
  });

  it('should return true for existing file', async () => {
    const reader = new NodeFileReader();
    const filePath = join(TEST_DIR, 'exists.txt');
    await mkdir(TEST_DIR, { recursive: true });
    await writeFile(filePath, 'content', 'utf-8');

    const exists = await reader.exists(filePath);
    expect(exists).toBe(true);
  });

  it('should return false for non-existent file', async () => {
    const reader = new NodeFileReader();
    const filePath = join(TEST_DIR, 'does-not-exist.txt');

    const exists = await reader.exists(filePath);
    expect(exists).toBe(false);
  });

  it('should throw when reading non-existent file', async () => {
    const reader = new NodeFileReader();
    const filePath = join(TEST_DIR, 'missing.txt');

    await expect(reader.read(filePath)).rejects.toThrow();
  });
});
