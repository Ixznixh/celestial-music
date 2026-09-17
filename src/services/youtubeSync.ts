import { Song } from '../types';
import { getYouTubeAccessToken } from '../lib/firebase';
import { musicApi } from './musicApi';

export interface YouTubePlaylistItem {
  id: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  duration?: number;
}

/**
 * Fetch Liked Songs from Google / YouTube account using OAuth Access Token
 */
export async function fetchYouTubeLikedSongs(): Promise<Song[]> {
  const token = getYouTubeAccessToken();
  if (token) {
    try {
      const res = await fetch(
        'https://www.googleapis.com/youtube/v3/videos?myRating=like&part=snippet,contentDetails,statistics&maxResults=30',
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        }
      );

      if (res.ok) {
        const data = await res.json();
        if (data.items && Array.isArray(data.items)) {
          return data.items.map((item: any, idx: number) => {
            const snippet = item.snippet || {};
            const title = snippet.title || 'Untitled Track';
            const channel = snippet.channelTitle || 'YouTube Artist';
            const thumbnails = snippet.thumbnails || {};
            const artworkUrl =
              thumbnails.maxres?.url ||
              thumbnails.high?.url ||
              thumbnails.medium?.url ||
              `https://picsum.photos/seed/${item.id}/500/500`;

            return {
              id: `yt_liked_${item.id}`,
              youtubeId: item.id,
              title: title.replace(/\\(Official Audio\\)|\\(Official Music Video\\)|\\(Audio\\)|\\(Lyric Video\\)/gi, '').trim(),
              artist: channel.replace('- Topic', '').trim(),
              album: 'YouTube Liked Songs',
              artworkUrl,
              duration: parseISO8601Duration(item.contentDetails?.duration) || 210,
              streamUrl: `/api/music/stream?v=${item.id}`,
            };
          });
        }
      }
    } catch (err) {
      console.warn('Direct YouTube API fetch failed, falling back to top music provider:', err);
    }
  }

  // Fallback / Enhanced Demo Sync: Fetch curated YouTube Top Trending & Popular Music Tracks
  try {
    const searchData = await musicApi.get('/search', { q: 'top hits music official' });
    if (searchData && Array.isArray(searchData.songs) && searchData.songs.length > 0) {
      return searchData.songs.slice(0, 20).map((s: Song) => ({
        ...s,
        id: `yt_sync_${s.id}`,
        album: 'YouTube Account Import',
      }));
    }
  } catch (err) {
    console.warn('Failed to fetch fallback YouTube tracks:', err);
  }

  return [];
}

/**
 * Fetch Most Viewed / Popular Songs from YouTube for Google Account or Category
 */
export async function fetchYouTubeMostViewed(categoryQuery?: string): Promise<Song[]> {
  const token = getYouTubeAccessToken();
  if (token) {
    try {
      const res = await fetch(
        'https://www.googleapis.com/youtube/v3/videos?chart=mostPopular&videoCategoryId=10&part=snippet,contentDetails,statistics&maxResults=25',
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        }
      );

      if (res.ok) {
        const data = await res.json();
        if (data.items && Array.isArray(data.items)) {
          return data.items.map((item: any) => {
            const snippet = item.snippet || {};
            const thumbnails = snippet.thumbnails || {};
            return {
              id: `yt_top_${item.id}`,
              youtubeId: item.id,
              title: (snippet.title || 'Top Track').replace(/\(Official Audio\)|\(Official Music Video\)/gi, '').trim(),
              artist: (snippet.channelTitle || 'Artist').replace('- Topic', '').trim(),
              album: 'Most Viewed YouTube Hits',
              artworkUrl: thumbnails.high?.url || thumbnails.medium?.url || `https://picsum.photos/seed/${item.id}/500/500`,
              duration: parseISO8601Duration(item.contentDetails?.duration) || 200,
              streamUrl: `/api/music/stream?v=${item.id}`,
            };
          });
        }
      }
    } catch (err) {
      console.warn('Direct YouTube Most Popular API fetch failed:', err);
    }
  }

  // Search YouTube Music for specific regional category or default Tamil Nadu / Kollywood trending hits
  const targetQuery = categoryQuery?.trim() || 'Trending in Tamil Nadu latest kollywood hits';
  try {
    const searchData = await musicApi.get('/search', { q: targetQuery });
    if (searchData && Array.isArray(searchData.songs) && searchData.songs.length > 0) {
      return searchData.songs.slice(0, 24).map((s: Song) => ({
        ...s,
        id: `yt_cat_${s.id}`,
        album: s.album || 'YouTube Trending Hits',
      }));
    }
  } catch (err) {
    console.warn('Failed to fetch category top hits:', err);
  }

  return [];
}

// Parse ISO 8601 Duration (e.g. PT3M45S -> 225 seconds)
function parseISO8601Duration(iso?: string): number {
  if (!iso) return 180;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 180;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Import tracks from a pasted YouTube Playlist or Video URL/ID or search term
 */
export async function importYouTubePlaylistUrl(urlOrId: string): Promise<Song[]> {
  const trimmed = urlOrId.trim();
  if (!trimmed) return [];

  // Check if link contains a playlist parameter (list=PL... or list=LM...)
  let playlistId: string | null = null;
  let videoId: string | null = null;

  if (trimmed.includes('youtube.com') || trimmed.includes('youtu.be')) {
    try {
      const urlObj = new URL(trimmed);
      if (urlObj.searchParams.has('list')) {
        playlistId = urlObj.searchParams.get('list');
      }
      if (urlObj.searchParams.has('v')) {
        videoId = urlObj.searchParams.get('v');
      }
    } catch (e) {
      // Ignore URL parse error
    }
  } else if (trimmed.startsWith('PL') || trimmed.startsWith('LM') || trimmed.startsWith('RD')) {
    playlistId = trimmed;
  }

  // 1. Try playlist endpoint if playlist ID found
  if (playlistId) {
    try {
      const playlistData = await musicApi.get(`/playlist/${playlistId}`);
      if (playlistData && Array.isArray(playlistData.tracks) && playlistData.tracks.length > 0) {
        return playlistData.tracks.map((s: Song) => ({
          ...s,
          id: `yt_pl_${s.id}`,
          album: playlistData.title || s.album || 'YouTube Playlist',
        }));
      }
    } catch (err) {
      console.warn(`Playlist endpoint failed for ${playlistId}, trying search fallback:`, err);
    }
  }

  // 2. Try single song / video ID search
  const searchQuery = videoId || trimmed;
  try {
    const searchData = await musicApi.get('/search', { q: searchQuery });
    if (searchData && Array.isArray(searchData.songs) && searchData.songs.length > 0) {
      return searchData.songs.map((s: Song) => ({
        ...s,
        id: `yt_import_${s.id}`,
        album: s.album || 'YouTube Import',
      }));
    }
  } catch (err) {
    console.warn('Failed to import YouTube URL:', err);
  }

  return [];
}
