/**
 * Node File Writer — Persists content to the local file system.
 *
 * Core exports:
 * - NodeFileWriter — FileWriter implementation using Node.js fs/promises
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { FileWriter } from '../core/types.js';

/**
 * FileWriter implementation using Node.js fs module.
 * Automatically creates parent directories if they don't exist.
 */
export class NodeFileWriter implements FileWriter {
  async write(filePath: string, content: string): Promise<void> {
    const dir = dirname(filePath);
    await mkdir(dir, { recursive: true });
    await writeFile(filePath, content, 'utf-8');
  }
}
