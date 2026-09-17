const summarizeBtn = document.getElementById('summarizeBtn');
const transcriptInput = document.getElementById('transcriptInput');
const summaryResult = document.getElementById('summaryResult');
const summaryError = document.getElementById('summaryError');

summarizeBtn.addEventListener('click', async () => {
  const text = transcriptInput.value.trim();

  summaryError.classList.add('hidden');
  summaryResult.classList.add('hidden');

  if (!text) {
    summaryError.textContent = 'Please paste a transcript first.';
    summaryError.classList.remove('hidden');
    return;
  }

  summarizeBtn.disabled = true;
  summarizeBtn.textContent = 'Summarizing...';

  try {
    const response = await fetch('/api/transcripts/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Something went wrong.');
    }

    const actionItemsHtml = data.actionItems && data.actionItems.length
      ? '<ul>' + data.actionItems.map(item => '<li>' + item + '</li>').join('') + '</ul>'
      : '<p>No action items.</p>';

    summaryResult.innerHTML =
      '<strong>Summary:</strong><p>' + data.summary + '</p>' +
      '<strong>Action Items:</strong>' + actionItemsHtml;
    summaryResult.classList.remove('hidden');
  } catch (err) {
    summaryError.textContent = err.message;
    summaryError.classList.remove('hidden');
  } finally {
    summarizeBtn.disabled = false;
    summarizeBtn.textContent = 'Summarize';
  }
});

const searchBtn = document.getElementById('searchBtn');
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const searchError = document.getElementById('searchError');

searchBtn.addEventListener('click', async () => {
  const query = searchInput.value.trim();

  searchError.classList.add('hidden');
  searchResults.innerHTML = '';

  if (!query) {
    searchError.textContent = 'Please enter a search term.';
    searchError.classList.remove('hidden');
    return;
  }

  searchBtn.disabled = true;
  searchBtn.textContent = 'Searching...';

  try {
    const response = await fetch('/api/transcripts/search?q=' + encodeURIComponent(query));
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Something went wrong.');
    }

    if (!data.results || data.results.length === 0) {
      searchResults.innerHTML = '<p>No matching summaries found.</p>';
      return;
    }

    searchResults.innerHTML = data.results.map(r =>
      '<div class="result"><strong>Summary:</strong><p>' + r.summary + '</p></div>'
    ).join('');
  } catch (err) {
    searchError.textContent = err.message;
    searchError.classList.remove('hidden');
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = 'Search';
  }
});
