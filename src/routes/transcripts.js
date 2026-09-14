import { Router } from 'express';
import { summarizeTranscript } from '../services/llmService.js';
import { saveSummary } from '../services/db.js';

const router = Router();

// POST /api/transcripts/summarize
// Body: { "text": "the raw transcript..." }
router.post('/summarize', async (req, res) => {
  const { text } = req.body;

  // Always validate input before doing expensive work (like calling an LLM).
  // Cheap failures should fail fast.
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'Missing or invalid "text" field' });
  }

  if (text.length > 20000) {
    // Guard against absurdly large inputs — protects your LLM costs
    // and avoids timeouts. A real production concern, not a demo one.
    return res.status(400).json({ error: 'Transcript too long (max 20000 chars)' });
  }

  let result;
  try {
    result = await summarizeTranscript(text);
  } catch (err) {
    // Map service-layer errors to HTTP status codes here, in the route,
    // not in the service.
    if (err.message === 'LLM_INVALID_RESPONSE') {
      return res.status(502).json({ error: 'AI service returned an unexpected response' });
    }
    return res.status(503).json({ error: 'AI service unavailable, please try again' });
  }

  // LLM succeeded — now try to save it. This is a separate try/catch
  // because a database failure is a different kind of problem than
  // an LLM failure, and deserves a different status code.
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

export default router;
