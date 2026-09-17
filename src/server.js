import 'dotenv/config';

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import transcriptsRouter from './routes/transcripts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Serve the frontend (public/index.html, public/app.js) as static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Basic request logging - the start of "observability" (JD explicitly calls this out)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(req.method + ' ' + req.path + ' ' + res.statusCode + ' ' + duration + 'ms');
  });
  next();
});

// Health check - always have one of these; it's how you (or a deploy platform)
// verify the service is actually up
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/transcripts', transcriptsRouter);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});

export default app;
