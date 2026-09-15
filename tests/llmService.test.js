import 'dotenv/config';
import { test } from 'node:test';
import assert from 'node:assert';
import { parseLLMResponse } from '../src/services/llmService.js';

test('parses valid JSON with summary and action items', () => {
  const raw = '{"summary": "Customer wanted a refund.", "action_items": ["Process refund"]}';
  const result = parseLLMResponse(raw);
  assert.strictEqual(result.summary, 'Customer wanted a refund.');
  assert.deepStrictEqual(result.actionItems, ['Process refund']);
});

test('parses valid JSON with empty action items array', () => {
  const raw = '{"summary": "Customer asked a question.", "action_items": []}';
  const result = parseLLMResponse(raw);
  assert.strictEqual(result.summary, 'Customer asked a question.');
  assert.deepStrictEqual(result.actionItems, []);
});

test('throws LLM_INVALID_RESPONSE on malformed JSON', () => {
  const raw = 'This is not JSON at all, sorry!';
  assert.throws(
    () => parseLLMResponse(raw),
    { message: 'LLM_INVALID_RESPONSE' }
  );
});

test('throws LLM_INVALID_RESPONSE on truncated JSON', () => {
  const raw = '{"summary": "Customer wanted a refund.", "action_i';
  assert.throws(
    () => parseLLMResponse(raw),
    { message: 'LLM_INVALID_RESPONSE' }
  );
});

test('throws LLM_INVALID_RESPONSE on empty string', () => {
  assert.throws(
    () => parseLLMResponse(''),
    { message: 'LLM_INVALID_RESPONSE' }
  );
});
