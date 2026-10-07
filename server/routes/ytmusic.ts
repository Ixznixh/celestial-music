/**
 * YouTube Music API Router
 * 
 * Provides a dedicated, standardized REST API for YouTube Music data.
 * Powered by Innertube (youtubei.js) and optional YouTube Data API v3 integration.
 */

import { Router, Request, Response } from 'express';
import { youtubeMusicService } from '../services/youtubeMusic';
import { handleAudioStreamProxy } from './songs';

export const ytmusicRouter = Router();

// API Index & Documentation
ytmusicRouter.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'Celestial Pure YouTube API',
    version: '1.0.0',
    description: 'High-speed pure YouTube REST API with full metadata, search, charts, and streaming.',
    status: 'operational',
    provider: 'Pure YouTube API (Innertube Engine)',
    endpoints: {
      documentation: 'GET /api/ytmusic',
      search: 'GET /api/ytmusic/search?q={query}&type={songs|albums|artists|playlists|all}',
      home: 'GET /api/ytmusic/home',
      trending: 'GET /api/ytmusic/trending',
      song: 'GET /api/ytmusic/song/:id',
      album: 'GET /api/ytmusic/album/:id',
      artist: 'GET /api/ytmusic/artist/:id',
      playlist: 'GET /api/ytmusic/playlist/:id',
      lyrics: 'GET /api/ytmusic/lyrics/:id?title=...&artist=...',
      queue: 'GET /api/ytmusic/queue/:id',
      stream: 'GET /api/ytmusic/stream/:id',
      audio: 'GET /api/ytmusic/audio/:id',
    },
  });
});

// GET /api/ytmusic/search?q=...&type=...
ytmusicRouter.get('/search', async (req: Request, res: Response) => {
  const query = String(req.query.q || req.query.query || '').trim();
  const filter = String(req.query.type || req.query.filter || 'all').toLowerCase();

  if (!query) {
    return res.json({
      query: '',
      filter,
      songs: [],
      albums: [],
      artists: [],
      playlists: [],
    });
  }

  try {
    const results = await youtubeMusicService.search(query, filter);
    res.json({
      query,
      filter,
      ...results,
    });
  } catch (err: any) {
    console.error('[YTMusic API] Search error:', err?.message || err);
    res.status(500).json({ error: 'Search failed', details: err?.message });
  }
});

// GET /api/ytmusic/home
ytmusicRouter.get('/home', async (req: Request, res: Response) => {
  try {
    const homeData = await youtubeMusicService.getHome();
    res.json(homeData);
  } catch (err: any) {
    console.error('[YTMusic API] Home feed error:', err?.message || err);
    res.status(500).json({ error: 'Failed to load home feed', details: err?.message });
  }
});

// GET /api/ytmusic/trending
ytmusicRouter.get('/trending', async (req: Request, res: Response) => {
  try {
    const searchData = await youtubeMusicService.search('trending hits global top', 'songs');
    res.json({
      trending: searchData.songs || [],
    });
  } catch (err: any) {
    console.error('[YTMusic API] Trending error:', err?.message || err);
    res.status(500).json({ error: 'Failed to load trending music', details: err?.message });
  }
});

// GET /api/ytmusic/song/:id
ytmusicRouter.get('/song/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const song = await youtubeMusicService.getSong(id);
    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }
    res.json(song);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch song details', details: err?.message });
  }
});

// GET /api/ytmusic/album/:id
ytmusicRouter.get('/album/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const album = await youtubeMusicService.getAlbum(id);
    if (!album) {
      return res.status(404).json({ error: 'Album not found' });
    }
    res.json(album);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch album', details: err?.message });
  }
});

// GET /api/ytmusic/artist/:id
ytmusicRouter.get('/artist/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const artist = await youtubeMusicService.getArtist(id);
    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }
    res.json(artist);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch artist', details: err?.message });
  }
});

// GET /api/ytmusic/playlist/:id
ytmusicRouter.get('/playlist/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const playlist = await youtubeMusicService.getPlaylist(id);
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }
    res.json(playlist);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch playlist', details: err?.message });
  }
});

// GET /api/ytmusic/lyrics/:id
ytmusicRouter.get('/lyrics/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const title = String(req.query.title || '');
  const artist = String(req.query.artist || '');
  const duration = parseInt(String(req.query.duration || '0'), 10) || undefined;

  try {
    const lyrics = await youtubeMusicService.getLyrics(id, { title, artist, duration });
    if (!lyrics) {
      return res.status(404).json({ error: 'Lyrics not found' });
    }
    res.json(lyrics);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch lyrics', details: err?.message });
  }
});

// GET /api/ytmusic/queue/:id
ytmusicRouter.get('/queue/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const queue = await youtubeMusicService.getQueue(id);
    res.json({
      songId: id,
      queue: queue || [],
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch radio queue', details: err?.message });
  }
});

// GET /api/ytmusic/stream/:id
ytmusicRouter.get('/stream/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const stream = await youtubeMusicService.getStream(id);
    res.json({
      songId: id,
      ...stream,
    });
  } catch (err: any) {
    res.status(503).json({ error: 'Playback stream unavailable', details: err?.message });
  }
});

// GET /api/ytmusic/audio/:id
ytmusicRouter.get('/audio/:id', handleAudioStreamProxy);
