import { Router } from 'express';
import { homeRouter } from './routes/home';
import { searchRouter } from './routes/search';
import { songsRouter, handleAudioStreamProxy } from './routes/songs';
import { albumsRouter } from './routes/albums';
import { artistsRouter } from './routes/artists';
import { playlistsRouter } from './routes/playlists';
import { lyricsRouter } from './routes/lyrics';
import { queueRouter } from './routes/queue';
import { imageProxyRouter } from './routes/imageProxy';
import { youtubeMusicService } from './services/youtubeMusic';

// Pre-warm Innertube engine at server startup for zero-latency instant playback
youtubeMusicService.getInnertube().catch(() => {});

export const apiRouter = Router();

// Mount all standard REST endpoints
apiRouter.use('/home', homeRouter);
apiRouter.use('/search', searchRouter);
apiRouter.use('/song', songsRouter);
apiRouter.use('/songs', songsRouter);
apiRouter.use('/album', albumsRouter);
apiRouter.use('/albums', albumsRouter);
apiRouter.use('/artist', artistsRouter);
apiRouter.use('/artists', artistsRouter);
apiRouter.use('/playlist', playlistsRouter);
apiRouter.use('/playlists', playlistsRouter);
apiRouter.use('/lyrics', lyricsRouter);
apiRouter.use('/queue', queueRouter);
apiRouter.use('/image-proxy', imageProxyRouter);
apiRouter.use('/proxy-image', imageProxyRouter);

// Direct audio streaming proxies for background playback and range queries
apiRouter.get('/stream', handleAudioStreamProxy);
apiRouter.get('/stream/:id/audio', handleAudioStreamProxy);
apiRouter.get('/music/stream', handleAudioStreamProxy);

// GET /api/stream/:id metadata alias
apiRouter.get('/stream/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const stream = await youtubeMusicService.getStream(id);
    res.json(stream);
  } catch (err: any) {
    res.status(503).json({ error: 'Playback stream unavailable' });
  }
});

// Service health status
apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    provider: 'youtube_music',
    timestamp: Date.now(),
  });
});
