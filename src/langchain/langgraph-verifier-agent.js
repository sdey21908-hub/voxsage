import { StateGraph, END } from "@langchain/langgraph";
import { ChatGroq } from "@langchain/groq";

const model = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "openai/gpt-oss-20b",
  temperature: 0,
});

// null means "simple overwrite channel, no custom reducer" — this is the
// correct minimal shape, not { value: null } which we had before.
const graphState = {
  transcript: null,
  summary: null,
  verifierFeedback: null,
  isApproved: null,
  attempts: null,
};

async function summarizeNode(state) {
  const feedbackNote = state.verifierFeedback
    ? `\n\nA previous attempt was rejected for this reason: "${state.verifierFeedback}". Fix this issue.`
    : "";

  const response = await model.invoke(
    `Summarize this call transcript concisely and list action items as JSON.${feedbackNote}\n\nTranscript:\n${state.transcript}`
  );

  return { summary: response.content, attempts: (state.attempts ?? 0) + 1 };
}

async function verifyNode(state) {
  const response = await model.invoke(
    `You are a strict fact-checker. Compare this summary against the original transcript.
Reply with EXACTLY "APPROVED" if every claim in the summary is supported by the transcript,
or a one-sentence reason if it is not.

Transcript:
${state.transcript}

Summary:
${state.summary}`
  );

  const verdict = response.content.trim();
  const approved = verdict.toUpperCase().startsWith("APPROVED");

  return {
    isApproved: approved,
    verifierFeedback: approved ? null : verdict,
  };
}

function routeAfterVerify(state) {
  if (state.isApproved || state.attempts >= 3) {
    return END;
  }
  return "summarize";
}

const workflow = new StateGraph({ channels: graphState })
  .addNode("summarize", summarizeNode)
  .addNode("verify", verifyNode)
  .addEdge("summarize", "verify")
  .addConditionalEdges("verify", routeAfterVerify)
  .setEntryPoint("summarize");

const app = workflow.compile();

export async function summarizeWithVerification(transcript) {
  const result = await app.invoke({ transcript, attempts: 0 });
  return {
    summary: result.summary,
    approved: result.isApproved,
    attempts: result.attempts,
  };
}
