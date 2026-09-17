import { Router, Request, Response } from 'express';
import { youtubeMusicService } from '../services/youtubeMusic';

export const searchRouter = Router();

// GET /api/search/suggestions?q=...
searchRouter.get('/suggestions', async (req: Request, res: Response) => {
  const query = (req.query.q as string) || '';
  if (!query.trim()) {
    return res.json({ suggestions: [] });
  }

  try {
    const suggestions = await youtubeMusicService.getSearchSuggestions(query);
    res.json({ suggestions });
  } catch (err: any) {
    console.error('Search suggestions route error:', err.message);
    res.json({ suggestions: [] });
  }
});

// GET /api/search?q=...&type=... (or &filter=...)
searchRouter.get('/', async (req: Request, res: Response) => {
  const query = (req.query.q as string) || (req.query.query as string) || '';
  const filter = (req.query.type as string) || (req.query.filter as string) || undefined;

  if (!query.trim()) {
    return res.json({ songs: [], artists: [], albums: [], playlists: [] });
  }

  try {
    const results = await youtubeMusicService.search(query, filter);
    res.json(results);
  } catch (err: any) {
    console.error('Search route error:', err.message);
    res.status(503).json({
      error: 'Music service is temporarily unavailable.',
      message: err.message,
      songs: [],
      artists: [],
      albums: [],
      playlists: [],
    });
  }
});
