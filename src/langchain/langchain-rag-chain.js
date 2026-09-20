import { searchSimilarCalls } from "./langchain-vectorstore.js";
import { model } from "./langchain-llm-chain.js";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

const ragPrompt = PromptTemplate.fromTemplate(
  `Answer the user's question using ONLY the call summaries below.
If the summaries don't contain relevant information, say so — do not guess.

Relevant past calls:
{context}

Question: {question}

Answer:`
);

export async function queryPastCalls(question, k = 5) {
  const relevantCalls = await searchSimilarCalls(question, k);

  if (relevantCalls.length === 0) {
    return { answer: "No relevant past calls found.", sources: [] };
  }

  const context = relevantCalls
    .map((c, i) => `[${i + 1}] ${c.summary}`)
    .join("\n\n");

  const chain = ragPrompt.pipe(model).pipe(new StringOutputParser());
  const answer = await chain.invoke({ context, question });

  return { answer, sources: relevantCalls };
}
