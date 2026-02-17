/**
 * Agent Loop 中间件模拟示例
 *
 * 模拟一个 Agent Loop 的工具结果处理流程：Agent 调用多个工具后，
 * 中间件检查每个 tool_result 的长度，超过阈值的自动卸载到文件。
 *
 * 核心导出:
 * - main: 入口函数，模拟 Agent Loop 中间件处理流程
 *
 * 运行方式: npx tsx examples/agent-loop-middleware.ts
 */

import { offloadToolResult } from '../src/index.js';
import type { Message } from '../src/index.js';
import { readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

/* ------------------------------------------------------------------ */
/*  Console helpers                                                     */
/* ------------------------------------------------------------------ */
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

const OFFLOAD_CHAR_THRESHOLD = parseInt(process.env.OFFLOAD_CHAR_THRESHOLD || '1000', 10);

function heading(text: string): void {
  console.log(`\n${BOLD}${CYAN}== ${text} ==${RESET}\n`);
}

function label(key: string, value: string | number): void {
  console.log(`  ${GREEN}${key}:${RESET} ${value}`);
}

/* ------------------------------------------------------------------ */
/*  Simulate tool results from an Agent Loop                            */
/* ------------------------------------------------------------------ */

function buildToolResults(): Array<{ name: string; message: Message }> {
  return [
    {
      name: 'read_file (app-config.ts)',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_read_config',
            content: Array.from({ length: 50 }, (_, i) =>
              `export const CONFIG_${i} = "value_${i}"; // configuration entry`,
            ).join('\n'),
          },
        ],
      },
    },
    {
      name: 'read_file (config.local.yml)',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_read_local',
            content: 'File not found: config.local.yml',
          },
        ],
      },
    },
    {
      name: 'read_file (migration.sql)',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_read_migration',
            content: Array.from({ length: 80 }, (_, i) =>
              `CREATE TABLE table_${i} (id SERIAL PRIMARY KEY, name VARCHAR(255));`,
            ).join('\n'),
          },
        ],
      },
    },
  ];
}

/**
 * Calculate the content length of a message for threshold comparison.
 */
function getContentLength(message: Message): number {
  if (typeof message.content === 'string') {
    return message.content.length;
  }
  return JSON.stringify(message.content).length;
}

/* ------------------------------------------------------------------ */
/*  Main                                                                */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  const SESSION_ID = `demo-${Date.now()}`;
  const OUTPUT_DIR = resolve(import.meta.dirname ?? '.', '../.offload-demo');

  heading('Agent Loop Middleware — Tool Result Offload Demo');
  label('Session ID', SESSION_ID);
  label('Output directory', OUTPUT_DIR);
  label('Offload threshold', `${OFFLOAD_CHAR_THRESHOLD} chars`);

  const toolResults = buildToolResults();

  // -------- Step 1: Show all tool results before processing --------
  heading('Step 1 — Tool results received from tools');

  let totalCharsBefore = 0;
  for (const { name, message } of toolResults) {
    const len = getContentLength(message);
    totalCharsBefore += len;
    const willOffload = len >= OFFLOAD_CHAR_THRESHOLD;
    const marker = willOffload
      ? `${YELLOW}[will offload]${RESET}`
      : `${DIM}[keep]${RESET}`;
    console.log(`  ${marker} ${name} — ${len} chars`);
  }
  label('Total chars', totalCharsBefore);

  // -------- Step 2: Apply middleware --------
  heading('Step 2 — Applying offload middleware');

  const processedMessages: Message[] = [];
  const offloadedFiles: string[] = [];
  let totalFreed = 0;
  let offloadedCount = 0;

  for (const { name, message } of toolResults) {
    const len = getContentLength(message);

    if (len >= OFFLOAD_CHAR_THRESHOLD) {
      const result = await offloadToolResult(message, {
        sessionId: SESSION_ID,
        outputDir: OUTPUT_DIR,
      });
      processedMessages.push(result.message);
      offloadedFiles.push(result.file);
      totalFreed += result.freedChars;
      offloadedCount++;
      console.log(`  ${YELLOW}Offloaded${RESET} ${name} -> ${result.file} (freed ${result.freedChars} chars)`);
    } else {
      processedMessages.push(message);
      console.log(`  ${DIM}Kept${RESET} ${name} (${len} chars, below threshold)`);
    }
  }

  // -------- Step 3: Summary --------
  heading('Step 3 — Offload summary');
  label('Tool results processed', toolResults.length);
  label('Offloaded', offloadedCount);
  label('Kept as-is', toolResults.length - offloadedCount);
  label('Total chars freed', totalFreed);

  let totalCharsAfter = 0;
  for (const msg of processedMessages) {
    totalCharsAfter += getContentLength(msg);
  }
  const savedPct = totalCharsBefore > 0
    ? ((totalFreed / totalCharsBefore) * 100).toFixed(1)
    : '0.0';
  label('Before', `${totalCharsBefore} chars`);
  label('After', `${totalCharsAfter} chars`);
  label('Space saved', `${totalFreed} chars (${savedPct}%)`);

  // -------- Step 4: Peek into offloaded files --------
  if (offloadedFiles.length > 0) {
    heading('Step 4 — Peek into offloaded files');

    for (const filePath of offloadedFiles) {
      const content = await readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const preview = lines.slice(0, 3).join('\n');
      const remaining = lines.length - 3;

      console.log(`  ${GREEN}${filePath}${RESET}`);
      console.log(`  ${DIM}${preview}${RESET}`);
      if (remaining > 0) {
        console.log(`  ${DIM}  ... (${remaining} more lines)${RESET}`);
      }
      console.log();
    }
  }

  // -------- Step 5: Verify processed messages --------
  heading('Step 5 — Processed messages (what LLM receives)');

  for (let i = 0; i < processedMessages.length; i++) {
    const msg = processedMessages[i];
    const contentStr = typeof msg.content === 'string'
      ? msg.content
      : JSON.stringify(msg.content);
    const preview = contentStr.length > 100
      ? contentStr.slice(0, 100) + '...'
      : contentStr;
    const isOffloaded = contentStr.includes('[Tool result offloaded to file:');
    const marker = isOffloaded ? `${YELLOW}[offloaded]${RESET} ` : '';
    console.log(`  [${i}] ${marker}${preview}`);
  }

  // -------- Step 6: Immutability check --------
  heading('Step 6 — Immutability check');

  const originalUnchanged = toolResults.every(({ message }) => {
    const content = message.content;
    if (typeof content === 'string') return true;
    return content.some(
      (block) => block.type === 'tool_result' && typeof block.content === 'string',
    );
  });
  label(
    'Original messages unchanged',
    originalUnchanged ? `${GREEN}Yes${RESET}` : 'No (mutated!)',
  );

  // -------- Cleanup hint --------
  console.log(`\n${DIM}  Cleanup: rm -rf ${OUTPUT_DIR}${RESET}`);
  console.log(`\n${BOLD}${GREEN}Demo complete!${RESET}\n`);

  // Cleanup demo files
  await rm(OUTPUT_DIR, { recursive: true, force: true });
}

main().catch((err: unknown) => {
  console.error('Demo failed:', err);
  process.exit(1);
});
