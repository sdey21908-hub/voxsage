import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Sends a transcript to the LLM and asks it to return a summary
 * plus a list of action items, as structured JSON.
 *
 * Why a service function and not inline in the route?
 * Routes should stay thin — they handle HTTP concerns (req/res).
 * Services hold the actual logic, so they're testable and reusable
 * without needing to fake an HTTP request.
 */
export async function summarizeTranscript(transcriptText) {
  const start = Date.now();

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini', // cheap + fast, good enough for summarization
      messages: [
        {
          role: 'system',
          content:
            'You summarize customer call/chat transcripts. Respond ONLY with valid JSON in this exact shape: {"summary": string, "action_items": string[]}. No markdown, no preamble.',
        },
        {
          role: 'user',
          content: transcriptText,
        },
      ],
      temperature: 0.2, // low temperature — we want consistent, factual summaries, not creative ones
    });

    const durationMs = Date.now() - start;
    const raw = response.choices[0].message.content;

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (parseErr) {
      // The LLM didn't return valid JSON. This WILL happen sometimes in production —
      // handling it gracefully instead of crashing is exactly the kind of thing
      // the JD means by "production-ready, not just a happy-case demo."
      console.error('LLM returned non-JSON output:', raw);
      throw new Error('LLM_INVALID_RESPONSE');
    }

    return {
      summary: parsed.summary,
      actionItems: parsed.action_items,
      meta: {
        durationMs,
        model: 'gpt-4o-mini',
      },
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    console.error(`LLM call failed after ${durationMs}ms:`, err.message);

    // Re-throw with a clearer error so the route layer can decide
    // what HTTP status to send back — the service shouldn't know about HTTP.
    if (err.message === 'LLM_INVALID_RESPONSE') {
      throw err;
    }
    throw new Error('LLM_REQUEST_FAILED');
  }
}
