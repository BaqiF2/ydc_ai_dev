/**
 * Example 03: Agent Loop Simulation — Demonstrates compaction integrated
 * into a simulated Agent Loop that processes multiple user tasks.
 *
 * Each iteration adds a user request and agent response, then checks if
 * compaction is needed before the next "API call". This mirrors how
 * compaction would be used in a real Agent Loop.
 *
 * Usage:
 *   npx tsx examples/03-agent-loop-sim.ts
 */

import {
  compactMessages,
  shouldCompact,
  countTokens,
  resetCompactionCounter,
} from '../src/index.js';
import type { Message, CompactOptions } from '../src/index.js';
import { NodeFileWriter } from '../src/infrastructure/file-writer.js';
import { MockLlmClient } from './mock-llm-client.js';
import {
  createSystemMessage,
  createUserMessage,
  createAssistantMessage,
  createToolUseMessage,
  createToolResultMessage,
} from './message-factory.js';

const TOKEN_LIMIT = parseInt(process.env.EXAMPLE_TOKEN_LIMIT || '500', 10);
const THRESHOLD_RATIO = parseFloat(process.env.EXAMPLE_THRESHOLD_RATIO || '0.8');

/** Simulated user tasks for the Agent Loop */
const USER_TASKS = [
  {
    request: 'Read the current project structure and summarize what we have.',
    tool: { name: 'ReadFile', input: { path: 'package.json' }, result: '{ "name": "my-app", "version": "1.0.0", "dependencies": { "express": "^4.18.0", "pg": "^8.0.0" } }' },
    response: 'The project is a Node.js Express app with PostgreSQL. Current structure includes the main server, routes, and database config.',
  },
  {
    request: 'Add a health check endpoint at GET /health that returns { status: "ok", uptime: process.uptime() }.',
    tool: { name: 'WriteFile', input: { path: 'src/routes/health.ts' }, result: 'File created successfully' },
    response: 'Health check endpoint added at GET /health. It returns JSON with status and server uptime.',
  },
  {
    request: 'Set up a logger middleware that logs request method, path, status code, and response time.',
    tool: { name: 'WriteFile', input: { path: 'src/middleware/logger.ts' }, result: 'File created successfully' },
    response: 'Logger middleware created. It logs method, path, status, and response time in ms for every request.',
  },
  {
    request: 'Create a user model with fields: id, email, name, created_at. Use PostgreSQL.',
    tool: { name: 'WriteFile', input: { path: 'src/models/user.ts' }, result: 'File created successfully' },
    response: 'User model created with id (UUID), email (unique), name, and created_at fields. Uses pg for database operations.',
  },
  {
    request: 'Add CRUD endpoints for users: GET /users, GET /users/:id, POST /users, PUT /users/:id, DELETE /users/:id.',
    tool: { name: 'WriteFile', input: { path: 'src/routes/users.ts' }, result: 'File created successfully' },
    response: 'User CRUD routes created with full validation, error handling, and pagination support for list endpoint.',
  },
  {
    request: 'Write unit tests for the user model covering all CRUD operations.',
    tool: { name: 'RunCommand', input: { command: 'npm test' }, result: 'PASS src/models/__tests__/user.test.ts\n  ✓ creates user (12ms)\n  ✓ finds user by id (5ms)\n  ✓ lists users with pagination (8ms)\n  ✓ updates user (6ms)\n  ✓ deletes user (4ms)\n  ✓ rejects duplicate email (7ms)\n\nTests: 6 passed' },
    response: 'All 6 user model tests passing: create, find, list, update, delete, and duplicate email rejection.',
  },
  {
    request: 'Add input validation middleware using zod schemas for the user endpoints.',
    tool: { name: 'WriteFile', input: { path: 'src/middleware/validate.ts' }, result: 'File created successfully' },
    response: 'Zod validation middleware created with schemas for create and update user. Returns 400 with structured errors on validation failure.',
  },
  {
    request: 'Set up error handling: create custom AppError class and global error handler.',
    tool: { name: 'WriteFile', input: { path: 'src/errors/app-error.ts' }, result: 'File created successfully' },
    response: 'Custom AppError class and global error handler set up. Handles validation errors, not found, and internal server errors with proper status codes.',
  },
];

async function runAgentLoop() {
  console.log('=== Example 03: Agent Loop Simulation ===\n');
  console.log(`Configuration: token_limit=${TOKEN_LIMIT}, threshold=${THRESHOLD_RATIO * 100}%\n`);

  const llmClient = new MockLlmClient();
  const fileWriter = new NodeFileWriter();
  resetCompactionCounter();

  const options: CompactOptions = {
    contextTokenLimit: TOKEN_LIMIT,
    compactThresholdRatio: THRESHOLD_RATIO,
    tailRetentionRatio: 0.15,
    llmClient,
    fileWriter,
    outputDir: '.compact-examples',
    sessionId: 'example-03-agent-loop',
  };

  let messages: Message[] = [
    createSystemMessage(
      'You are a full-stack developer assistant. Help the user build and maintain their Node.js application. ' +
      'Use tools to read/write files and run commands. Always explain what you did after each step.',
    ),
  ];

  let compactionCount = 0;

  for (let i = 0; i < USER_TASKS.length; i++) {
    const task = USER_TASKS[i];
    console.log(`\n--- Turn ${i + 1}: "${task.request.slice(0, 60)}..." ---`);

    // User sends request
    messages.push(createUserMessage(task.request));

    // Agent uses a tool
    const toolMsg = createToolUseMessage(task.tool.name, task.tool.input);
    messages.push(toolMsg);

    // Tool result
    const toolBlock = Array.isArray(toolMsg.content) ? toolMsg.content[0] : null;
    const toolId = toolBlock && 'id' in toolBlock ? toolBlock.id : 'unknown';
    messages.push(createToolResultMessage(toolId, task.tool.result));

    // Agent response
    messages.push(createAssistantMessage(task.response));

    // Check context before next "API call"
    const tokens = await countTokens(messages, llmClient);
    const threshold = TOKEN_LIMIT * THRESHOLD_RATIO;
    const needsCompact = await shouldCompact(messages, llmClient, options);

    console.log(`  Messages: ${messages.length} | Tokens: ${tokens}/${TOKEN_LIMIT} (threshold: ${threshold})`);

    if (needsCompact) {
      console.log(`  ⚡ Compaction triggered!`);
      const result = await compactMessages(messages, options);

      if (result.compacted) {
        compactionCount++;
        messages = result.messages;
        console.log(`  ✅ Compacted: ${result.stats!.originalTokenCount} → ${result.stats!.compactedTokenCount} tokens (${(result.stats!.compactionRatio * 100).toFixed(1)}%)`);
        console.log(`  📁 Saved: ${result.originalMessagesPath}`);
        console.log(`  📊 ${result.stats!.compactedMessageCount} messages compacted, ${result.stats!.retainedMessageCount} retained`);
      }
    } else {
      console.log(`  ✓ Under threshold, no compaction needed`);
    }
  }

  // Final report
  console.log('\n\n========== Session Report ==========');
  console.log(`Total turns processed: ${USER_TASKS.length}`);
  console.log(`Compactions performed: ${compactionCount}`);
  console.log(`Final message count:   ${messages.length}`);
  console.log(`Final token count:     ${await countTokens(messages, llmClient)}`);
  console.log(`LLM calls — countTokens: ${llmClient.countTokensCalls}, summarize: ${llmClient.summarizeCalls}`);
  console.log('====================================');
}

runAgentLoop().catch(console.error);
