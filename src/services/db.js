import 'dotenv/config';
import pg from 'pg';
import { generateEmbedding } from './embeddingService.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client', err);
});

export async function saveSummary({ transcriptText, summary, actionItems, userId }) {
  if (!userId) throw new Error('userId is required');
  const embedding = await generateEmbedding(summary);

  const query = `
    INSERT INTO summaries (transcript_text, summary, action_items, embedding, user_id)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, created_at;
  `;
  const values = [
    transcriptText,
    summary,
    JSON.stringify(actionItems ?? []),
    JSON.stringify(embedding),
    userId,
  ];
  const { rows } = await pool.query(query, values);
  return rows[0];
}

export async function searchSimilarSummaries(queryText, limit = 5, userId) {
  if (!userId) throw new Error('userId is required');
  const queryEmbedding = await generateEmbedding(queryText);
  const embeddingStr = JSON.stringify(queryEmbedding);

  const query = `
    SELECT id, transcript_text, summary, action_items, created_at,
           embedding <=> $1 AS distance
    FROM summaries
    WHERE user_id = $3
    ORDER BY embedding <=> $1
    LIMIT $2;
  `;
  const { rows } = await pool.query(query, [embeddingStr, limit, userId]);
  return rows;
}

export default pool;
