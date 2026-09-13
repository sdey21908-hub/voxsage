// This MUST be the first import. ES module imports are all resolved before
// any other code runs — so if dotenv.config() ran after importing routes/
// services that read process.env at import time (like the OpenAI client),
// those env vars would still be undefined. Importing 'dotenv/config' as the
// very first line guarantees .env is loaded before anything else executes.
import 'dotenv/config';

import express from 'express';
import transcriptsRouter from './routes/transcripts.js';

const app = express();
app.use(express.json());

// Basic request logging — the start of "observability" (JD explicitly calls this out)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Health check — always have one of these; it's how you (or a deploy platform)
// verify the service is actually up
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/transcripts', transcriptsRouter);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
