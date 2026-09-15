import { test } from 'node:test';
import assert from 'node:assert';
import { generateEmbedding } from '../src/services/embeddingService.js';

test('generates an embedding with 384 numbers', async () => {
  const embedding = await generateEmbedding('Customer wanted a refund.');
  assert.strictEqual(embedding.length, 384);
});

test('every value in the embedding is a number', async () => {
  const embedding = await generateEmbedding('Customer wanted a refund.');
  const allNumbers = embedding.every((value) => typeof value === 'number');
  assert.strictEqual(allNumbers, true);
});

test('different text produces different embeddings', async () => {
  const embeddingA = await generateEmbedding('Customer wanted a refund.');
  const embeddingB = await generateEmbedding('Agent scheduled a callback.');
  assert.notDeepStrictEqual(embeddingA, embeddingB);
});
