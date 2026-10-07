import express from 'express';
import { apiRouter } from '../server/index';
import { Parser, Log } from 'youtubei.js';

// Suppress YouTube Innertube log output in Vercel Serverless Function logs
Log.setLevel(Log.Level.NONE);
Parser.setParserErrorHandler(() => {});

const app = express();
app.use(express.json());

// CORS configuration for Vercel
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Route /api requests to API router
app.use('/api/music', apiRouter);
app.use('/api', apiRouter);
app.use('/music', apiRouter);
app.use('/', apiRouter);

app.get('/api/status', (_req, res) => {
  res.json({
    provider: 'YouTube Music (youtubei.js)',
    requiresApiKey: false,
    status: 'operational',
    platform: 'Vercel Serverless Function',
  });
});

export default app;
