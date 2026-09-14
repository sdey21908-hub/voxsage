import { Router } from 'express';
import { summarizeTranscript } from '../services/llmService.js';
import { saveSummary, searchSimilarSummaries } from '../services/db.js';

const router = Router();

// POST /api/transcripts/summarize
// Body: { "text": "the raw transcript..." }
router.post('/summarize', async (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'Missing or invalid "text" field' });
  }

  if (text.length > 20000) {
    return res.status(400).json({ error: 'Transcript too long (max 20000 chars)' });
  }

  let result;
  try {
    result = await summarizeTranscript(text);
  } catch (err) {
    if (err.message === 'LLM_INVALID_RESPONSE') {
      return res.status(502).json({ error: 'AI service returned an unexpected response' });
    }
    return res.status(503).json({ error: 'AI service unavailable, please try again' });
  }

  try {
    const saved = await saveSummary({
      transcriptText: text,
      summary: result.summary,
      actionItems: result.actionItems,
    });
    return res.status(200).json({
      id: saved.id,
      createdAt: saved.created_at,
      ...result,
    });
  } catch (dbErr) {
    console.error('DB save failed:', dbErr);
    return res.status(500).json({ error: 'Failed to persist summary' });
  }
});

// GET /api/transcripts/search?q=some search phrase
router.get('/search', async (req, res) => {
  const { q } = req.query;

  if (!q || typeof q !== 'string' || q.trim().length === 0) {
    return res.status(400).json({ error: 'Missing or invalid "q" query parameter' });
  }

  try {
    const results = await searchSimilarSummaries(q, 5);
    return res.status(200).json({ query: q, results });
  } catch (err) {
    console.error('Search failed:', err);
    return res.status(500).json({ error: 'Search failed, please try again' });
  }
});

export default router;
