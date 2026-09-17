/**
 * Celestial Music Server
 * Express backend with server-side YouTube Music provider via youtubei.js
 * Exposes internal REST endpoints to the React frontend with zero external API key requirements.
 */

import { Parser, Log } from 'youtubei.js';

// Silence Innertube parser warnings for changing YouTube UI nodes and message renderers
Log.setLevel(Log.Level.NONE);
Parser.setParserErrorHandler(() => {
  // Gracefully suppress benign schema shifts, interstitial ads, and message typechecks
});

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/index';
import { youtubeMusicService } from './server/services/youtubeMusic';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // CORS headers for development flexibility
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Mount API router at both /api and /api/music for complete compatibility
  app.use('/api', apiRouter);
  app.use('/api/music', apiRouter);

  // Status check for music provider
  app.get('/api/status', (req, res) => {
    res.json({
      provider: 'YouTube Music (youtubei.js)',
      requiresApiKey: false,
      status: 'operational',
    });
  });

  // Vite development middleware or static production serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Celestial Music Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
