// Returns null if valid, or an error message string if invalid.
// Kept separate from the route so it can be tested without an HTTP server.
export function validateTranscriptText(text) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return 'Missing or invalid "text" field';
  }

  if (text.length > 20000) {
    return 'Transcript too long (max 20000 chars)';
  }

  return null;
}
