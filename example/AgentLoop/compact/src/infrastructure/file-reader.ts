/**
 * Node File Reader — Reads content from the local file system.
 *
 * Core exports:
 * - NodeFileReader — FileReader implementation using Node.js fs/promises
 */

import { readFile, access, constants } from 'node:fs/promises';
import type { FileReader } from '../core/types.js';

/**
 * FileReader implementation using Node.js fs module.
 * Reads files as UTF-8 strings and checks file existence.
 */
export class NodeFileReader implements FileReader {
  async read(filePath: string): Promise<string> {
    return readFile(filePath, 'utf-8');
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await access(filePath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}
