import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client', err);
});

export async function saveSummary({ transcriptText, summary, actionItems }) {
  const query = `
    INSERT INTO summaries (transcript_text, summary, action_items)
    VALUES ($1, $2, $3)
    RETURNING id, created_at;
  `;
  const values = [transcriptText, summary, JSON.stringify(actionItems ?? [])];
  const { rows } = await pool.query(query, values);
  return rows[0];
}

export default pool;
