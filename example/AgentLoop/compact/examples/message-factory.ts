/**
 * Message Factory — Generates realistic test messages simulating Agent Loop conversations.
 *
 * Core exports:
 * - createSystemMessage — Create a system prompt message
 * - createUserMessage — Create a user message
 * - createAssistantMessage — Create an assistant reply
 * - createToolUseMessage — Create an assistant message with tool_use blocks
 * - createToolResultMessage — Create a user message with tool_result blocks
 * - buildAgentConversation — Build a complete simulated Agent Loop conversation
 */

import type { Message } from '../src/core/types.js';

export function createSystemMessage(content: string): Message {
  return { role: 'system', content };
}

export function createUserMessage(content: string): Message {
  return { role: 'user', content };
}

export function createAssistantMessage(content: string): Message {
  return { role: 'assistant', content };
}

export function createToolUseMessage(
  toolName: string,
  input: Record<string, unknown>,
): Message {
  return {
    role: 'assistant',
    content: [
      {
        type: 'tool_use',
        id: `tool_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: toolName,
        input,
      },
    ],
  };
}

export function createToolResultMessage(
  toolUseId: string,
  result: string,
): Message {
  return {
    role: 'user',
    content: [
      {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: result,
      },
    ],
  };
}

/**
 * Build a complete simulated Agent Loop conversation.
 * Generates a realistic multi-turn dialogue with tool calls.
 *
 * @param turnCount - Number of user-assistant turn pairs to generate
 * @param paddingSize - Extra text length per message to inflate token count
 */
export function buildAgentConversation(
  turnCount: number,
  paddingSize: number = 0,
): Message[] {
  const messages: Message[] = [];
  const padding = paddingSize > 0 ? '\n' + 'x'.repeat(paddingSize) : '';

  // System prompt
  messages.push(
    createSystemMessage(
      `You are a helpful coding assistant. You have access to the following tools:
- ReadFile: Read the contents of a file
- WriteFile: Write content to a file
- RunCommand: Execute a shell command
- SearchCode: Search for code patterns

Always think step by step. When modifying code, read the file first, then make changes.${padding}`,
    ),
  );

  const tasks = [
    {
      userReq: 'Please help me refactor the auth module to use JWT tokens.',
      plan: 'I\'ll refactor the auth module step by step:\n1. Read the current session-based auth code\n2. Create JWT utility module\n3. Update the middleware\n4. Update routes\n5. Run tests',
      files: [
        { name: 'ReadFile', path: 'src/auth/session.ts', result: 'export class SessionStore {\n  private sessions: Map<string, any> = new Map();\n  create(userId: string) { /* ... */ }\n  validate(token: string) { /* ... */ }\n  destroy(token: string) { /* ... */ }\n}' },
        { name: 'ReadFile', path: 'src/auth/middleware.ts', result: 'import { SessionStore } from "./session";\nexport function authMiddleware(req, res, next) {\n  const token = req.headers.authorization;\n  if (store.validate(token)) next();\n  else res.status(401).send("Unauthorized");\n}' },
        { name: 'WriteFile', path: 'src/auth/jwt.ts', result: 'File created successfully' },
        { name: 'WriteFile', path: 'src/auth/middleware.ts', result: 'File updated successfully' },
      ],
    },
    {
      userReq: 'Now add refresh token support and update the tests.',
      plan: 'I\'ll add refresh token support:\n1. Read current JWT implementation\n2. Add refresh token generation and validation\n3. Update the token store\n4. Write integration tests',
      files: [
        { name: 'ReadFile', path: 'src/auth/jwt.ts', result: 'import jwt from "jsonwebtoken";\nexport function signToken(payload: object) { return jwt.sign(payload, SECRET, { expiresIn: "1h" }); }\nexport function verifyToken(token: string) { return jwt.verify(token, SECRET); }' },
        { name: 'WriteFile', path: 'src/auth/jwt.ts', result: 'File updated with refresh token support' },
        { name: 'WriteFile', path: 'src/auth/token-store.ts', result: 'File created successfully' },
        { name: 'RunCommand', path: 'npm test', result: 'PASS src/auth/__tests__/jwt.test.ts\n  ✓ signs access token (5ms)\n  ✓ verifies valid token (2ms)\n  ✓ rejects expired token (3ms)\n  ✓ generates refresh token (4ms)\n  ✓ rotates refresh token (6ms)\n\nTests: 5 passed, 5 total' },
      ],
    },
    {
      userReq: 'Can you also add rate limiting to the auth endpoints?',
      plan: 'I\'ll implement rate limiting:\n1. Create a rate limiter module\n2. Add it to auth routes\n3. Configure limits per endpoint\n4. Add tests',
      files: [
        { name: 'WriteFile', path: 'src/middleware/rate-limiter.ts', result: 'File created successfully' },
        { name: 'ReadFile', path: 'src/routes/auth.ts', result: 'import { Router } from "express";\nconst router = Router();\nrouter.post("/login", loginHandler);\nrouter.post("/logout", logoutHandler);\nrouter.post("/refresh", refreshHandler);' },
        { name: 'WriteFile', path: 'src/routes/auth.ts', result: 'File updated with rate limiting' },
        { name: 'RunCommand', path: 'npm test', result: 'PASS src/middleware/__tests__/rate-limiter.test.ts\n  ✓ allows requests under limit (3ms)\n  ✓ blocks requests over limit (5ms)\n  ✓ resets after window expires (102ms)\n\nTests: 3 passed, 3 total' },
      ],
    },
    {
      userReq: 'Help me set up a database migration for the token storage.',
      plan: 'I\'ll set up the database migration:\n1. Check existing migration setup\n2. Create migration file\n3. Update the token store to use the database\n4. Run migration and verify',
      files: [
        { name: 'ReadFile', path: 'package.json', result: '{ "dependencies": { "pg": "^8.0.0", "knex": "^3.0.0" } }' },
        { name: 'WriteFile', path: 'migrations/20250217_create_refresh_tokens.ts', result: 'Migration file created' },
        { name: 'RunCommand', path: 'npx knex migrate:latest', result: 'Batch 1 run: 1 migrations\n  20250217_create_refresh_tokens.ts' },
        { name: 'SearchCode', path: 'token-store', result: 'src/auth/token-store.ts:1: export class InMemoryTokenStore\nsrc/auth/token-store.ts:15: export class TokenStore' },
      ],
    },
    {
      userReq: 'Please add error handling and logging to all auth endpoints.',
      plan: 'I\'ll improve error handling across auth endpoints:\n1. Create error classes\n2. Add try-catch blocks and structured logging\n3. Create error middleware\n4. Update tests',
      files: [
        { name: 'WriteFile', path: 'src/errors/auth-errors.ts', result: 'File created' },
        { name: 'WriteFile', path: 'src/middleware/error-handler.ts', result: 'File created' },
        { name: 'ReadFile', path: 'src/routes/auth.ts', result: '/* current routes with rate limiting */' },
        { name: 'WriteFile', path: 'src/routes/auth.ts', result: 'File updated with error handling' },
      ],
    },
  ];

  const actualTurns = Math.min(turnCount, tasks.length);

  for (let i = 0; i < actualTurns; i++) {
    const task = tasks[i % tasks.length];

    // User request
    messages.push(createUserMessage(task.userReq + padding));

    // Assistant planning
    messages.push(createAssistantMessage(task.plan + padding));

    // Tool use / result pairs
    for (const file of task.files) {
      const toolMsg = createToolUseMessage(file.name, { path: file.path });
      messages.push(toolMsg);

      const toolUseBlock = Array.isArray(toolMsg.content) ? toolMsg.content[0] : null;
      const toolUseId = toolUseBlock && 'id' in toolUseBlock ? toolUseBlock.id : 'unknown';
      messages.push(createToolResultMessage(toolUseId, file.result + padding));
    }

    // Assistant summary
    messages.push(
      createAssistantMessage(
        `Done with step ${i + 1}. The ${task.userReq.slice(0, 40).toLowerCase()} has been completed successfully.${padding}`,
      ),
    );
  }

  return messages;
}
