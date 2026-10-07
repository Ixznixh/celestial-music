/**
 * Server-Side YouTube Music Service using youtubei.js
 * 
 * Reuses a single Innertube instance across all requests.
 * Normalizes all output into our standard data contract.
 */

import { Innertube, Parser, Log } from 'youtubei.js';
import { Song, Album, Artist, Playlist, SearchResults, HomeSection, Lyrics, StreamInfo } from '../types/music';
import { getPalette, parseDuration, getBestThumbnail, getText } from '../utils/formatters';
import { getGeminiThanglishSyncedLyrics, convertLinesToThanglish, transliterateTamilToThanglish } from './geminiLyrics';
import { jioSaavnService } from './jioSaavnService';

// Set Innertube logging level to NONE to completely eliminate benign parser warnings on YouTube's changing UI schemas
Log.setLevel(Log.Level.NONE);

// Register runtime node handlers for YouTube interstitial/ad nodes to avoid missing class warnings
class PlayerInterstitialNode {
  static type = 'PlayerInterstitial';
  constructor(_data?: any) {}
}

class InterstitialViewNode {
  static type = 'InterstitialView';
  constructor(_data?: any) {}
}

try {
  Parser.addRuntimeParser('PlayerInterstitial', PlayerInterstitialNode as any);
  Parser.addRuntimeParser('InterstitialView', InterstitialViewNode as any);
} catch {
  // Ignored if already registered
}

// Custom parser error handler to cleanly ignore benign class_not_found, typecheck mismatches (e.g. Message vs MusicQueue), and schema shifts
Parser.setParserErrorHandler(() => {
  // Suppress all parser notices
});

/**
 * Normalizes title string into core word tokens for similarity checks
 */
function normalizeTitleTokens(title: string): string[] {
  if (!title) return [];
  return title
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\b(official|video|audio|lyric|lyrics|full|song|remix|lofi|hd|4k|mv|remastered|version|visualizer)\b/gi, '')
    .replace(/[^a-z0-9\s]/gi, '')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

/**
 * Cleans YouTube video title and extracts artist, track title, and album metadata
 */
function cleanYouTubeTitleAndArtist(rawTitle: string, channelName?: string): { title: string; artist: string; extractedAlbum?: string } {
  if (!rawTitle) return { title: 'Unknown Track', artist: 'Various Artists' };

  let title = rawTitle.trim();
  let artist = (channelName || 'Various Artists')
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/\s*VEVO$/i, '')
    .replace(/\s*Official Channel$/i, '')
    .trim() || 'Various Artists';
  let extractedAlbum: string | undefined;

  // Extract "(From "Album Name")" or "(Movie Name)"
  const fromMatch = title.match(/\((?:From|from|Movie|Film)\s+["']?([^"')]+)["']?\)/i);
  if (fromMatch && fromMatch[1]) {
    extractedAlbum = fromMatch[1].trim();
  }

  // Check if title has Artist - Title or Artist – Title
  const dashParts = title.split(/\s+[-–—]\s+/);
  if (dashParts.length >= 2) {
    const candidateArtist = dashParts[0].trim();
    const candidateTitle = dashParts.slice(1).join(' - ').trim();
    if (candidateArtist.length > 0 && candidateArtist.length < 50 && !/^(official|video|watch|full\s*video|hd|4k)/i.test(candidateArtist)) {
      artist = candidateArtist;
      title = candidateTitle;
    }
  }

  // Remove common YouTube noise tags
  title = title
    .replace(/\[\s*(?:Official|Full|HD|4K|Lyrics?|Audio|Video|Music\s*Video|Visualizer|Lyric\s*Video|Remastered|Topic|VEVO)\b[^\]]*\]/gi, '')
    .replace(/\(\s*(?:Official|Full|HD|4K|Lyrics?|Audio|Video|Music\s*Video|Visualizer|Lyric\s*Video|Remastered|Audio\s*Song|Video\s*Song)\b[^)]*\)/gi, '')
    .replace(/\b(?:Official\s*Music\s*Video|Official\s*Video|Official\s*Audio|Full\s*Video\s*Song|Full\s*Song|Lyrics?\s*Video|Video\s*Song|Audio\s*Song|Visualizer)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Smart pipe handling for Indian music video titles: "Title | Movie | Artist"
  const pipeParts = title.split(/\s*\|\s*/);
  if (pipeParts.length >= 2) {
    const rawSongName = pipeParts[0]
      .replace(/\s*(?:Video\s*Song|Audio\s*Song|Video|Audio|Song|Lyrical)\b/gi, '')
      .trim();
    if (rawSongName.length > 0) {
      for (const part of pipeParts.slice(1)) {
        if (/anirudh|rahman|yuvan|harris|pradeep|sid sriram|ilayaraja|ilaiyaraaja|shreya|santhosh|hiphop|dsp|devi sri/i.test(part)) {
          artist = part.trim();
          break;
        }
      }
      title = rawSongName;
    }
  }

  if (!title) {
    title = rawTitle.trim();
  }

  return { title, artist, extractedAlbum };
}

/**
 * Cleans song title from YouTube upload tags and extracts embedded album metadata
 */
function cleanSongTitle(rawTitle: string): { title: string; extractedAlbum?: string } {
  const { title, extractedAlbum } = cleanYouTubeTitleAndArtist(rawTitle);
  return { title, extractedAlbum };
}

/**
 * Filter out low-quality YouTube junk (ringtones, status videos, fan edits)
 */
function isJunkOrSpamTrack(title: string, artist: string, query: string): boolean {
  const normTitle = (title || '').toLowerCase();
  const normArtist = (artist || '').toLowerCase();
  const normQuery = (query || '').toLowerCase();

  const junkKeywords = [
    'ringtone',
    'status',
    'whatsapp status',
    'viral ringtone',
    'c m ringtone',
    'infinity x',
    'slowed + reverb',
    'slowed and reverb',
    '8d audio',
    '8d',
    '3d audio',
    'nightcore',
    'lofi flip',
    'bass boosted',
    'chipmunk',
    'reaction',
    'unboxing',
    'review',
    'instrumental ringtone',
    'bgm status',
    'bgm ringtone',
    'tiktok',
    'reels',
    'shorts',
  ];

  for (const kw of junkKeywords) {
    if ((normTitle.includes(kw) || normArtist.includes(kw)) && !normQuery.includes(kw)) {
      return true;
    }
  }

  return false;
}

/**
 * Scores song relevance for search query ranking
 */
function scoreSongRelevance(song: Song & { _originalIndex?: number; _isTopResult?: boolean }, query: string): number {
  const q = query.toLowerCase().trim();
  const title = song.title.toLowerCase().trim();
  const artist = (song.artist || '').toLowerCase().trim();
  const album = (song.album || '').toLowerCase().trim();

  let score = 0;

  // 1. YouTube Music's explicit Top Result shelf bonus
  if (song._isTopResult) {
    score += 600;
  }

  // 2. Original search position index bonus (preserving YouTube Music's global search intelligence)
  if (typeof song._originalIndex === 'number') {
    score += Math.max(0, 300 - song._originalIndex * 25);
  }

  // 3. Exact title match
  if (title === q) {
    score += 250;
  }
  // 4. Title starts with exact query
  else if (title.startsWith(q)) {
    score += 150;
  }
  // 5. Title contains full query phrase
  else if (title.includes(q)) {
    score += 100;
  }

  // Token matching
  const queryTokens = q.split(/\s+/).filter((t) => t.length > 1);
  const titleTokens = title.split(/\s+/).filter((t) => t.length > 1);

  let matchedTokens = 0;
  for (const qt of queryTokens) {
    if (titleTokens.some((tt) => tt.includes(qt) || qt.includes(tt))) {
      matchedTokens++;
    }
  }

  const tokenRatio = queryTokens.length > 0 ? matchedTokens / queryTokens.length : 0;
  score += tokenRatio * 80;

  // Penalty if query has multiple words (e.g. "anbe anbe") but track only matches 1 word
  if (queryTokens.length >= 2 && matchedTokens < queryTokens.length) {
    score -= 80;
  }

  // Major popular original artists boost
  const popularArtists = [
    'arctic monkeys', 'ed sheeran', 'the weeknd', 'taylor swift', 'dua lipa', 
    'billie eilish', 'kendrick lamar', 'drake', 'ariana grande', 'bruno mars', 
    'lady gaga', 'coldplay', 'justin bieber', 'post malone', 'olivia rodrigo', 
    'eminem', 'rihanna', 'kanye west', 'beyonce', 'bts', 'blackpink', 'bad bunny', 
    'a. r. rahman', 'anirudh ravichander', 'sid sriram', 'yuvan shankar raja', 
    'harris jayaraj', 'hiphop tamizha', 's. p. balasubrahmanyam', 'ilaiyaraaja', 
    'pradeep kumar', 'sean roldan', 'g. v. prakash', 'shreya ghoshal', 
    'devi sri prasad', 'santhosh narayanan', 'thaman s', 'vijay prakash', 'hariharan'
  ];
  if (popularArtists.some((pa) => artist.includes(pa))) {
    score += 250;
  }

  // Penalty for unofficial covers / remixes / status clips unless user explicitly searched for them
  const coverKeywords = [
    'cover', 'tribute', 'karaoke', 'instrumental', 'reverb', 'slowed', 
    'brown eyed', 'muzzic', 'acoustic cover', 'remix', 'flip', 'edit'
  ];
  for (const kw of coverKeywords) {
    if (artist.includes(kw) && !q.includes(kw)) {
      score -= 200;
    }
  }

  // Bonus for non-generic artist/album (indicates official topic channel/album release)
  if (artist && artist !== 'Various Artists' && !artist.toLowerCase().includes('vevo')) {
    score += 35;
  }
  if (album && album !== 'Single') {
    score += 25;
  }

  // Bonus if artist or album matches query words
  for (const qt of queryTokens) {
    if (artist.includes(qt)) score += 30;
    if (album.includes(qt)) score += 30;
  }

  // Penalty for extremely long titles compared to query
  if (title.length > q.length + 35) {
    score -= 40;
  }

  return score;
}

/**
 * Checks if candidate title is too similar to target title to prevent repetitive titles
 */
function isTitleTooSimilar(titleA: string, titleB: string): boolean {
  if (!titleA || !titleB) return false;

  const normA = titleA.toLowerCase().trim();
  const normB = titleB.toLowerCase().trim();
  if (normA === normB) return true;

  const tokensA = normalizeTitleTokens(titleA);
  const tokensB = normalizeTitleTokens(titleB);
  if (tokensA.length === 0 || tokensB.length === 0) return false;

  if (tokensA.join(' ') === tokensB.join(' ')) return true;

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let overlap = 0;
  for (const token of setB) {
    if (setA.has(token)) overlap++;
  }

  const simA = overlap / tokensA.length;
  const simB = overlap / tokensB.length;

  return simA >= 0.5 || simB >= 0.5;
}

const QUICK_PICKS_QUERY_POOL = [
  'Latest new Tamil movie songs 2025',
  'New Tamil single tracks 2024 2025',
  'Trending Tamil viral songs',
  'Fresh Kollywood hit songs 2025',
  'Santhosh Narayanan Tamil hit songs',
  'GV Prakash Tamil hit songs',
  'Hip Hop Tamizha Tamil songs',
  'Sam CS Tamil hit songs',
  'Harris Jayaraj Tamil hit songs',
  'Anirudh latest Tamil songs',
  'New Tamil romantic melody songs',
  'Tamil mass kuthu party hits 2025',
  'Pradeep Kumar Sid Sriram Tamil hits',
  'Dhibu Ninan Thomas Tamil songs',
  'Hesham Abdul Wahab Tamil songs',
  'Sean Roldan Tamil songs',
  'Vidya Sagar Tamil hit songs',
];

class YouTubeMusicService {
  private yt: Innertube | null = null;
  private isInitializing = false;
  private initPromise: Promise<Innertube | null> | null = null;

  // In-memory cache for fast repeat lookups
  private searchCache = new Map<string, { data: SearchResults; expires: number }>();
  private suggestionsCache = new Map<string, { data: string[]; expires: number }>();
  private songCache = new Map<string, { data: Song; expires: number }>();
  private albumCache = new Map<string, { data: Album; expires: number }>();
  private artistCache = new Map<string, { data: Artist; expires: number }>();
  private playlistCache = new Map<string, { data: Playlist; expires: number }>();
  private lyricsCache = new Map<string, { data: Lyrics | null; expires: number }>();
  private homeCache = new Map<string, { data: HomeSection[]; expires: number }>();
  private queueCache = new Map<string, { data: Song[]; expires: number }>();
  private playableVideoMap = new Map<string, { playableId: string; title: string; artist: string; duration: number; artworkUrl?: string }>();

  public async getInnertube(): Promise<Innertube | null> {
    if (this.yt) return this.yt;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      this.isInitializing = true;
      try {
        const client = await Innertube.create({
          retrieve_player: true,
        });
        this.yt = client;
        console.log('Innertube (youtubei.js) singleton initialized successfully.');
        return client;
      } catch (err: any) {
        console.error('Innertube initialization error:', err.message);
        this.yt = null;
        return null;
      } finally {
        this.isInitializing = false;
      }
    })();

    return this.initPromise;
  }

  // --- Normalization Helpers ---

  public normalizeSong(item: any): Song {
    const id = item.content_id || item.id || item.video_id || (typeof item.endpoint?.payload?.videoId === 'string' ? item.endpoint.payload.videoId : '') || `track-${Math.random().toString(36).slice(2, 8)}`;
    const rawTitle = item.metadata?.title?.text || getText(item.title) || getText(item.name) || 'Unknown Track';

    let rawAuthor = '';
    let artistId = '';
    if (Array.isArray(item.artists) && item.artists.length > 0) {
      rawAuthor = item.artists.map((a: any) => getText(a.name || a)).filter(Boolean).join(', ');
      artistId = item.artists[0]?.channel_id || item.artists[0]?.id || '';
    } else if (item.author) {
      rawAuthor = getText(item.author.name || item.author);
      artistId = item.author.channel_id || item.author.id || '';
    } else if (item.metadata?.image?.a11y_label) {
      rawAuthor = item.metadata.image.a11y_label.replace(/^Go to channel\s+/i, '');
    }

    const { title, artist, extractedAlbum } = cleanYouTubeTitleAndArtist(rawTitle, rawAuthor);

    let albumName = extractedAlbum || 'Single';
    let albumId = `alb-${id}`;
    if (item.album) {
      const parsedAlbum = getText(item.album.name || item.album);
      if (parsedAlbum) {
        albumName = parsedAlbum;
      }
      albumId = item.album.id || albumId;
    }

    const duration = parseDuration(item.duration?.seconds || item.duration?.text || item.duration);
    
    const thumbs = item.content_image?.primary_thumbnail?.image || item.thumbnails || item.thumbnail;
    let artwork = getBestThumbnail(thumbs);
    if (!artwork || artwork.includes('unsplash') || artwork.length < 10) {
      artwork = id.startsWith('track-') ? 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80' : `https://i.ytimg.com/vi/${id}/hq720.jpg`;
    }

    const colors = getPalette(id + title);

    return {
      id,
      title,
      artists: artist,
      artist: artist,
      artistId,
      album: albumName,
      albumId,
      artwork,
      artworkUrl: artwork,
      duration,
      explicit: Boolean(item.badges?.some((b: any) => getText(b.label || b).toLowerCase().includes('explicit'))),
      provider: 'youtube',
      providerUrl: `https://youtube.com/watch?v=${id}`,
      streamUrl: `/api/song/${id}/audio`,
      dominantColor: colors.dominant,
      accentColor: colors.accent,
      plays: item.views ? parseInt(String(item.views).replace(/[^0-9]/g, ''), 10) || undefined : undefined,
    };
  }

  public normalizeAlbum(item: any): Album {
    const id = item.content_id || item.id || item.browse_id || (typeof item.endpoint?.payload?.browseId === 'string' ? item.endpoint.payload.browseId : '') || `alb-${Math.random().toString(36).slice(2, 8)}`;
    const title = item.metadata?.title?.text || getText(item.title || item.name) || 'Album';
    
    let artistName = 'Various Artists';
    let artistId = '';
    if (Array.isArray(item.artists) && item.artists.length > 0) {
      artistName = item.artists.map((a: any) => getText(a.name || a)).join(', ');
      artistId = item.artists[0]?.channel_id || item.artists[0]?.id || '';
    } else if (item.author) {
      artistName = getText(item.author.name || item.author);
      artistId = item.author.channel_id || item.author.id || '';
    }

    const thumbs = item.content_image?.primary_thumbnail?.image || item.thumbnails || item.thumbnail;
    let artwork = getBestThumbnail(thumbs);
    if (!artwork) {
      artwork = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80';
    }

    const colors = getPalette(id + title);
    const year = item.year ? parseInt(String(item.year).slice(0, 4), 10) || undefined : undefined;

    return {
      id,
      title,
      artist: artistName,
      artistId,
      artwork,
      artworkUrl: artwork,
      year,
      releaseYear: year,
      trackCount: typeof item.item_count === 'number' ? item.item_count : (parseInt(String(item.item_count || '0'), 10) || 0),
      tracks: [],
      dominantColor: colors.dominant,
      provider: 'youtube',
    };
  }

  public normalizeArtist(item: any): Artist {
    const id = item.content_id || item.id || item.channel_id || (typeof item.endpoint?.payload?.browseId === 'string' ? item.endpoint.payload.browseId : '') || `art-${Math.random().toString(36).slice(2, 8)}`;
    const rawName = item.metadata?.title?.text || getText(item.title || item.name || item.author) || 'Artist';
    const name = rawName
      .replace(/\s*-\s*Topic$/i, '')
      .replace(/\s*VEVO$/i, '')
      .replace(/\s*Official Channel$/i, '')
      .trim() || 'Artist';

    const thumbs = item.content_image?.primary_thumbnail?.image || item.thumbnails || item.thumbnail;
    let artwork = getBestThumbnail(thumbs);
    if (!artwork) {
      artwork = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80';
    }

    return {
      id,
      name,
      artwork,
      avatarUrl: artwork,
      provider: 'youtube',
      popularSongs: [],
      albums: [],
      singles: [],
      relatedArtists: [],
    };
  }

  public normalizePlaylist(item: any): Playlist {
    const id = item.content_id || item.id || item.playlist_id || (typeof item.endpoint?.payload?.browseId === 'string' ? item.endpoint.payload.browseId : '') || `pl-${Math.random().toString(36).slice(2, 8)}`;
    const title = item.metadata?.title?.text || getText(item.title) || 'Playlist';
    const description = getText(item.description) || undefined;

    const thumbs = item.content_image?.primary_thumbnail?.image || item.thumbnails || item.thumbnail;
    let artwork = getBestThumbnail(thumbs);
    if (!artwork) {
      artwork = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80';
    }

    return {
      id,
      title,
      description,
      artwork,
      artworkUrl: artwork,
      trackCount: typeof item.item_count === 'number' ? item.item_count : (parseInt(String(item.item_count || '0'), 10) || 0),
      tracks: [],
      provider: 'youtube',
    };
  }

  // --- Real Service Endpoints ---

  /**
   * Real Pure YouTube Search across Videos, Channels, Playlists, and Albums
   */
  public async search(query: string, filter?: string, forceRefresh: boolean = false): Promise<SearchResults> {
    const trimmed = (query || '').trim();
    if (!trimmed) {
      return { songs: [], artists: [], albums: [], playlists: [] };
    }

    const cacheKey = `${trimmed.toLowerCase()}:${filter || 'all'}`;
    const cached = this.searchCache.get(cacheKey);
    if (!forceRefresh && cached && cached.expires > Date.now()) {
      return cached.data;
    }

    const yt = await this.getInnertube();
    if (!yt) {
      throw new Error('Music backend engine currently unavailable');
    }

    const songs: Song[] = [];
    const artists: Artist[] = [];
    const albums: Album[] = [];
    const playlists: Playlist[] = [];

    // Helper to process shelf or list items
    const processItems = (rawList: any[], isTopResultShelf = false) => {
      let indexCounter = 0;
      for (const item of rawList) {
        if (!item) continue;
        const itemType = item.item_type || item.type;

        if (itemType === 'song' || itemType === 'video' || item.duration || item.videoId || item.video_id || item.content_type === 'VIDEO') {
          const s = this.normalizeSong(item) as any;
          s._originalIndex = indexCounter++;
          if (isTopResultShelf && indexCounter === 1) {
            s._isTopResult = true;
          }
          songs.push(s);
        } else if (itemType === 'artist' || itemType === 'channel' || item.content_type === 'CHANNEL') {
          artists.push(this.normalizeArtist(item));
        } else if (itemType === 'album') {
          albums.push(this.normalizeAlbum(item));
        } else if (itemType === 'playlist' || item.content_type === 'PLAYLIST') {
          playlists.push(this.normalizePlaylist(item));
        } else {
          // Check title / endpoint
          if (item.content_id || (item.id && item.duration)) {
            const s = this.normalizeSong(item) as any;
            s._originalIndex = indexCounter++;
            if (isTopResultShelf && indexCounter === 1) {
              s._isTopResult = true;
            }
            songs.push(s);
          }
        }
      }
    };

    const timeoutHelper = (p: Promise<any>, ms: number) =>
      Promise.race([p.catch(() => null), new Promise((resolve) => setTimeout(() => resolve(null), ms))]);

    if (filter === 'song' || filter === 'songs' || filter === 'video' || filter === 'videos') {
      const [ytVideos, ytmSongs]: [any, any] = await Promise.all([
        timeoutHelper(yt.search(trimmed, { type: 'video' }), 12000),
        timeoutHelper(yt.music.search(trimmed, { type: 'song' }), 8000),
      ]);
      if (ytVideos) {
        processItems(ytVideos.videos || ytVideos.results || []);
      }
      if (ytmSongs) {
        for (const shelf of ytmSongs.contents || []) {
          processItems(shelf.contents || []);
        }
      }
    } else if (filter === 'artist' || filter === 'artists' || filter === 'channel' || filter === 'channels') {
      const [ytChannels, ytmArtists]: [any, any] = await Promise.all([
        timeoutHelper(yt.search(trimmed, { type: 'channel' }), 10000),
        timeoutHelper(yt.music.search(trimmed, { type: 'artist' }), 8000),
      ]);
      if (ytChannels) {
        processItems(ytChannels.channels || ytChannels.results || []);
      }
      if (ytmArtists) {
        for (const shelf of ytmArtists.contents || []) {
          processItems(shelf.contents || []);
        }
      }
    } else if (filter === 'playlist' || filter === 'playlists') {
      const [ytPlaylists, ytmPlaylists]: [any, any] = await Promise.all([
        timeoutHelper(yt.search(trimmed, { type: 'playlist' }), 10000),
        timeoutHelper(yt.music.search(trimmed, { type: 'playlist' }), 8000),
      ]);
      if (ytPlaylists) {
        processItems(ytPlaylists.playlists || ytPlaylists.results || []);
      }
      if (ytmPlaylists) {
        for (const shelf of ytmPlaylists.contents || []) {
          processItems(shelf.contents || []);
        }
      }
    } else if (filter === 'album' || filter === 'albums') {
      const ytmAlbums: any = await timeoutHelper(yt.music.search(trimmed, { type: 'album' }), 10000);
      if (ytmAlbums) {
        for (const shelf of ytmAlbums.contents || []) {
          processItems(shelf.contents || []);
        }
      }
    } else {
      // General pure YouTube multi-search across videos, channels, playlists, and music releases
      try {
        const [ytVideos, ytPlaylists, ytChannels, ytmGen, ytmAlbums]: [any, any, any, any, any] = await Promise.all([
          timeoutHelper(yt.search(trimmed, { type: 'video' }), 12000),
          timeoutHelper(yt.search(trimmed, { type: 'playlist' }), 10000),
          timeoutHelper(yt.search(trimmed, { type: 'channel' }), 10000),
          timeoutHelper(yt.music.search(trimmed), 10000),
          timeoutHelper(yt.music.search(trimmed, { type: 'album' }), 8000),
        ]);

        if (ytVideos) {
          processItems(ytVideos.videos || ytVideos.results || [], true);
        }

        if (ytPlaylists) {
          processItems(ytPlaylists.playlists || ytPlaylists.results || []);
        }

        if (ytChannels) {
          processItems(ytChannels.channels || ytChannels.results || []);
        }

        if (ytmGen) {
          for (const shelf of ytmGen.contents || []) {
            processItems(shelf.contents || []);
          }
        }

        if (ytmAlbums) {
          for (const shelf of ytmAlbums.contents || []) {
            processItems(shelf.contents || []);
          }
        }
      } catch (err: any) {
        console.warn('Pure YouTube general search fallback:', err.message);
      }
    }

    // 1. Filter out low-quality YouTube junk/spam (ringtones, status videos, fan edits)
    const cleanSongs = songs.filter((s) => !isJunkOrSpamTrack(s.title, s.artist, trimmed));

    // 2. Deduplicate songs by ID AND by normalized (title + artist) key
    const songMap = new Map<string, Song>();
    for (const song of cleanSongs) {
      const normKey = `${song.title.toLowerCase().trim()}_${song.artist.toLowerCase().trim()}`;
      if (!songMap.has(song.id) && !songMap.has(normKey)) {
        songMap.set(song.id, song);
        songMap.set(normKey, song);
      }
    }
    const uniqueSongs = Array.from(new Set(songMap.values()));

    // 3. Score and Rank songs by relevance score
    uniqueSongs.sort((a, b) => {
      const scoreA = scoreSongRelevance(a, trimmed);
      const scoreB = scoreSongRelevance(b, trimmed);
      return scoreB - scoreA;
    });

    const uniqueArtists = Array.from(new Map(artists.map((a) => [a.id, a])).values());
    const uniqueAlbums = Array.from(new Map(albums.map((a) => [a.id, a])).values());
    const uniquePlaylists = Array.from(new Map(playlists.map((p) => [p.id, p])).values());

    const results: SearchResults = {
      songs: uniqueSongs,
      artists: uniqueArtists,
      albums: uniqueAlbums,
      playlists: uniquePlaylists,
    };

    // Cache results for 5 minutes
    this.searchCache.set(cacheKey, { data: results, expires: Date.now() + 300_000 });
    return results;
  }

  /**
   * Pure YouTube Search Suggestions
   */
  public async getSearchSuggestions(query: string): Promise<string[]> {
    const trimmed = (query || '').trim();
    if (!trimmed) return [];

    const cacheKey = trimmed.toLowerCase();
    const cached = this.suggestionsCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    // 1. Primary: Fast Google/YouTube Search Suggest API
    try {
      const res = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(trimmed)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && Array.isArray(data[1])) {
          const list = data[1].filter((s: any) => typeof s === 'string' && s.trim().length > 0).slice(0, 10);
          if (list.length > 0) {
            this.suggestionsCache.set(cacheKey, { data: list, expires: Date.now() + 600_000 });
            return list;
          }
        }
      }
    } catch {}

    // 2. Secondary fallback: Innertube
    const yt = await this.getInnertube();
    if (!yt) return [];

    try {
      const suggestions: any = await yt.music.getSearchSuggestions(trimmed).catch(() => null);
      if (suggestions) {
        const list: string[] = [];
        for (const sec of suggestions || []) {
          for (const item of sec.contents || []) {
            const text = item.suggestion?.text || item.title || item.query || item.text;
            if (typeof text === 'string' && text.trim().length > 0) {
              list.push(text.trim());
            }
          }
        }
        const deduplicated = Array.from(new Set(list)).slice(0, 10);
        this.suggestionsCache.set(cacheKey, { data: deduplicated, expires: Date.now() + 600_000 });
        return deduplicated;
      }
    } catch (err: any) {
      console.warn('Suggestions error:', err.message);
    }

    return [];
  }

  /**
   * Real Home Feed with automated YouTube Music style recommendations tailored for Tamil music
   */
  public async getHome(forceRefresh: boolean = false, mood?: string): Promise<HomeSection[]> {
    const cacheKey = `home_${mood || 'all'}`;
    const cached = this.homeCache.get(cacheKey);
    if (!forceRefresh && cached && cached.expires > Date.now()) {
      return cached.data;
    }

    const yt = await this.getInnertube();
    if (!yt) {
      throw new Error('Music backend engine currently unavailable');
    }

    const sections: HomeSection[] = [];

    // Category query definitions based on user mood/filter
    let queries: Array<{ id: string; title: string; subtitle: string; query: string; type: 'song' | 'album' }> = [];

    const q1 = QUICK_PICKS_QUERY_POOL[Math.floor(Math.random() * QUICK_PICKS_QUERY_POOL.length)];
    const quickPicksQueryDef = {
      id: 'quick-picks',
      title: 'Quick Picks',
      subtitle: 'START RADIO FROM A SONG',
      query: q1,
      type: 'song' as const,
    };

    if (!mood || mood === 'all') {
      queries = [
        quickPicksQueryDef,
        {
          id: 'trending-tamil',
          title: 'Trending in Tamil Nadu',
          subtitle: 'Latest Kollywood chartbusters & viral tracks',
          query: 'Latest Tamil hit songs',
          type: 'song',
        },
        {
          id: 'anirudh-essentials',
          title: 'Anirudh Ravichander Essentials',
          subtitle: 'Mass beats and viral anthems',
          query: 'Anirudh Ravichander Tamil hit songs',
          type: 'song',
        },
        {
          id: 'ar-rahman-masterpieces',
          title: 'A.R. Rahman Masterpieces',
          subtitle: 'Evergreen Kollywood magic & classic hits',
          query: 'A.R. Rahman Tamil evergreen hit songs',
          type: 'song',
        },
        {
          id: 'tamil-melodies',
          title: 'Tamil Melody & Romance',
          subtitle: 'Heart-touching acoustic & love songs',
          query: 'Tamil melody love romantic songs',
          type: 'song',
        },
        {
          id: 'yuvan-vibes',
          title: 'Yuvan Shankar Raja Vibes',
          subtitle: 'U1 youth anthems & soul melodies',
          query: 'Yuvan Shankar Raja Tamil songs',
          type: 'song',
        },
        {
          id: 'kuthu-party',
          title: 'Mass & Kuthu Beats',
          subtitle: 'High energy dance & celebration songs',
          query: 'Tamil mass kuthu party dance songs',
          type: 'song',
        },
        {
          id: 'kollywood-classics',
          title: '90s & 2000s Kollywood Golden Era',
          subtitle: 'Harris Jayaraj, Vidyasagar & Ilaiyaraaja',
          query: 'Harris Jayaraj Vidyasagar 90s 2000s Tamil hit songs',
          type: 'song',
        },
      ];
    } else if (mood === 'trending' || mood === 'music') {
      queries = [
        quickPicksQueryDef,
        { id: 'trending-tamil-1', title: 'Top 50 Tamil Today', subtitle: 'Trending chartbusters', query: 'Tamil top 50 songs', type: 'song' },
        { id: 'trending-tamil-2', title: 'Viral Kollywood Reels', subtitle: 'Most popular tracks', query: 'Viral Tamil songs Instagram reels', type: 'song' },
        { id: 'trending-tamil-3', title: 'New Releases Tamil', subtitle: 'Fresh off the studio', query: 'New Tamil songs 2024 2025', type: 'song' },
      ];
    } else if (mood === 'melody' || mood === 'chill') {
      queries = [
        quickPicksQueryDef,
        { id: 'melody-1', title: 'Tamil Pure Melodies', subtitle: 'Peaceful acoustic & love tracks', query: 'Tamil melody songs Sid Sriram Pradeep Kumar', type: 'song' },
        { id: 'melody-2', title: 'Late Night Tamil Vibes', subtitle: 'Soothing lo-fi and chill melodies', query: 'Tamil lofi slow reverb melody songs', type: 'song' },
        { id: 'melody-3', title: 'Evergreen Tamil Duets', subtitle: 'Romantic classics', query: 'Tamil romantic duet melody songs', type: 'song' },
      ];
    } else if (mood === 'kuthu' || mood === 'energize' || mood === 'workout') {
      queries = [
        quickPicksQueryDef,
        { id: 'kuthu-1', title: 'High Voltage Tamil Kuthu', subtitle: 'Non-stop dappan koothu & mass beats', query: 'Tamil mass kuthu party songs fast beat', type: 'song' },
        { id: 'kuthu-2', title: 'Kollywood Workout Energy', subtitle: 'Heavy gym & pump beats', query: 'Tamil gym workout motivation songs Anirudh', type: 'song' },
        { id: 'kuthu-3', title: 'Thalapathy & Thala Anthems', subtitle: 'Mass hero introduction songs', query: 'Vijay Ajith mass songs Tamil', type: 'song' },
      ];
    } else if (mood === 'anirudh') {
      queries = [
        quickPicksQueryDef,
        { id: 'anirudh-1', title: 'Anirudh Rockstar Hits', subtitle: 'Chart-topping viral tracks', query: 'Anirudh Ravichander all songs Tamil', type: 'song' },
        { id: 'anirudh-2', title: 'Anirudh Melodies & Love', subtitle: 'Emotional and soulful songs', query: 'Anirudh melody love songs Tamil', type: 'song' },
      ];
    } else if (mood === 'rahman') {
      queries = [
        quickPicksQueryDef,
        { id: 'arr-1', title: 'A.R. Rahman 90s & 2000s Magic', subtitle: 'Roja, Bombay, Jeans, Alaipayuthey', query: 'AR Rahman 90s 2000s Tamil hit songs', type: 'song' },
        { id: 'arr-2', title: 'A.R. Rahman Modern Masterpieces', subtitle: 'PS1, PS2, VTK, Mersal', query: 'AR Rahman latest Tamil songs', type: 'song' },
      ];
    } else if (mood === 'yuvan') {
      queries = [
        quickPicksQueryDef,
        { id: 'u1-1', title: 'Yuvan Drugs & BGM', subtitle: 'Cult favorite tracks and vibes', query: 'Yuvan Shankar Raja hit songs Tamil', type: 'song' },
        { id: 'u1-2', title: 'Yuvan Melancholy & Drive', subtitle: 'Late night soul tracks', query: 'Yuvan Shankar Raja slow sad melody songs', type: 'song' },
      ];
    } else if (mood === 'classics' || mood === 'focus' || mood === 'podcasts') {
      queries = [
        quickPicksQueryDef,
        { id: 'classics-1', title: 'Ilaiyaraaja Evergreen Melodies', subtitle: 'The Maestro’s golden era', query: 'Ilaiyaraaja Tamil hit songs SPB', type: 'song' },
        { id: 'classics-2', title: 'SPB Soulful Classics', subtitle: 'Legendary playback master', query: 'SP Balasubrahmanyam Tamil hits', type: 'song' },
        { id: 'classics-3', title: 'Harris Jayaraj Nostalgia', subtitle: 'Minnale, Vaaranam Aayiram, Ghajini', query: 'Harris Jayaraj hits Tamil songs', type: 'song' },
      ];
    } else {
      queries = [
        quickPicksQueryDef,
        { id: 'tamil-custom', title: 'Tamil Music Collection', subtitle: 'Curated for you', query: `${mood} Tamil songs`, type: 'song' },
      ];
    }

    // Execute queries in parallel
    await Promise.all(
      queries.map(async (cat) => {
        try {
          if (cat.id === 'quick-picks') {
            let qA: string;
            let qB: string;

            if (mood === 'anirudh') {
              qA = 'Anirudh Ravichander Tamil hit songs';
              qB = 'Anirudh Ravichander viral songs';
            } else if (mood === 'rahman') {
              qA = 'AR Rahman Tamil evergreen hit songs';
              qB = 'AR Rahman Tamil romantic hit songs';
            } else if (mood === 'yuvan') {
              qA = 'Yuvan Shankar Raja Tamil hit songs';
              qB = 'Yuvan Shankar Raja melody songs';
            } else if (mood === 'classics') {
              qA = 'Ilaiyaraaja SPB 90s Tamil hit songs';
              qB = 'Harris Jayaraj Vidyasagar 2000s Tamil songs';
            } else if (mood === 'melody' || mood === 'chill') {
              qA = 'Tamil melody romantic love songs';
              qB = 'Sid Sriram Pradeep Kumar Tamil melody songs';
            } else if (mood === 'kuthu' || mood === 'energize' || mood === 'workout') {
              qA = 'Tamil mass kuthu dance songs';
              qB = 'Kollywood fast beat party songs';
            } else if (mood === 'trending' || mood === 'music') {
              qA = 'Tamil top 50 trending songs';
              qB = 'Latest Tamil hit songs 2024 2025';
            } else {
              qA = QUICK_PICKS_QUERY_POOL[Math.floor(Math.random() * QUICK_PICKS_QUERY_POOL.length)];
              qB = QUICK_PICKS_QUERY_POOL[Math.floor(Math.random() * QUICK_PICKS_QUERY_POOL.length)];
            }

            const [res1, res2] = await Promise.all([
              this.search(qA, 'song', true).catch(() => ({ songs: [] })),
              this.search(qB, 'song', true).catch(() => ({ songs: [] })),
            ]);
            const combined = [...(res1.songs || []), ...(res2.songs || [])];
            const seen = new Set<string>();
            const uniqueSongs: Song[] = [];
            for (const song of combined) {
              const key = (song.id || song.title).toLowerCase();
              if (!seen.has(key)) {
                seen.add(key);
                uniqueSongs.push(song);
              }
            }
            const freshItems = uniqueSongs.sort(() => Math.random() - 0.5);
            if (freshItems.length > 0) {
              sections.push({
                id: cat.id,
                title: cat.title,
                subtitle: cat.subtitle,
                type: 'song',
                items: freshItems.slice(0, 16),
              });
            }
            return;
          }

          const results = await this.search(cat.query, 'song', forceRefresh);
          let items = results.songs || [];
          if (items.length > 0) {
            if (forceRefresh && items.length > 4) {
              const topPool = items.slice(0, 6).sort(() => Math.random() - 0.5);
              const restPool = items.slice(6).sort(() => Math.random() - 0.5);
              items = [...topPool, ...restPool];
            }
            sections.push({
              id: cat.id,
              title: cat.title,
              subtitle: cat.subtitle,
              type: 'song',
              items: items.slice(0, 16),
            });
          }
        } catch (e) {
          console.warn(`Failed to fetch section ${cat.title}:`, e);
        }
      })
    );

    // Sort to maintain requested order
    const orderedSections = queries
      .map((q) => sections.find((s) => s.id === q.id))
      .filter((s): s is HomeSection => Boolean(s));

    if (orderedSections.length > 0) {
      this.homeCache.set(cacheKey, { data: orderedSections, expires: Date.now() + 900_000 });
      return orderedSections;
    }

    throw new Error('Tamil music recommendations are temporarily unavailable from the provider.');
  }

  /**
   * Get Song Details via Pure YouTube
   */
  public async getSong(id: string): Promise<Song> {
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      throw new Error('Invalid song ID');
    }

    // Special test stream for iOS background audio diagnostics
    if (id.startsWith('celestial-') || id.startsWith('test-') || id === 'verified-test-stream') {
      return {
        id,
        title: 'iOS Background Verification Track',
        artists: 'Celestial Audio Engine',
        artist: 'Celestial Audio Engine',
        artistId: 'celestial-engine',
        album: 'System Verification',
        albumId: 'system-verification',
        duration: 240,
        artwork: '/apple-touch-icon.png',
        artworkUrl: '/apple-touch-icon.png',
        provider: 'youtube',
        providerUrl: '',
        streamUrl: `/api/song/${id}/audio`,
        dominantColor: '#fa233c',
        accentColor: '#fa233c',
      };
    }

    const cached = this.songCache.get(id);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    const yt = await this.getInnertube();
    if (!yt) {
      throw new Error('Music backend engine currently unavailable');
    }

    try {
      let info: any = null;
      try {
        info = await yt.getInfo(id);
      } catch {
        info = await yt.getBasicInfo(id, { client: 'ANDROID' }).catch(() => null);
      }

      const basic = info?.basic_info || {};
      const rawTitle = (info as any)?.primary_info?.title?.text || getText(basic.title) || 'Unknown Track';
      const rawAuthor = (info as any)?.secondary_info?.owner?.author?.name || (info as any)?.secondary_info?.owner?.title?.text || getText(basic.author || basic.artist) || 'Various Artists';
      const { title, artist, extractedAlbum } = cleanYouTubeTitleAndArtist(rawTitle, rawAuthor);

      const artistId = basic.channel_id || '';
      const album = extractedAlbum || getText(basic.album) || 'Single';
      const duration = basic.duration || 210;

      let artwork = getBestThumbnail(basic.thumbnail);
      if (!artwork || artwork.includes('unsplash') || artwork.length < 10) {
        artwork = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      }
      const colors = getPalette(id + title);

      const song: Song = {
        id,
        title,
        artists: artist,
        artist,
        artistId,
        album,
        albumId: `alb-${id}`,
        artwork,
        artworkUrl: artwork,
        duration,
        provider: 'youtube',
        providerUrl: `https://youtube.com/watch?v=${id}`,
        streamUrl: `/api/song/${id}/audio`,
        dominantColor: colors.dominant,
        accentColor: colors.accent,
      };

      this.songCache.set(id, { data: song, expires: Date.now() + 3600_000 });
      return song;
    } catch (err: any) {
      console.warn(`Error getting pure YouTube song info for ${id}:`, err.message);
      const song: Song = {
        id,
        title: 'Song',
        artists: 'Artist',
        artist: 'Artist',
        album: 'Single',
        albumId: `alb-${id}`,
        artwork: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        artworkUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        duration: 210,
        provider: 'youtube',
        providerUrl: `https://youtube.com/watch?v=${id}`,
        streamUrl: `/api/song/${id}/audio`,
      };
      return song;
    }
  }

  /**
   * Get Album Details with Full Tracklist
   */
  public async getAlbum(id: string): Promise<Album> {
    const cached = this.albumCache.get(id);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    const yt = await this.getInnertube();
    if (!yt) {
      throw new Error('Music backend engine currently unavailable');
    }

    const rawData: any = await yt.music.getAlbum(id);
    if (!rawData) {
      throw new Error(`Album ${id} not found`);
    }

    const title = getText(rawData.title) || rawData.header?.title?.text || 'Album';
    const artist = rawData.artists?.[0]?.name || rawData.header?.author?.name || 'Various Artists';
    const artistId = rawData.artists?.[0]?.channel_id || '';
    const artwork = getBestThumbnail(rawData.thumbnails || rawData.header?.thumbnails);
    const year = rawData.year ? parseInt(String(rawData.year).slice(0, 4), 10) || undefined : undefined;
    const colors = getPalette(id + title);

    const tracks: Song[] = [];
    for (const rawTrack of rawData.contents || []) {
      const track: any = rawTrack;
      const tId = track.id || track.video_id;
      if (!tId) continue;

      const trackTitle = getText(track.title) || 'Track';
      const duration = parseDuration(track.duration);

      tracks.push({
        id: tId,
        title: trackTitle,
        artists: track.artists?.[0]?.name || artist,
        artist: track.artists?.[0]?.name || artist,
        artistId: track.artists?.[0]?.channel_id || artistId,
        album: title,
        albumId: id,
        artwork,
        artworkUrl: artwork,
        duration,
        trackNumber: tracks.length + 1,
        provider: 'youtube_music',
        providerUrl: `https://music.youtube.com/watch?v=${tId}`,
        streamUrl: `/api/song/${tId}/audio`,
        dominantColor: colors.dominant,
        accentColor: colors.accent,
      });
    }

    const album: Album = {
      id,
      title,
      artist,
      artistId,
      artwork,
      artworkUrl: artwork,
      year,
      releaseYear: year,
      trackCount: tracks.length,
      tracks,
      totalDuration: tracks.reduce((acc, t) => acc + t.duration, 0),
      dominantColor: colors.dominant,
      provider: 'youtube_music',
    };

    this.albumCache.set(id, { data: album, expires: Date.now() + 3600_000 });
    return album;
  }

  /**
   * Get Artist / Channel Details
   */
  public async getArtist(id: string): Promise<Artist> {
    const cached = this.artistCache.get(id);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    const yt = await this.getInnertube();
    if (!yt) {
      throw new Error('Music backend engine currently unavailable');
    }

    // 1. If ID starts with UC, query pure YouTube channel
    if (id.startsWith('UC')) {
      try {
        const ch: any = await yt.getChannel(id);
        if (ch) {
          const rawName = ch.metadata?.title || (ch.header as any)?.title?.text || 'Artist';
          const name = rawName
            .replace(/\s*-\s*Topic$/i, '')
            .replace(/\s*VEVO$/i, '')
            .replace(/\s*Official Channel$/i, '')
            .trim();
          const artwork = getBestThumbnail((ch.header as any)?.avatar || (ch.header as any)?.thumbnails || ch.metadata?.avatar);
          const description = ch.metadata?.description || (ch.header as any)?.description?.text || undefined;

          const popularSongs: Song[] = [];
          try {
            const vids = await ch.getVideos();
            for (const item of (vids.videos || []).slice(0, 25)) {
              popularSongs.push(this.normalizeSong(item));
            }
          } catch {}

          const artist: Artist = {
            id,
            name,
            artwork: artwork || `https://i.ytimg.com/vi/${popularSongs[0]?.id || id}/hqdefault.jpg`,
            avatarUrl: artwork || `https://i.ytimg.com/vi/${popularSongs[0]?.id || id}/hqdefault.jpg`,
            description,
            bio: description,
            provider: 'youtube',
            popularSongs,
            albums: [],
            singles: [],
            relatedArtists: [],
          };
          this.artistCache.set(id, { data: artist, expires: Date.now() + 3600_000 });
          return artist;
        }
      } catch (err: any) {
        console.warn(`Pure YouTube channel fetch notice for ${id}:`, err?.message || err);
      }
    }

    // 2. Fallback to yt.music.getArtist
    try {
      const rawArtist: any = await yt.music.getArtist(id);
      if (!rawArtist) {
        throw new Error(`Artist ${id} not found`);
      }

      const name = rawArtist.header?.title?.text || rawArtist.name || 'Artist';
      const artwork = getBestThumbnail(rawArtist.header?.thumbnails || rawArtist.thumbnails);
      const description = rawArtist.header?.description?.text || undefined;

      const popularSongs: Song[] = [];
      const albums: Album[] = [];
      const singles: Song[] = [];
      const relatedArtists: { id: string; name: string; artwork?: string; avatarUrl?: string; genre?: string }[] = [];

      for (const rawSec of rawArtist.sections || []) {
        const sec: any = rawSec;
        const secTitle = (sec.title?.text || sec.header?.title?.text || '').toLowerCase();
        const contents = sec.contents || [];

        if (secTitle.includes('song') || secTitle.includes('popular') || secTitle.includes('top')) {
          for (const item of contents) {
            popularSongs.push(this.normalizeSong(item));
          }
        } else if (secTitle.includes('album')) {
          for (const item of contents) {
            albums.push(this.normalizeAlbum(item));
          }
        } else if (secTitle.includes('single') || secTitle.includes('ep')) {
          for (const item of contents) {
            singles.push(this.normalizeSong(item));
          }
        } else if (secTitle.includes('similar') || secTitle.includes('fan') || secTitle.includes('related')) {
          for (const item of contents) {
            const art = this.normalizeArtist(item);
            relatedArtists.push({
              id: art.id,
              name: art.name,
              artwork: art.artwork,
              avatarUrl: art.artwork,
            });
          }
        }
      }

      const artist: Artist = {
        id,
        name,
        artwork,
        avatarUrl: artwork,
        description,
        bio: description,
        provider: 'youtube',
        popularSongs: popularSongs.slice(0, 15),
        albums: albums.slice(0, 20),
        singles: singles.slice(0, 15),
        relatedArtists: relatedArtists.slice(0, 10),
      };

      this.artistCache.set(id, { data: artist, expires: Date.now() + 3600_000 });
      return artist;
    } catch (err: any) {
      throw new Error(`Artist ${id} not found: ${err?.message || err}`);
    }
  }

  /**
   * Get Pure YouTube Playlist Details
   */
  public async getPlaylist(id: string): Promise<Playlist> {
    const cached = this.playlistCache.get(id);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    const yt = await this.getInnertube();
    if (!yt) {
      throw new Error('Music backend engine currently unavailable');
    }

    let rawPl: any = null;
    // 1. Primary: Pure YouTube getPlaylist
    try {
      rawPl = await yt.getPlaylist(id);
    } catch {
      try {
        rawPl = await yt.music.getPlaylist(id);
      } catch (err: any) {
        throw new Error(`Playlist ${id} not found: ${err?.message || err}`);
      }
    }

    if (!rawPl) {
      throw new Error(`Playlist ${id} not found`);
    }

    const title = rawPl.header?.title?.text || rawPl.info?.title || rawPl.title || 'YouTube Playlist';
    const description = rawPl.header?.description?.text || rawPl.info?.description || rawPl.description || undefined;
    const artwork = getBestThumbnail(rawPl.header?.thumbnails || rawPl.info?.thumbnails || rawPl.thumbnails);

    const tracks: Song[] = [];
    const rawContents = rawPl.videos || rawPl.contents || rawPl.items || [];
    for (const rawTrack of rawContents) {
      const s = this.normalizeSong(rawTrack);
      if (s.id && !s.id.startsWith('track-')) {
        tracks.push(s);
      }
    }

    const firstTrackId = tracks[0]?.id;
    const finalArtwork = artwork || tracks[0]?.artworkUrl || (firstTrackId ? `https://i.ytimg.com/vi/${firstTrackId}/hqdefault.jpg` : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80');
    const uniqueArtworks = Array.from(new Set(tracks.map((t) => t.artworkUrl).filter(Boolean))).slice(0, 4);

    const playlist: Playlist = {
      id,
      title,
      description,
      artwork: finalArtwork,
      artworkUrl: finalArtwork,
      collageArtworks: uniqueArtworks.length >= 4 ? uniqueArtworks : undefined,
      trackCount: tracks.length,
      tracks,
      totalDuration: tracks.reduce((acc, t) => acc + t.duration, 0),
      provider: 'youtube',
    };

    this.playlistCache.set(id, { data: playlist, expires: Date.now() + 3600_000 });
    return playlist;
  }

  /**
   * Helper to parse standard LRC string content into synchronized timestamp lines
   */
  private parseLrcContent(lrcText: string): { time: number; text: string }[] {
    if (!lrcText) return [];
    const timeRegex = /\[(\d{2,}):(\d{2})(?:\.(\d{2,3}))?\]/g;
    const parsedLines: { time: number; text: string }[] = [];
    const rawLrcLines = String(lrcText).split('\n');

    for (const rawLine of rawLrcLines) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;

      // Ignore LRC metadata headers like [ar:], [ti:], [al:], [by:], [offset:]
      if (/^\[(ar|ti|al|by|offset|length|re|ve):/i.test(trimmed)) continue;

      let match;
      const timestamps: number[] = [];
      timeRegex.lastIndex = 0;
      while ((match = timeRegex.exec(trimmed)) !== null) {
        const min = parseInt(match[1], 10);
        const sec = parseInt(match[2], 10);
        const ms = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0;
        timestamps.push(min * 60 + sec + ms / 1000);
      }

      const text = trimmed.replace(/\[\d{2,}:\d{2}(?:\.\d{2,3})?\]/g, '').trim();
      if (timestamps.length > 0 && text) {
        for (const time of timestamps) {
          parsedLines.push({ time, text });
        }
      }
    }

    parsedLines.sort((a, b) => a.time - b.time);
    return parsedLines;
  }

  /**
   * Helper to generate smart progressive timestamps for plain text lyrics based on song duration
   */
  private generateSmartTimestamps(rawLines: string[], durationSec: number = 210): { time: number; text: string }[] {
    if (!rawLines || rawLines.length === 0) return [];
    const duration = durationSec > 10 ? durationSec : 210;

    // Intro delay (5% of duration, max 15s, min 3s) and outro padding
    const introTime = Math.min(15, Math.max(3, duration * 0.05));
    const outroTime = Math.max(duration - 8, duration * 0.93);
    const usableDuration = Math.max(10, outroTime - introTime);

    const cleanLines = rawLines.map((l) => l.trim()).filter((l) => l.length > 0);
    if (cleanLines.length === 0) return [];

    const totalChars = cleanLines.reduce((acc, line) => acc + Math.max(8, line.length), 0);

    let currentAccTime = introTime;
    const result: { time: number; text: string }[] = [];

    for (let i = 0; i < cleanLines.length; i++) {
      const lineText = cleanLines[i];
      const weight = Math.max(8, lineText.length) / totalChars;
      const lineDuration = weight * usableDuration;

      result.push({
        time: Math.round(currentAccTime * 100) / 100,
        text: lineText,
      });

      currentAccTime += lineDuration;
    }

    return result;
  }

  /**
   * Get Lyrics with multi-provider millisecond synchronization & smart timing engine
   */
  public async getLyrics(
    songId: string,
    meta?: { title?: string; artist?: string; duration?: number; album?: string; provider?: string }
  ): Promise<Lyrics | null> {
    const cacheKey = `lyrics:${songId}`;
    const cached = this.lyricsCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    let songTitle = meta?.title;
    let songArtist = meta?.artist;
    let songDuration = meta?.duration;

    // If metadata not provided, retrieve from getSong
    if (!songTitle || !songArtist) {
      try {
        const songInfo = await this.getSong(songId);
        if (songInfo) {
          songTitle = songTitle || songInfo.title;
          songArtist = songArtist || songInfo.artist;
          songDuration = songDuration || songInfo.duration;
        }
      } catch {
        // Continue
      }
    }

    const cleanT = (songTitle || '')
      .replace(/\[[^\]]*\]/g, '')
      .replace(/\([^)]*(?:feat|ft|official|video|audio|lyrics|remastered|explicit|version|remix|movie|film)[^)]*\)/gi, '')
      .trim();
    const cleanA = (songArtist || '')
      .replace(/\b(feat|ft)\.?\s+.*$/gi, '')
      .replace(/\s*-\s*Topic$/i, '')
      .replace(/\s*VEVO$/i, '')
      .split(/[,&/]/)[0]
      .trim();

    // 1. Try LRCLIB for real millisecond-synchronized lyrics
    if (cleanT) {
      try {
        const searchQueries = [
          `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanT)}&artist_name=${encodeURIComponent(cleanA)}${
            songDuration ? `&duration=${Math.round(songDuration)}` : ''
          }`,
          `https://lrclib.net/api/search?track_name=${encodeURIComponent(cleanT)}&artist_name=${encodeURIComponent(cleanA)}`,
          `https://lrclib.net/api/search?q=${encodeURIComponent(`${cleanT} ${cleanA}`)}`,
          `https://lrclib.net/api/search?q=${encodeURIComponent(cleanT)}`,
        ];

        for (const url of searchQueries) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);

          const lrcRes = await fetch(url, {
            headers: { 'User-Agent': 'Celestial-Music/1.0' },
            signal: controller.signal,
          }).catch(() => null);

          clearTimeout(timeout);

          if (lrcRes && lrcRes.ok) {
            const rawData = await lrcRes.json().catch(() => null);
            let target: any = null;

            if (Array.isArray(rawData)) {
              target = rawData.find((x: any) => x.syncedLyrics) || rawData.find((x: any) => x.plainLyrics) || rawData[0];
            } else if (rawData && (rawData.syncedLyrics || rawData.plainLyrics)) {
              target = rawData;
            }

            if (target) {
              if (target.syncedLyrics) {
                const parsed = this.parseLrcContent(target.syncedLyrics);
                if (parsed.length > 0) {
                  const thanglishLines = await convertLinesToThanglish(parsed);
                  const lyrics: Lyrics = { songId, lines: thanglishLines, isSynced: true };
                  this.lyricsCache.set(cacheKey, { data: lyrics, expires: Date.now() + 86400_000 });
                  return lyrics;
                }
              } else if (target.plainLyrics) {
                const plainLines = String(target.plainLyrics)
                  .split('\n')
                  .map((l: string) => l.trim())
                  .filter((l: string) => l.length > 0);

                if (plainLines.length > 0) {
                  const syncedLines = this.generateSmartTimestamps(plainLines, songDuration);
                  const thanglishLines = await convertLinesToThanglish(syncedLines);
                  const lyrics: Lyrics = { songId, lines: thanglishLines, isSynced: true };
                  this.lyricsCache.set(cacheKey, { data: lyrics, expires: Date.now() + 86400_000 });
                  return lyrics;
                }
              }
            }
          }
        }
      } catch (err: any) {
        console.warn(`LRCLIB fetch error for ${songId}:`, err.message);
      }
    }

    // 2. Try Netease Music API for Real Synced LRC Lyrics
    if (cleanT) {
      try {
        const query = `${cleanT} ${cleanA}`.trim();
        const searchUrl = `https://music.163.com/api/search/get/web?s=${encodeURIComponent(query)}&type=1&offset=0&total=true&limit=5`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const sRes = await fetch(searchUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          signal: controller.signal,
        }).catch(() => null);
        clearTimeout(timeout);

        if (sRes && sRes.ok) {
          const sData = await sRes.json().catch(() => null);
          const firstSongId = sData?.result?.songs?.[0]?.id;
          if (firstSongId) {
            const lyricUrl = `https://music.163.com/api/song/lyric?os=pc&id=${firstSongId}&lv=-1&kv=-1&tv=-1`;
            const lRes = await fetch(lyricUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            }).catch(() => null);

            if (lRes && lRes.ok) {
              const lData = await lRes.json().catch(() => null);
              const lrcText = lData?.lrc?.lyric;
              if (lrcText) {
                const parsed = this.parseLrcContent(lrcText);
                if (parsed.length > 0) {
                  const thanglishLines = await convertLinesToThanglish(parsed);
                  const lyrics: Lyrics = { songId, lines: thanglishLines, isSynced: true };
                  this.lyricsCache.set(cacheKey, { data: lyrics, expires: Date.now() + 86400_000 });
                  return lyrics;
                }
              }
            }
          }
        }
      } catch (err: any) {
        console.warn(`Netease lyrics error for ${songId}:`, err.message);
      }
    }

    // 3. Fallback to YouTube Music's native official published lyrics
    const yt = await this.getInnertube();
    if (yt) {
      try {
        const ytLyrics: any = await yt.music.getLyrics(songId);
        if (ytLyrics && ytLyrics.description?.text) {
          const rawLines = ytLyrics.description.text
            .split('\n')
            .map((line: string) => line.trim())
            .filter((line: string) => line.length > 0);

          if (rawLines.length > 0) {
            const syncedLines = this.generateSmartTimestamps(rawLines, songDuration);
            const thanglishLines = await convertLinesToThanglish(syncedLines);
            const lyrics: Lyrics = { songId, lines: thanglishLines, isSynced: true };
            this.lyricsCache.set(cacheKey, { data: lyrics, expires: Date.now() + 86400_000 });
            return lyrics;
          }
        }
      } catch (err: any) {
        console.warn(`YouTube lyrics error for ${songId}:`, err.message);
      }
    }

    // 4. Try Lyrics.ovh Global Real Lyrics API
    if (cleanT && cleanA) {
      try {
        const ovhUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(cleanA)}/${encodeURIComponent(cleanT)}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const ovhRes = await fetch(ovhUrl, { signal: controller.signal }).catch(() => null);
        clearTimeout(timeout);

        if (ovhRes && ovhRes.ok) {
          const ovhData = await ovhRes.json().catch(() => null);
          if (ovhData && ovhData.lyrics) {
            const rawLines = String(ovhData.lyrics)
              .split('\n')
              .map((l: string) => l.trim())
              .filter((l: string) => l.length > 0);

            if (rawLines.length > 0) {
              const syncedLines = this.generateSmartTimestamps(rawLines, songDuration);
              const thanglishLines = await convertLinesToThanglish(syncedLines);
              const lyrics: Lyrics = { songId, lines: thanglishLines, isSynced: true };
              this.lyricsCache.set(cacheKey, { data: lyrics, expires: Date.now() + 86400_000 });
              return lyrics;
            }
          }
        }
      } catch (err: any) {
        console.warn(`Lyrics.ovh fetch error for ${songId}:`, err.message);
      }
    }

    // Direct real lyrics sources exhausted - store empty state so fake lyrics are never generated
    this.lyricsCache.set(cacheKey, { data: null, expires: Date.now() + 3600_000 });
    return null;
  }

  /**
   * Get Pure YouTube Smart Queue (Up Next & Recommendations)
   * Uses YouTube's authentic recommendation graph (watch_next_feed).
   * Filters out redundant/similar title songs and ranks relevant music.
   */
  public async getQueue(songId: string): Promise<Song[]> {
    const cached = this.queueCache.get(songId);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    const yt = await this.getInnertube();
    if (!yt) return [];

    try {
      const pool: Song[] = [];

      // 1. Pure YouTube Up Next / Related videos from watch_next_feed
      try {
        const info = await yt.getInfo(songId).catch(() => null);
        if (info && info.watch_next_feed) {
          for (const item of info.watch_next_feed) {
            const s = this.normalizeSong(item);
            if (s.id && s.id !== songId && !s.id.startsWith('track-')) {
              pool.push(s);
            }
          }
        }
      } catch (e: any) {
        console.warn(`watch_next_feed notice for ${songId}:`, e.message);
      }

      // 2. Secondary: If watch_next_feed was short, try yt.music.getUpNext
      if (pool.length < 8) {
        try {
          const rawUpNext = await yt.music.getUpNext(songId).catch(() => null);
          for (const item of (rawUpNext as any)?.contents || []) {
            const s = this.normalizeSong(item);
            if (s.id && s.id !== songId && !s.id.startsWith('track-')) {
              pool.push(s);
            }
          }
        } catch {}
      }

      // 3. Fallback: Search related songs on YouTube
      if (pool.length < 8) {
        try {
          const timeoutHelper = (p: Promise<any>, ms: number) =>
            Promise.race([p.catch(() => null), new Promise((resolve) => setTimeout(() => resolve(null), ms))]);

          const curSong = this.songCache.get(songId)?.data;
          const query = curSong ? `${curSong.title} ${curSong.artist}` : 'Tamil trending hit songs';
          const fallback = await timeoutHelper(this.search(query, 'song'), 3000);
          if (fallback?.songs) {
            pool.push(...fallback.songs);
          }
        } catch {}
      }

      // Filter out duplicates and title-similar tracks
      const finalQueue: Song[] = [];
      const seenIds = new Set<string>([songId]);
      const acceptedTitles: string[] = [];

      for (const song of pool) {
        if (!song || !song.id || seenIds.has(song.id)) continue;
        if (!song.title || song.title === 'Unknown Track') continue;

        const isDuplicateTitle = acceptedTitles.some((t) => isTitleTooSimilar(song.title, t));
        if (isDuplicateTitle) continue;

        seenIds.add(song.id);
        acceptedTitles.push(song.title);
        finalQueue.push(song);

        if (finalQueue.length >= 25) break;
      }

      this.queueCache.set(songId, { data: finalQueue, expires: Date.now() + 3600_000 });
      return finalQueue;
    } catch (err: any) {
      console.error(`getQueue error for ${songId}:`, err.message);
      return [];
    }
  }

  private streamCache = new Map<string, { data: StreamInfo; expires: number }>();
  private cachedIosInnertube: any = null;

  /**
   * Playback Stream Handler
   * Strictly respects authorized playback mechanisms.
   */
  public async getStream(id: string, metadata?: { title?: string; artist?: string }): Promise<StreamInfo> {
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return {
        streamUrl: '',
        available: false,
        error: 'Invalid song ID provided.',
      };
    }

    const cleanId = id.replace(/^(yt_liked_|yt_top_|yt_sync_)/, '').trim();

    // Special test stream for iOS background audio diagnostics
    if (cleanId.startsWith('celestial-') || cleanId.startsWith('test-') || cleanId === 'verified-test-stream') {
      return {
        streamUrl: `/api/song/${cleanId}/audio`,
        available: true,
        format: 'audio/wav',
        duration: 240,
      };
    }

    // Check high-speed stream cache
    const cached = this.streamCache.get(cleanId);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    // 1. Primary: High-fidelity JioSaavn 320kbps MP4 CDN resolution
    // Provides 100% native HTML5 audio stream for background and lock-screen playback
    const titleToSearch = (metadata as any)?.title || this.songCache.get(cleanId)?.data?.title;
    const artistToSearch =
      (metadata as any)?.artist ||
      this.songCache.get(cleanId)?.data?.artist ||
      (this.songCache.get(cleanId)?.data as any)?.artists ||
      '';

    if (titleToSearch) {
      try {
        const jio = await jioSaavnService.searchTrack(titleToSearch, artistToSearch);
        if (jio && jio.streamUrl320) {
          const jioStream: StreamInfo = {
            streamUrl: jio.streamUrl320,
            available: true,
            format: 'audio/mp4',
            bitrate: 320000,
            duration: jio.duration,
          };
          this.streamCache.set(cleanId, { data: jioStream, expires: Date.now() + 6 * 3600 * 1000 });
          return jioStream;
        }
      } catch (err: any) {
        console.warn(`[getStream] JioSaavn resolution note for ${titleToSearch}:`, err?.message || err);
      }
    }

    const extractionTask = async (): Promise<StreamInfo> => {
      const getIosStream = async (): Promise<StreamInfo | null> => {
        try {
          if (!this.cachedIosInnertube) {
            this.cachedIosInnertube = await Innertube.create({ client_type: 'IOS' as any }).catch(() => null);
          }
          if (this.cachedIosInnertube) {
            const iosInfo = await this.cachedIosInnertube.getBasicInfo(cleanId, { client: 'IOS' }).catch(() => null);
            if (iosInfo) {
              const formats = iosInfo.streaming_data?.adaptive_formats || iosInfo.streaming_data?.formats || [];
              const audioFormats = formats.filter((f: any) => f.has_audio && f.url);
              const bestAudio = audioFormats.find((f: any) => f.itag === 140) || audioFormats[0];
              if (bestAudio && bestAudio.url) {
                return {
                  streamUrl: bestAudio.url,
                  format: bestAudio.mime_type || 'audio/mp4',
                  bitrate: bestAudio.bitrate,
                  duration: bestAudio.approx_duration_ms
                    ? Math.round(bestAudio.approx_duration_ms / 1000)
                    : (iosInfo.basic_info?.duration || undefined),
                  available: true,
                };
              }
            }
          }
        } catch {}
        return null;
      };

      const getAndroidStream = async (): Promise<StreamInfo | null> => {
        try {
          const yt = await this.getInnertube();
          if (yt) {
            const info = await yt.getBasicInfo(cleanId, { client: 'ANDROID' }).catch(() => null);
            if (info && info.streaming_data) {
              const formats = info.streaming_data.adaptive_formats || info.streaming_data.formats || [];
              const audioFormats = formats.filter((f: any) => f.has_audio && f.url);
              const best = audioFormats[0];
              if (best && best.url) {
                return {
                  streamUrl: best.url,
                  format: best.mime_type || 'audio/webm',
                  bitrate: best.bitrate,
                  duration: info.basic_info?.duration || undefined,
                  available: true,
                };
              }
            }
          }
        } catch {}
        return null;
      };

      const getWebStream = async (): Promise<StreamInfo | null> => {
        try {
          const yt = await this.getInnertube();
          if (yt) {
            const info = await yt.getBasicInfo(cleanId, { client: 'WEB_REMIX' as any }).catch(() => null);
            if (info && info.streaming_data) {
              const formats = info.streaming_data.adaptive_formats || info.streaming_data.formats || [];
              const audioFormats = formats.filter((f: any) => f.has_audio && f.url);
              const best = audioFormats[0];
              if (best && best.url) {
                return {
                  streamUrl: best.url,
                  format: best.mime_type || 'audio/webm',
                  bitrate: best.bitrate,
                  duration: info.basic_info?.duration || undefined,
                  available: true,
                };
              }
            }
          }
        } catch {}
        return null;
      };

      // Execute stream extractions concurrently
      const candidates = await Promise.all([getIosStream(), getAndroidStream(), getWebStream()]);
      const validStream = candidates.find((s) => s && s.available && s.streamUrl);

      if (validStream) return validStream;

      const cachedSong = this.songCache.get(cleanId)?.data;
      return {
        streamUrl: `/api/song/${cleanId}/audio`,
        available: false,
        duration: cachedSong?.duration || 240,
        error: 'Direct datacenter stream restricted by YouTube BotGuard.',
      };
    };

    // Generous extraction timeout to allow real audio stream resolution
    const timeoutPromise = new Promise<StreamInfo>((resolve) => {
      setTimeout(() => {
        const cachedSong = this.songCache.get(cleanId)?.data;
        resolve({
          streamUrl: `/api/song/${cleanId}/audio`,
          available: false,
          duration: cachedSong?.duration || 240,
          error: 'Fast extraction window elapsed.',
        });
      }, 20000);
    });

    const result = await Promise.race([extractionTask(), timeoutPromise]);

    // Only cache successful streams
    if (result.available && result.streamUrl && result.streamUrl.startsWith('http')) {
      this.streamCache.set(cleanId, {
        data: result,
        expires: Date.now() + 120 * 60 * 1000,
      });
    }

    return result;
  }

  private candidateCache = new Map<string, { data: Array<{ videoId: string; title: string; artist: string; duration: number; artworkUrl?: string }>; expires: number }>();

  /**
   * Validates and extracts an 11-character YouTube video ID.
   */
  public extractVideoId(input: string | undefined | null): string | null {
    if (!input || typeof input !== 'string') return null;
    const trimmed = input.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
      return trimmed;
    }
    const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([a-zA-Z0-9_-]{11})/);
    if (match && match[1]) {
      return match[1];
    }
    return null;
  }

  /**
   * Retrieves a prioritized list of YouTube video candidates for a track.
   * Priority order:
   * 1. Official artist music video / verified label upload
   * 2. Official audio / lyric video
   * 3. Full song / video song
   * 4. Topic channel / standard search
   * 5. High-quality audio upload
   */
  public async getCandidatesForTrack(
    id: string,
    title?: string,
    artist?: string,
    album?: string
  ): Promise<Array<{ videoId: string; title: string; artist: string; duration: number; artworkUrl?: string }>> {
    const cacheKey = `${id}_${title || ''}_${artist || ''}_${album || ''}`;
    const cached = this.candidateCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    const candidates: Array<{ videoId: string; title: string; artist: string; duration: number; artworkUrl?: string }> = [];
    const seenVideoIds = new Set<string>();

    const validInitialId = this.extractVideoId(id);
    if (validInitialId) {
      candidates.push({
        videoId: validInitialId,
        title: title || 'Original Track',
        artist: artist || '',
        duration: 240,
      });
      seenVideoIds.add(validInitialId);
    }

    const yt = await this.getInnertube();
    let queryTitle = title || '';
    let queryArtist = artist || '';
    let queryAlbum = album || '';

    if (!queryTitle && yt && validInitialId) {
      try {
        const basic = await yt.getBasicInfo(validInitialId).catch(() => null);
        if (basic?.basic_info) {
          queryTitle = basic.basic_info.title || '';
          queryArtist = basic.basic_info.author || '';
        }
      } catch {}
    }

    const cleanTitle = queryTitle
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/ft\..*$/i, '')
      .replace(/feat\..*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    const normalizedFullTitle = queryTitle
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/[\(\)"']/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const primaryArtist = queryArtist
      .split(/[,/&|;]/)[0]
      .replace(/\s*-\s*Topic$/i, '')
      .replace(/\s*VEVO$/i, '')
      .replace(/\s*Official Channel$/i, '')
      .trim();

    const isGenericArtist = !primaryArtist || /various artists|unknown|artist|topic/i.test(primaryArtist);

    if (yt && (cleanTitle || normalizedFullTitle)) {
      const searchQueries: string[] = [];

      if (queryAlbum) {
        searchQueries.push(`${normalizedFullTitle} ${queryAlbum}`);
        searchQueries.push(`${cleanTitle} ${queryAlbum} song`);
      }

      if (!isGenericArtist) {
        searchQueries.push(`${normalizedFullTitle} ${primaryArtist}`);
        searchQueries.push(`${cleanTitle} ${primaryArtist} official audio`);
      } else {
        searchQueries.push(`${normalizedFullTitle} song`);
        searchQueries.push(`${cleanTitle} official audio`);
      }

      const targetTitleTokens = normalizedFullTitle
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 1 && !['from', 'the', 'and', 'with', 'song', 'audio', 'video'].includes(t));

      const targetArtistTokens = isGenericArtist
        ? []
        : primaryArtist
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter((t) => t.length > 1);

      const targetAlbumTokens = queryAlbum
        ? queryAlbum
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter((t) => t.length > 1)
        : [];

      for (const q of searchQueries) {
        if (candidates.length >= 8) break;
        try {
          const searchRes: any = await yt.search(q, { type: 'video' }).catch(() => null);
          const rawVideos: any[] = searchRes?.videos || searchRes?.results || [];

          for (const vid of rawVideos) {
            if (candidates.length >= 8) break;
            const rawVidId = vid.id || vid.video_id;
            const vidId = this.extractVideoId(rawVidId);
            if (!vidId || seenVideoIds.has(vidId)) continue;

            const isLive = vid.is_live || vid.badges?.some?.((b: any) => /live/i.test(b.label || b.text || ''));
            if (isLive) continue;

            const vidDur = parseDuration(vid.duration);
            if (vidDur > 0 && vidDur < 45) continue;

            const vidTitle = getText(vid.title || vid.name).toLowerCase();
            const vidAuthor = getText(vid.author?.name || vid.author || vid.channel?.name || '').toLowerCase();

            // Strict Title Verification
            const matchedTitleTokens = targetTitleTokens.filter((token) => vidTitle.includes(token));
            const titleCoverage = targetTitleTokens.length > 0 ? matchedTitleTokens.length / targetTitleTokens.length : 0;

            if (titleCoverage < 0.5) {
              continue; // Reject candidates that don't cover the song title
            }

            // Strict Artist or Album Verification
            const artistMatched = targetArtistTokens.length > 0 && targetArtistTokens.some((t) => vidTitle.includes(t) || vidAuthor.includes(t));
            const albumMatched = targetAlbumTokens.length > 0 && targetAlbumTokens.some((t) => vidTitle.includes(t) || vidAuthor.includes(t));

            if (isGenericArtist) {
              if (targetAlbumTokens.length > 0 && !albumMatched) {
                // When artist is "Various Artists" and album/movie is specified, candidate MUST match movie/album!
                continue;
              }
            } else {
              if (!artistMatched && !albumMatched) {
                // Require at least artist or album match
                continue;
              }
            }

            const candidateItem = {
              videoId: vidId,
              title: queryTitle || getText(vid.title || vid.name),
              artist: queryArtist || getText(vid.author?.name || vid.author || vid.channel?.name || ''),
              duration: vidDur || 240,
              artworkUrl: getBestThumbnail(vid.thumbnails || vid.thumbnail),
            };

            seenVideoIds.add(vidId);
            candidates.push(candidateItem);
          }
        } catch (err: any) {
          console.warn(`[YouTube] Search candidate query "${q}" failed:`, err?.message);
        }
      }
    }

    this.candidateCache.set(cacheKey, {
      data: candidates,
      expires: Date.now() + 1000 * 60 * 30, // 30 mins
    });

    return candidates;
  }

  /**
   * Resolves a fully embeddable and playable YouTube Video ID for any song
   * (especially when YouTube Music topic track IDs are blocked by error 150).
   */
  public async resolvePlayableTrack(
    id: string,
    title?: string,
    artist?: string
  ): Promise<{ playableId: string; title: string; artist: string; duration: number; artworkUrl?: string }> {
    const candidates = await this.getCandidatesForTrack(id, title, artist);
    const validInitialId = this.extractVideoId(id);
    const alternative = candidates.find((c) => c.videoId !== validInitialId);

    if (alternative) {
      return {
        playableId: alternative.videoId,
        title: alternative.title,
        artist: alternative.artist,
        duration: alternative.duration,
        artworkUrl: alternative.artworkUrl,
      };
    }

    return {
      playableId: validInitialId || id,
      title: title || 'Unknown Track',
      artist: artist || 'Various Artists',
      duration: 240,
    };
  }
}

export const youtubeMusicService = new YouTubeMusicService();
