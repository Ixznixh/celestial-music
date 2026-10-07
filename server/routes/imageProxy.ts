import { Router, Request, Response } from 'express';

export const imageProxyRouter = Router();

// In-memory LRU-like cache for image buffer & content-type to ensure ultra-fast response
const cache = new Map<string, { buffer: Buffer; contentType: string; timestamp: number }>();
const MAX_CACHE_SIZE = 300;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

imageProxyRouter.get('/', async (req: Request, res: Response) => {
  const imageUrl = req.query.url as string;

  if (!imageUrl || typeof imageUrl !== 'string') {
    return res.status(400).json({ error: 'Missing image url parameter' });
  }

  // Security check: Only allow trusted image domains or standard URLs
  let targetUrl = imageUrl;
  try {
    const parsed = new URL(targetUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ error: 'Invalid URL protocol' });
    }
    // Upgrade Google / YouTube content to high resolution ONLY if no size parameter is already present
    if (targetUrl.includes('googleusercontent.com') || targetUrl.includes('ggpht.com')) {
      if (!targetUrl.includes('=w') && !targetUrl.includes('=s')) {
        targetUrl = targetUrl.replace(/=w\d+-h\d+[^?&#]*/g, '=w800-h800-l90-rj');
        targetUrl = targetUrl.replace(/=s\d+[^?&#]*/g, '=s800-c-k-c0x00ffffff-no-rj');
      }
    }
    if (targetUrl.includes('i.ytimg.com')) {
      targetUrl = targetUrl.replace(/[?&]sqp=[^&#]*/g, '').replace(/[?&]rs=[^&#]*/g, '');
      targetUrl = targetUrl.replace(/\?&/g, '?').replace(/[?&]$/, '');
    }
  } catch {
    return res.status(400).json({ error: 'Malformed URL' });
  }

  // Check memory cache
  const cached = cache.get(targetUrl);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    res.setHeader('Content-Type', cached.contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(cached.buffer);
  }

  try {
    const upstreamRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://music.youtube.com/',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });

    if (!upstreamRes.ok) {
      // If original image url fails and it looks like a youtube url with video id, attempt standard youtube thumbnail
      const videoIdMatch = imageUrl.match(/(?:vi\/|v=|\/)([a-zA-Z0-9_-]{11})(?:\/|\.|\?|$)/);
      if (videoIdMatch && videoIdMatch[1]) {
        const fallbacks = [
          `https://i.ytimg.com/vi/${videoIdMatch[1]}/hq720.jpg`,
          `https://i.ytimg.com/vi/${videoIdMatch[1]}/sddefault.jpg`,
          `https://i.ytimg.com/vi/${videoIdMatch[1]}/hqdefault.jpg`,
        ];
        for (const fallbackUrl of fallbacks) {
          const fbRes = await fetch(fallbackUrl);
          if (fbRes.ok) {
            const arrayBuffer = await fbRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const contentType = fbRes.headers.get('content-type') || 'image/jpeg';
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.send(buffer);
          }
        }
      }
      return res.status(upstreamRes.status).send('Upstream image fetch failed');
    }

    const contentType = upstreamRes.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await upstreamRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save to cache
    if (cache.size >= MAX_CACHE_SIZE) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }
    cache.set(targetUrl, { buffer, contentType, timestamp: Date.now() });

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(buffer);
  } catch (error: any) {
    console.error('Image proxy error:', error?.message);
    return res.status(500).json({ error: 'Failed to proxy image' });
  }
});
