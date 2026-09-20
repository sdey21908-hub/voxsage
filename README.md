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

## LangChain / LangGraph integration

In addition to the original hand-built pipeline above, the project includes a parallel implementation using LangChain.js and LangGraph.js — built to compare a framework-based approach against the original from-scratch implementation, and to demonstrate agentic workflows (a self-verifying summarizer loop).

### What was added

- **`src/langchain/langchain-embeddings.js`** — local embeddings via LangChain's `HuggingFaceTransformersEmbeddings` wrapper (same model, `Xenova/all-MiniLM-L6-v2`)
- **`src/langchain/langchain-vectorstore.js`** — Supabase/pgvector read and write, using a custom `match_documents` SQL function mapped to the existing `summaries` table schema
- **`src/langchain/langchain-llm-chain.js`** — Groq via `ChatGroq`, with structured output enforced using `.withStructuredOutput()` and a Zod schema
- **`src/langchain/langchain-rag-chain.js`** — the full retrieve-then-generate RAG chain powering semantic search
- **`src/langchain/langgraph-verifier-agent.js`** — a two-agent LangGraph workflow: one agent summarizes, a second agent fact-checks the summary against the original transcript and triggers a retry (capped at 3 attempts) if it finds unsupported claims

### New endpoints

- `POST /api/langchain/summarize` — summarize + store, using the LangChain pipeline
- `POST /api/langchain/search` — semantic search over past summaries (RAG)
- `POST /api/langchain/summarize/verified` — the LangGraph self-verifying summarizer loop

### Debugging journey (real issues hit during this migration)

This integration surfaced several real version-mismatch issues, resolved by reading installed package source directly rather than trusting documentation, which was frequently out of date relative to the installed versions:

1. **`@langchain/community` sunset** — the package was recently deprecated by the LangChain team in favor of standalone integration packages; existing integrations (Supabase, HuggingFace embeddings) still work but the import path had moved from the documented `embeddings/hf_transformers` to the actual `embeddings/huggingface_transformers`, and the underlying dependency changed from `@xenova/transformers` to `@huggingface/transformers`.
2. **`OutputFixingParser` removed in LangChain v1** — the parse-then-fix pattern for structured output was dropped in favor of native tool-calling via `.withStructuredOutput()`, which is what's used here instead.
3. **`StateGraph` channel definition changed** — LangGraph's channel shape moved away from `{ value: null }` wrapper objects to plain `null` for a default overwrite channel.
4. **Schema mismatch** — the generic LangChain Supabase examples assume `content`/`metadata` columns; this project's actual `summaries` table uses `transcript_text`/`summary`/`action_items`/`embedding`, so the vector store logic was written directly against Supabase's client rather than LangChain's generic `SupabaseVectorStore` wrapper.
5. **ESM vs CommonJS** — the project uses ES modules (`"type": "module"`), so all new files use `import`/`export`, not `require`.
6. **Deploy-time dependency resolution** — Render's default `npm install` doesn't use `--legacy-peer-deps`, which is needed here due to a peer dependency conflict between LangChain packages; fixed with an `.npmrc` file (`legacy-peer-deps=true`) so the same resolution applies consistently in every environment.
7. **Hidden newline in a copied secret** — a production 500 error traced back to a literal newline character embedded in a copy-pasted Supabase API key, which broke it as an HTTP header value. Root-caused by reading the raw error stack trace rather than assuming the key was simply wrong.

Every fix above was verified with an isolated test script (embeddings, vector store, LLM chain, RAG chain, and the verifier agent each tested independently) before being wired into the actual Express routes, then confirmed working against the live production deployment.
