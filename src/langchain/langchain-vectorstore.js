import { createClient } from "@supabase/supabase-js";
import { embeddings } from "./langchain-embeddings.js";

const supabaseClient = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function storeSummary({ transcriptText, summaryText, actionItems }) {
  const vector = await embeddings.embedQuery(summaryText);

  const { error } = await supabaseClient.from("summaries").insert({
    transcript_text: transcriptText,
    summary: summaryText,
    action_items: actionItems,
    embedding: vector,
  });

  if (error) throw error;
}

export async function searchSimilarCalls(query, k = 5) {
  const queryVector = await embeddings.embedQuery(query);

  const { data, error } = await supabaseClient.rpc("match_documents", {
    query_embedding: queryVector,
    match_count: k,
  });

  if (error) throw error;

  return data.map((row) => ({
    summary: row.content,
    transcriptText: row.metadata.transcript_text,
    actionItems: row.metadata.action_items,
    createdAt: row.metadata.created_at,
    similarity: row.similarity,
  }));
}
