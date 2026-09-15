import { test } from 'node:test';
import assert from 'node:assert';
import { validateTranscriptText } from '../src/utils/validation.js';

test('rejects empty string', () => {
  const result = validateTranscriptText('');
  assert.strictEqual(result, 'Missing or invalid "text" field');
});

test('rejects whitespace-only string', () => {
  const result = validateTranscriptText('   ');
  assert.strictEqual(result, 'Missing or invalid "text" field');
});

test('rejects missing text (undefined)', () => {
  const result = validateTranscriptText(undefined);
  assert.strictEqual(result, 'Missing or invalid "text" field');
});

test('rejects non-string input', () => {
  const result = validateTranscriptText(12345);
  assert.strictEqual(result, 'Missing or invalid "text" field');
});

test('rejects text over 20000 characters', () => {
  const longText = 'a'.repeat(20001);
  const result = validateTranscriptText(longText);
  assert.strictEqual(result, 'Transcript too long (max 20000 chars)');
});

test('accepts valid text', () => {
  const result = validateTranscriptText('Customer called about a refund.');
  assert.strictEqual(result, null);
});

test('accepts text at exactly the 20000 character limit', () => {
  const exactText = 'a'.repeat(20000);
  const result = validateTranscriptText(exactText);
  assert.strictEqual(result, null);
});
