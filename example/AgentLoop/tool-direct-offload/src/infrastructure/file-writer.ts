/**
 * Tool Direct Offload — Node.js File Writer Implementation
 *
 * Provides the concrete FileWriter implementation using Node.js fs/promises.
 * Belongs to the infrastructure layer — implements the core-defined FileWriter interface.
 *
 * Core exports:
 * - NodeFileWriter: FileWriter implementation using node:fs/promises
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { FileWriter } from '../core/types.js';

/**
 * FileWriter implementation using Node.js standard library.
 * Automatically creates parent directories if they don't exist.
 */
export class NodeFileWriter implements FileWriter {
  async writeFile(filePath: string, content: string): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content, 'utf-8');
  }
}
