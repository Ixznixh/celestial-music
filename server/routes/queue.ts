import { Router, Request, Response } from 'express';
import { youtubeMusicService } from '../services/youtubeMusic';

export const queueRouter = Router();

// GET /api/queue/:id
queueRouter.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const queue = await youtubeMusicService.getQueue(id);
    res.json({ queue });

    // Asynchronously prewarm upcoming tracks in queue via YouTube Music API
    if (Array.isArray(queue) && queue.length > 0) {
      for (const item of queue.slice(0, 3)) {
        if (item?.id) {
          youtubeMusicService.getStream(item.id).catch(() => {});
        }
      }
    }
  } catch (err: any) {
    console.error(`Queue route error for ${id}:`, err.message);
    res.json({ queue: [] });
  }
});
