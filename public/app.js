// ---------------------------------------------------------------------------
// Voxsage frontend
//
// CONFIRMED API CONTRACT (from src/routes/transcripts.js):
//   POST /api/transcripts/summarize   body: { text: "..." }
//                                      → { id, createdAt, summary, actionItems }
//   GET  /api/transcripts/search?q=.. → { query, results: [ {...} ] }
//                                      each result's exact field casing depends
//                                      on searchSimilarSummaries() in db.js —
//                                      extractSummaryPayload() and the search
//                                      renderer below already check both
//                                      snake_case and camelCase, so no edit
//                                      should be needed there.
// ---------------------------------------------------------------------------

const HISTORY_KEY = "voxsage_history_v1";
const MAX_HISTORY = 200;

// ---------- Tabs ----------
const tabs = {
  summarize: document.getElementById("tab-summarize"),
  search: document.getElementById("tab-search"),
  dashboard: document.getElementById("tab-dashboard"),
};
const panels = {
  summarize: document.getElementById("panel-summarize"),
  search: document.getElementById("panel-search"),
  dashboard: document.getElementById("panel-dashboard"),
};

function activateTab(name) {
  Object.keys(tabs).forEach((key) => {
    const isActive = key === name;
    tabs[key].setAttribute("aria-selected", String(isActive));
    panels[key].hidden = !isActive;
  });
  if (name === "dashboard") renderDashboard();
}

Object.keys(tabs).forEach((key) => {
  tabs[key].addEventListener("click", () => activateTab(key));
});

// ---------- Connection status ----------
const connDot = document.getElementById("connDot");
const connLabel = document.getElementById("connLabel");

function setConn(state, label) {
  connDot.className = "dot " + state;
  connLabel.textContent = label;
}

async function checkConnection() {
  try {
    const res = await fetch("/health", { method: "GET" });
    if (res.ok) {
      setConn("ok", "API online");
      return;
    }
    throw new Error("non-200");
  } catch {
    // Render free tier spins down when idle — a failed/slow first check
    // doesn't necessarily mean the API is down.
    setConn("pending", "API status unverified (cold start can take ~50s)");
  }
}
checkConnection();

// ---------- Summarize ----------
const transcriptInput = document.getElementById("transcriptInput");
const charCount = document.getElementById("charCount");
const summarizeBtn = document.getElementById("summarizeBtn");
const resultBody = document.getElementById("resultBody");
const resultTiming = document.getElementById("resultTiming");

transcriptInput.addEventListener("input", () => {
  const n = transcriptInput.value.length;
  charCount.textContent = `${n.toLocaleString()} character${n === 1 ? "" : "s"}`;
});

function renderEmpty(container, title, sub) {
  container.innerHTML = `
    <div class="empty-state">
      <p>${escapeHtml(title)}</p>
      <p class="empty-sub">${escapeHtml(sub)}</p>
    </div>`;
}

function renderLoading(container, label) {
  container.innerHTML = `
    <div class="loading-state">
      <span class="spinner"></span>
      <span>${escapeHtml(label)}</span>
    </div>`;
}

function renderError(container, message) {
  container.innerHTML = `<div class="error-state">${escapeHtml(message)}</div>`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// Defensive extraction so small backend response-shape differences don't break the UI.
function extractSummaryPayload(json) {
  const src = json?.data ?? json ?? {};
  return {
    summary: src.summary ?? src.transcript_summary ?? "",
    actionItems: src.action_items ?? src.actionItems ?? [],
    createdAt: src.created_at ?? src.createdAt ?? new Date().toISOString(),
  };
}

summarizeBtn.addEventListener("click", async () => {
  const text = transcriptInput.value.trim();
  if (!text) {
    renderError(resultBody, "Paste a transcript before summarizing.");
    return;
  }

  summarizeBtn.disabled = true;
  resultTiming.hidden = true;
  renderLoading(resultBody, "Summarizing transcript…");

  const startedAt = performance.now();
  try {
    const res = await fetch("/api/transcripts/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || body.message || `Request failed (${res.status})`);
    }

    const json = await res.json();
    const { summary, actionItems } = extractSummaryPayload(json);
    const elapsedMs = Math.round(performance.now() - startedAt);

    resultBody.innerHTML = `
      <p class="summary-text">${escapeHtml(summary || "(No summary returned.)")}</p>
      ${
        Array.isArray(actionItems) && actionItems.length
          ? `<div class="action-items-label">Action items</div>
             <ul class="action-items">
               ${actionItems.map((item) => `<li>${escapeHtml(typeof item === "string" ? item : JSON.stringify(item))}</li>`).join("")}
             </ul>`
          : `<div class="action-items-label">Action items</div><p class="empty-sub">None extracted.</p>`
      }`;

    resultTiming.hidden = false;
    resultTiming.textContent = `${elapsedMs}ms`;

    logSummary({
      summary,
      actionItemsCount: Array.isArray(actionItems) ? actionItems.length : 0,
      wordCount: text.split(/\s+/).filter(Boolean).length,
    });

    setConn("ok", "API online");
  } catch (err) {
    renderError(resultBody, err.message || "Something went wrong reaching the API.");
    setConn("err", "Last request failed");
  } finally {
    summarizeBtn.disabled = false;
  }
});

// ---------- Search ----------
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const searchResults = document.getElementById("searchResults");

async function runSearch() {
  const q = searchInput.value.trim();
  if (!q) {
    renderError(searchResults, "Type something to search for.");
    return;
  }

  searchBtn.disabled = true;
  renderLoading(searchResults, "Searching past summaries…");

  try {
    const res = await fetch(`/api/transcripts/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || body.message || `Request failed (${res.status})`);
    }

    const json = await res.json();
    const results = Array.isArray(json) ? json : json.results ?? json.data ?? [];

    if (!results.length) {
      renderEmpty(searchResults, "No matches.", "Try a broader or differently-worded query.");
      return;
    }

    searchResults.innerHTML = results
      .map((item) => {
        const summary = item.summary ?? "";
        const created = item.created_at ?? item.createdAt;
        const distance = item.distance;
        const dateLabel = created ? new Date(created).toLocaleString() : "—";
        const distLabel =
          distance === null || distance === undefined
            ? '<span class="result-card-dist unranked">unranked</span>'
            : `<span class="result-card-dist">dist ${Number(distance).toFixed(3)}</span>`;
        return `
          <div class="result-card">
            <div class="result-card-head">
              <span class="result-card-date">${escapeHtml(dateLabel)}</span>
              ${distLabel}
            </div>
            <p class="result-card-summary">${escapeHtml(summary)}</p>
          </div>`;
      })
      .join("");
  } catch (err) {
    renderError(searchResults, err.message || "Something went wrong reaching the API.");
  } finally {
    searchBtn.disabled = false;
  }
}

searchBtn.addEventListener("click", runSearch);
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") runSearch();
});

// ---------- Dashboard (client-side session log) ----------
// The API doesn't expose a "list all" endpoint, only search — so the
// dashboard tracks activity from this browser locally rather than
// pretending to show server-wide history.
function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

function saveHistory(entries) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
  } catch {
    // storage unavailable (private browsing, quota) — fail silently, session still works
  }
}

function logSummary({ summary, actionItemsCount, wordCount }) {
  const entries = loadHistory();
  entries.unshift({ time: Date.now(), summary, actionItemsCount, wordCount });
  saveHistory(entries);
}

function relativeTime(ts) {
  const diffMin = Math.round((Date.now() - ts) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Date(ts).toLocaleDateString();
}

const statTotal = document.getElementById("statTotal");
const statActionItems = document.getElementById("statActionItems");
const statAvgWords = document.getElementById("statAvgWords");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

function renderDashboard() {
  const entries = loadHistory();

  statTotal.textContent = entries.length;
  statActionItems.textContent = entries.reduce((sum, e) => sum + (e.actionItemsCount || 0), 0);
  statAvgWords.textContent = entries.length
    ? Math.round(entries.reduce((sum, e) => sum + (e.wordCount || 0), 0) / entries.length)
    : 0;

  if (!entries.length) {
    historyList.innerHTML = `
      <li class="empty-state">
        <p>No activity yet.</p>
        <p class="empty-sub">Summaries you run will be logged here, most recent first.</p>
      </li>`;
    return;
  }

  historyList.innerHTML = entries
    .map(
      (e) => `
      <li>
        <span class="log-time">${escapeHtml(relativeTime(e.time))}</span>
        <span class="log-summary">${escapeHtml(e.summary || "(empty summary)")}</span>
        <span class="log-count">${e.actionItemsCount || 0} action item${e.actionItemsCount === 1 ? "" : "s"}</span>
      </li>`
    )
    .join("");
}

clearHistoryBtn.addEventListener("click", () => {
  saveHistory([]);
  renderDashboard();
});
