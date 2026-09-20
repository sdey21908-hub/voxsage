import express from "express";
import { summarizeTranscript } from "../langchain/langchain-llm-chain.js";
import { storeSummary } from "../langchain/langchain-vectorstore.js";
import { queryPastCalls } from "../langchain/langchain-rag-chain.js";
import { summarizeWithVerification } from "../langchain/langgraph-verifier-agent.js";

const router = express.Router();

router.post("/summarize", async (req, res) => {
  try {
    const { transcript } = req.body;
    const { summary, actionItems } = await summarizeTranscript(transcript);

    await storeSummary({
      transcriptText: transcript,
      summaryText: summary,
      actionItems,
    });

    res.json({ summary, actionItems });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to summarize transcript." });
  }
});

router.post("/search", async (req, res) => {
  try {
    const { query } = req.body;
    const result = await queryPastCalls(query);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Search failed." });
  }
});

router.post("/summarize/verified", async (req, res) => {
  try {
    const { transcript } = req.body;
    const result = await summarizeWithVerification(transcript);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Verified summarization failed." });
  }
});

export default router;
