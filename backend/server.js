import './loadEnv.js';
import express from 'express';
import cors from 'cors';

import uploadRouter from './routes/upload.js';
import classifyRouter from './routes/classify.js';
import scanRouter from './routes/scan.js';
import ideasRouter from './routes/ideas.js';
import instructionsRouter from './routes/instructions.js';
import ttsRouter from './routes/tts.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '20mb' }));

app.use('/api/upload', uploadRouter);
app.use('/api/classify', classifyRouter);
app.use('/api/scan', scanRouter);
app.use('/api/ideas', ideasRouter);
app.use('/api/instructions', instructionsRouter);
app.use('/api/tts', ttsRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`BrickVision backend running on http://localhost:${PORT}`);
});
