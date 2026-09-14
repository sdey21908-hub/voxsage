import { pipeline } from '@xenova/transformers';

// Loading the model takes a few seconds and only needs to happen once.
// We cache it in this variable so every call after the first is fast.
let embedder = null;

async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return embedder;
}

export async function generateEmbedding(text) {
  const model = await getEmbedder();
  const output = await model(text, { pooling: 'mean', normalize: true });
  // output.data is a Float32Array of 384 numbers — convert to a plain array
  // so it can be sent to Postgres as a normal JS array.
  return Array.from(output.data);
}
