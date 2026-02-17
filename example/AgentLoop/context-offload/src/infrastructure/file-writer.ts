/**
 * File system writer implementation using Node.js fs/promises.
 * Provides the infrastructure layer's implementation of the FileWriter interface.
 *
 * Core exports:
 * - NodeFileWriter: FileWriter implementation backed by Node.js fs module
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { FileWriter } from '../core/types.js';

/** FileWriter implementation using Node.js fs/promises */
export class NodeFileWriter implements FileWriter {
  async writeFile(filePath: string, content: string): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content, 'utf-8');
  }
}
