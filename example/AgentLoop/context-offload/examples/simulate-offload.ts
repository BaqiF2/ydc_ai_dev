/**
 * Agent 上下文卸载模拟示例
 *
 * 模拟一个典型的 Agent 多轮对话场景：用户让 Agent 读取多个文件，
 * 随着对话进行，上下文中积累了大量 tool_result 内容。
 * 最终调用 offloadToolResults 将超标的 tool_result 写入文件、释放上下文空间。
 *
 * 核心导出:
 * - main: 入口函数，构造模拟消息并执行卸载
 *
 * 运行方式: npx tsx examples/simulate-offload.ts
 */

import { offloadToolResults } from '../src/index.js';
import type { Message } from '../src/index.js';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/* ------------------------------------------------------------------ */
/*  辅助：彩色输出                                                      */
/* ------------------------------------------------------------------ */
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function heading(text: string): void {
  console.log(`\n${BOLD}${CYAN}== ${text} ==${RESET}\n`);
}

function label(key: string, value: string | number): void {
  console.log(`  ${GREEN}${key}:${RESET} ${value}`);
}

/* ------------------------------------------------------------------ */
/*  辅助：生成模拟内容                                                  */
/* ------------------------------------------------------------------ */

/** Generate a fake file content of approximately the given length */
function fakeFileContent(name: string, lines: number): string {
  const header = `// File: ${name}\n// Auto-generated content for demonstration\n\n`;
  const body = Array.from({ length: lines }, (_, i) =>
    `export const line${i + 1} = "value_${i + 1}"; // configuration entry #${i + 1}`,
  ).join('\n');
  return header + body;
}

/** Short content that should NOT be offloaded (< 100 chars) */
function shortContent(): string {
  return 'File not found: config.local.yml';
}

/* ------------------------------------------------------------------ */
/*  构造模拟 Agent 对话                                                 */
/* ------------------------------------------------------------------ */

function buildConversation(): Message[] {
  return [
    // --- Turn 1: 用户要求读取一个大文件 ---
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Please read the main configuration file.' },
      ],
    },
    {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 'read_config',
          name: 'read_file',
          input: { path: 'src/config/app-config.ts' },
        },
      ],
    },
    {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'read_config',
          content: fakeFileContent('app-config.ts', 30), // ~1800 chars ✅ 会被卸载
        },
      ],
    },

    // --- Turn 2: 用户要求读取一个不存在的文件（短内容，不卸载） ---
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Also check if config.local.yml exists.' },
      ],
    },
    {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 'read_local',
          name: 'read_file',
          input: { path: 'config.local.yml' },
        },
      ],
    },
    {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'read_local',
          content: shortContent(), // ~32 chars ❌ 不会被卸载
        },
      ],
    },

    // --- Turn 3: 用户要求读取另一个大文件 ---
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Now read the database migration script.' },
      ],
    },
    {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 'read_migration',
          name: 'read_file',
          input: { path: 'db/migrations/001-init.sql' },
        },
      ],
    },
    {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'read_migration',
          content: fakeFileContent('001-init.sql', 50), // ~3000 chars ✅ 会被卸载
        },
      ],
    },

    // --- Turn 4: 用户要求读取测试文件（中等内容） ---
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Show me the unit tests for the config module.' },
      ],
    },
    {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 'read_tests',
          name: 'read_file',
          input: { path: 'tests/config.test.ts' },
        },
      ],
    },
    {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'read_tests',
          content: fakeFileContent('config.test.ts', 20), // ~1200 chars ✅ 会被卸载
        },
      ],
    },

    // --- Turn 5: Agent 回复总结 ---
    {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'I have reviewed all the files. Here is my analysis...',
        },
      ],
    },
  ];
}

/* ------------------------------------------------------------------ */
/*  主函数                                                              */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  const OUTPUT_DIR = resolve(import.meta.dirname ?? '.', '../.offload-demo');

  const messages = buildConversation();

  // -------- Step 1: 展示卸载前的上下文状态 --------
  heading('Step 1 — Conversation before offloading');

  let totalChars = 0;
  for (const msg of messages) {
    const chars = JSON.stringify(msg.content).length;
    totalChars += chars;
  }
  label('Total messages', messages.length);
  label('Total content size', `${totalChars} chars`);

  console.log(`\n  ${DIM}Messages overview:${RESET}`);
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const contentStr = JSON.stringify(msg.content);
    const preview = contentStr.length > 80
      ? contentStr.slice(0, 80) + '...'
      : contentStr;
    console.log(`  ${DIM}[${i}] ${msg.role.padEnd(10)}${RESET} ${preview}`);
  }

  // -------- Step 2: 执行卸载 --------
  heading('Step 2 — Executing offloadToolResults()');
  console.log(`  ${DIM}Output directory: ${OUTPUT_DIR}${RESET}`);

  const result = await offloadToolResults(messages, { outputDir: OUTPUT_DIR });

  // -------- Step 3: 展示卸载结果 --------
  heading('Step 3 — Offload results');
  label('Offloaded count', result.offloadedCount);
  label('Freed chars', `${result.freedChars} chars`);
  label('Files written', result.files.length);

  for (const filePath of result.files) {
    console.log(`    ${DIM}→ ${filePath}${RESET}`);
  }

  // -------- Step 4: 对比卸载后的上下文 --------
  heading('Step 4 — Conversation after offloading');

  let newTotalChars = 0;
  for (const msg of result.messages) {
    const chars = JSON.stringify(msg.content).length;
    newTotalChars += chars;
  }
  label('Total content size', `${newTotalChars} chars`);

  const saved = totalChars - newTotalChars;
  const pct = ((saved / totalChars) * 100).toFixed(1);
  label('Space saved', `${saved} chars (${pct}%)`);

  console.log(`\n  ${DIM}Messages overview (after offload):${RESET}`);
  for (let i = 0; i < result.messages.length; i++) {
    const msg = result.messages[i];
    const contentStr = JSON.stringify(msg.content);
    const preview = contentStr.length > 80
      ? contentStr.slice(0, 80) + '...'
      : contentStr;

    const hasRef = contentStr.includes('[Content offloaded to:');
    const marker = hasRef ? `${YELLOW}[offloaded]${RESET} ` : '';
    console.log(`  ${DIM}[${i}] ${msg.role.padEnd(10)}${RESET} ${marker}${preview}`);
  }

  // -------- Step 5: 展示卸载文件的实际内容（片段） --------
  heading('Step 5 — Peek into offloaded files');

  for (const filePath of result.files) {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const preview = lines.slice(0, 5).join('\n');
    const remaining = lines.length - 5;

    console.log(`  ${GREEN}📄 ${filePath}${RESET}`);
    console.log(`  ${DIM}${preview}${RESET}`);
    if (remaining > 0) {
      console.log(`  ${DIM}  ... (${remaining} more lines)${RESET}`);
    }
    console.log();
  }

  // -------- Step 6: 验证原始消息未被修改 --------
  heading('Step 6 — Immutability check');

  const originalStillHasContent = messages.some((msg) =>
    msg.content.some(
      (block) =>
        block.type === 'tool_result' &&
        typeof block.content === 'string' &&
        block.content.length > 100,
    ),
  );
  label(
    'Original messages unchanged',
    originalStillHasContent ? `${GREEN}✅ Yes${RESET}` : '❌ No (mutated!)',
  );

  console.log(`\n${BOLD}${GREEN}✅ Simulation complete!${RESET}\n`);
}

main().catch((err: unknown) => {
  console.error('Simulation failed:', err);
  process.exit(1);
});
