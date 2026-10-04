import { Router, Request, Response } from 'express';
import { youtubeMusicService } from '../services/youtubeMusic';

export const homeRouter = Router();

// GET /api/home
homeRouter.get('/', async (req: Request, res: Response) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const mood = typeof req.query.mood === 'string' ? req.query.mood : undefined;
    const sections = await youtubeMusicService.getHome(forceRefresh, mood);
    res.json({ sections });
  } catch (err: any) {
    console.warn('Home route notice, recovering with curated Tamil sections:', err?.message || err);
    const mood = typeof req.query.mood === 'string' ? req.query.mood : undefined;
    const fallbackSections = youtubeMusicService.getCuratedTamilHomeSections(mood);
    res.json({ sections: fallbackSections });
  }
});
