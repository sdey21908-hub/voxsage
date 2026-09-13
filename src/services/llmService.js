import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

export async function summarizeTranscript(transcriptText) {
  const start = Date.now();

  try {
    const response = await client.chat.completions.create({
      model: 'openai/gpt-oss-20b',
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
      temperature: 0.2,
    });

    const durationMs = Date.now() - start;
    const raw = response.choices[0].message.content;

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (parseErr) {
      console.error('LLM returned non-JSON output:', raw);
      throw new Error('LLM_INVALID_RESPONSE');
    }

    return {
      summary: parsed.summary,
      actionItems: parsed.action_items,
      meta: {
        durationMs,
        model: 'openai/gpt-oss-20b',
      },
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    console.error(`LLM call failed after ${durationMs}ms:`, err.message);

    if (err.message === 'LLM_INVALID_RESPONSE') {
      throw err;
    }
    throw new Error('LLM_REQUEST_FAILED');
  }
}
