import { Router, Request, Response } from 'express';
import { youtubeMusicService } from '../services/youtubeMusic';

export const lyricsRouter = Router();

// GET /api/lyrics/:id
lyricsRouter.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, artist, duration, album } = req.query;

  try {
    const parsedDuration = duration ? parseFloat(String(duration)) : undefined;
    const lyrics = await youtubeMusicService.getLyrics(id, {
      title: title ? String(title) : undefined,
      artist: artist ? String(artist) : undefined,
      duration: parsedDuration,
      album: album ? String(album) : undefined,
    });

    if (!lyrics || !lyrics.lines || lyrics.lines.length === 0) {
      return res.json({
        songId: id,
        lines: [],
        isSynced: false,
        available: false,
        message: "Lyrics aren't available for this song.",
      });
    }

    res.json({
      ...lyrics,
      available: true,
    });
  } catch (err: any) {
    console.error(`Lyrics route error for ${id}:`, err.message);
    res.json({
      songId: id,
      lines: [],
      isSynced: false,
      available: false,
      message: "Lyrics aren't available for this song.",
    });
  }
});
