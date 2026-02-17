/**
 * Integration tests for the tool-direct-offload public API.
 * Tests the full offload flow using real file system I/O.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { offloadToolResult } from '../../src/index.js';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('offloadToolResult (public API)', () => {
  const testDirs: string[] = [];

  afterEach(async () => {
    for (const dir of testDirs) {
      await rm(dir, { recursive: true, force: true });
    }
    testDirs.length = 0;
  });

  it('should offload string content via convenient API', async () => {
    const testDir = join(tmpdir(), `offload-int-${Date.now()}`);
    testDirs.push(testDir);

    const longContent = 'integration-test-'.repeat(200);
    const result = await offloadToolResult(
      { role: 'user', content: longContent },
      { sessionId: 'int-sess', outputDir: testDir },
    );

    // Verify file was written
    const fileContent = await readFile(result.file, 'utf-8');
    expect(fileContent).toBe(longContent);

    // Verify message was replaced
    expect(result.message.content).toContain('[Tool result offloaded to file:');
    expect(result.message.content).toContain('int-sess');

    // Verify freedChars is positive
    expect(result.freedChars).toBeGreaterThan(0);
  });

  it('should offload ContentBlock[] content via convenient API', async () => {
    const testDir = join(tmpdir(), `offload-int-${Date.now()}`);
    testDirs.push(testDir);

    const contentBlocks = [
      {
        type: 'tool_result' as const,
        tool_use_id: 'toolu_int_test',
        content: 'result-data-'.repeat(200),
      },
    ];
    const result = await offloadToolResult(
      { role: 'user', content: contentBlocks },
      { sessionId: 'int-sess-2', outputDir: testDir },
    );

    // Verify file was written with JSON content
    const fileContent = await readFile(result.file, 'utf-8');
    expect(fileContent).toBe(JSON.stringify(contentBlocks));

    // Verify file path includes tool_use_id
    expect(result.file).toContain('toolu_int_test.md');
  });

  it('should create session directory automatically', async () => {
    const testDir = join(tmpdir(), `offload-int-${Date.now()}`);
    testDirs.push(testDir);

    const result = await offloadToolResult(
      { role: 'user', content: 'x'.repeat(2000) },
      { sessionId: 'new-session', outputDir: testDir },
    );

    // Verify the file exists at the expected path
    const fileContent = await readFile(result.file, 'utf-8');
    expect(fileContent).toBe('x'.repeat(2000));
    expect(result.file).toContain('new-session');
  });
});
