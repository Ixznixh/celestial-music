import { Router, Request, Response } from 'express';
import { youtubeMusicService } from '../services/youtubeMusic';

export const artistsRouter = Router();

// GET /api/artist/:id
artistsRouter.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const artist = await youtubeMusicService.getArtist(id);
    res.json(artist);
  } catch (err: any) {
    console.error(`Artist route error for ${id}:`, err.message);
    res.status(404).json({ error: 'Artist not found or service unavailable' });
  }
});
