import { ChatGroq } from "@langchain/groq";
import { PromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";

export const model = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "openai/gpt-oss-20b",
  temperature: 0,
});

const summarySchema = z.object({
  summary: z.string().describe("A concise summary of the call"),
  actionItems: z.array(z.string()).describe("Concrete follow-up actions"),
});

// withStructuredOutput uses the model's native tool-calling to guarantee
// schema-conformant output — this replaces the old parse + OutputFixingParser
// approach, which was removed in LangChain v1.
const structuredModel = model.withStructuredOutput(summarySchema);

const prompt = PromptTemplate.fromTemplate(
  `Summarize this customer support call transcript and extract action items.

Transcript:
{transcript}`
);

export async function summarizeTranscript(transcript) {
  const formattedPrompt = await prompt.format({ transcript });

  try {
    return await structuredModel.invoke(formattedPrompt);
  } catch (err) {
    // Simple manual retry as a fallback, since OutputFixingParser no
    // longer exists in v1 — retry once before surfacing the error.
    console.warn("Structured output failed once, retrying:", err.message);
    return await structuredModel.invoke(formattedPrompt);
  }
}
