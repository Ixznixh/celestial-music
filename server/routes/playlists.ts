import { Router, Request, Response } from 'express';
import { youtubeMusicService } from '../services/youtubeMusic';

export const playlistsRouter = Router();

// GET /api/playlist/:id
playlistsRouter.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const playlist = await youtubeMusicService.getPlaylist(id);
    res.json(playlist);
  } catch (err: any) {
    console.error(`Playlist route error for ${id}:`, err.message);
    res.status(404).json({ error: 'Playlist not found or service unavailable' });
  }
});
