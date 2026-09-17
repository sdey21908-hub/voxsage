# VoxSage — AI Call/Chat Transcript Summarizer

![CI](https://github.com/sdey21908-hub/voxsage/actions/workflows/ci.yml/badge.svg)

A production-minded Node.js backend that summarizes customer call/chat transcripts using an LLM, extracts action items, persists results to Postgres, and supports semantic search over past summaries using vector embeddings.

**Live API:** https://voxsage-ozap.onrender.com
*(Free-tier hosting — the first request after inactivity may take up to 50 seconds while the instance spins back up.)*

## What it does

1. Accepts a raw call/chat transcript
2. Sends it to an LLM (via Groq) to generate a summary and a list of action items
3. Saves the result to a Postgres database (Supabase), along with a vector embedding of the summary
4. Supports searching past summaries by meaning, not just keywords, using vector similarity search

## Tech stack

- **Runtime:** Node.js, Express
- **LLM:** Groq (OpenAI-compatible API), model openai/gpt-oss-20b
- **Database:** Postgres via Supabase, using the pgvector extension for similarity search
- **Embeddings:** Generated locally with @xenova/transformers (all-MiniLM-L6-v2) — no external embedding API required
- **Hosting:** Render (free tier)

## API Endpoints

### POST /api/transcripts/summarize

Summarizes a transcript and saves it.

```bash
curl -X POST https://voxsage-ozap.onrender.com/api/transcripts/summarize \
  -H "Content-Type: application/json" \
  -d '{"text": "Customer called about a delayed order, wants refund or expedited shipping. Agent offered 20% discount and 2-day shipping upgrade, customer agreed."}'
```

**Response:**
```json
{
  "id": "uuid",
  "createdAt": "2026-09-14T23:04:31.706Z",
  "summary": "...",
  "actionItems": ["..."],
  "meta": { "durationMs": 954, "model": "openai/gpt-oss-20b" }
}
```

### GET /api/transcripts/search?q=<query>

Finds past summaries most similar in meaning to the query, using vector embeddings — not exact keyword matching.

```bash
curl "https://voxsage-ozap.onrender.com/api/transcripts/search?q=billing%20issue%20double%20charge"
```

Returns the closest matches ranked by cosine distance, even when the query doesn't share exact words with the original summary.

### GET /health

Basic health check.

## Architecture

src/routes/transcripts.js - HTTP layer: validation, error to status code mapping
src/services/llmService.js - Groq API calls, malformed-JSON handling
src/services/db.js - Postgres queries (save + vector search)
src/services/embeddingService.js - local embedding generation
src/server.js - Express app, health check, request logging

Routes handle HTTP concerns; services hold logic. This keeps the code testable and means swapping providers (LLM, embeddings, or database) only touches one file.

## Design decisions worth noting

- Input validation before the LLM call - empty or oversized transcripts are rejected before spending API calls or time.
- Malformed LLM output is handled, not assumed away - the LLM is prompted for strict JSON, but the service still wraps parsing in a try/catch, since models occasionally deviate.
- Separate error handling for LLM failures vs. database failures - a 502/503 means the AI service had a problem; a 500 means persistence failed. Callers can distinguish and react accordingly.
- Local embeddings instead of a third external API - Groq doesn't currently offer an embeddings endpoint, so embeddings are generated in-process with a small open model, avoiding an extra paid dependency.
- Basic observability - every request is logged with method, path, status code, and duration; LLM calls separately track their own duration and failure mode.

## Running locally

npm install
cp .env.example .env
npm run dev

Fill in GROQ_API_KEY and DATABASE_URL in .env before running.

## Testing

15 tests covering input validation, LLM response parsing (including malformed/truncated JSON), and embedding generation. Uses Node's built-in test runner, no extra dependencies.

npm test

CI (GitHub Actions) runs this automatically on every push to main.

## What's not done yet

- Backfilling embeddings for summaries saved before the embedding column existed
