import { Router, Request, Response } from 'express';
import { youtubeMusicService } from '../services/youtubeMusic';

export const queueRouter = Router();

// GET /api/queue/:id
queueRouter.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const queue = await youtubeMusicService.getQueue(id);
    res.json({ queue });
  } catch (err: any) {
    console.error(`Queue route error for ${id}:`, err.message);
    res.json({ queue: [] });
  }
});
