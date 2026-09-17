import { Router, Request, Response } from 'express';
import { youtubeMusicService } from '../services/youtubeMusic';

export const albumsRouter = Router();

// GET /api/album/:id
albumsRouter.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const album = await youtubeMusicService.getAlbum(id);
    res.json(album);
  } catch (err: any) {
    console.error(`Album route error for ${id}:`, err.message);
    res.status(404).json({ error: 'Album not found or service unavailable' });
  }
});
