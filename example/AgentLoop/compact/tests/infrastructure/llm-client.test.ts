/**
 * Tests for AnthropicLlmClient — verifies the client interface contracts.
 * Uses mocked Anthropic SDK to avoid real API calls.
 */

import { describe, it, expect } from 'vitest';

// Since AnthropicLlmClient wraps the SDK directly, integration tests
// with real API calls are out of scope for CI. Instead, we verify the
// LlmClient interface contract via mock-based tests in compact.test.ts.
// This file serves as a placeholder for future integration tests that
// require a real ANTHROPIC_API_KEY.

describe('AnthropicLlmClient', () => {
  it('should be importable', async () => {
    const mod = await import('../../src/infrastructure/llm-client.js');
    expect(mod.AnthropicLlmClient).toBeDefined();
  });
});
