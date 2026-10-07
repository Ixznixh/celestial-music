/**
 * YouTubeMusicProvider (Frontend Client)
 * 
 * Implements the standard MusicProvider contract by communicating with our
 * server-side Node.js API endpoints. YouTube.js / InnerTube code remains strictly
 * on the backend.
 */

import { MusicProvider } from './MusicProvider';
import {
  Song,
  Album,
  Artist,
  Playlist,
  SearchResults,
  StreamInfo,
  HomeSection,
  HomeData,
  Lyrics,
} from '../types';
import { musicApi } from '../services/musicApi';

export class YouTubeMusicProvider implements MusicProvider {
  public id = 'youtube_music';
  public name = 'Pure YouTube API';

  /**
   * Search Songs, Artists, Albums, and Playlists
   */
  public async search(query: string, filter?: string): Promise<SearchResults> {
    const params: Record<string, string> = { q: query };
    if (filter && filter !== 'all') {
      params.type = filter;
    }
    return musicApi.get<SearchResults>('/search', params);
  }

  /**
   * Home Sections
   */
  public async getHome(): Promise<HomeData> {
    const res = await musicApi.get<{ sections: HomeSection[] } | HomeSection[]>('/home');
    if (Array.isArray(res)) {
      return { sections: res };
    }
    return res && res.sections ? res : { sections: [] };
  }

  public async getHomeSections(): Promise<HomeSection[]> {
    const data = await this.getHome();
    return data.sections || [];
  }

  /**
   * Song by ID
   */
  public async getSong(id: string): Promise<Song> {
    return musicApi.get<Song>(`/song/${encodeURIComponent(id)}`);
  }

  /**
   * Album by ID
   */
  public async getAlbum(id: string): Promise<Album> {
    return musicApi.get<Album>(`/album/${encodeURIComponent(id)}`);
  }

  /**
   * Artist by ID
   */
  public async getArtist(id: string): Promise<Artist> {
    return musicApi.get<Artist>(`/artist/${encodeURIComponent(id)}`);
  }

  /**
   * Playlist by ID
   */
  public async getPlaylist(id: string): Promise<Playlist> {
    return musicApi.get<Playlist>(`/playlist/${encodeURIComponent(id)}`);
  }

  /**
   * Song Lyrics (Returns null or synchronized lines)
   */
  public async getLyrics(
    id: string,
    meta?: { title?: string; artist?: string; duration?: number; album?: string }
  ): Promise<Lyrics | null> {
    try {
      const params: Record<string, string | number | undefined> = {};
      if (meta?.title) params.title = meta.title;
      if (meta?.artist) params.artist = meta.artist;
      if (meta?.duration) params.duration = meta.duration;
      if (meta?.album) params.album = meta.album;

      const res = await musicApi.get<any>(`/lyrics/${encodeURIComponent(id)}`, params);
      if (res && res.available && Array.isArray(res.lines) && res.lines.length > 0) {
        return {
          songId: id,
          lines: res.lines,
          isSynced: res.isSynced ?? false,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Up Next / Real Queue recommendations
   */
  public async getQueue(id: string): Promise<Song[]> {
    try {
      const res = await musicApi.get<{ queue: Song[] }>(`/queue/${encodeURIComponent(id)}`);
      return res?.queue || [];
    } catch {
      return [];
    }
  }

  /**
   * Stream metadata
   */
  public async getStream(id: string): Promise<StreamInfo> {
    try {
      return await musicApi.get<StreamInfo>(`/song/${encodeURIComponent(id)}/stream`);
    } catch {
      return {
        streamUrl: `/api/song/${encodeURIComponent(id)}/audio`,
        format: 'audio/mp3',
        available: true,
      };
    }
  }

  public getArtwork(item: Song | Album | Artist | Playlist, size: 'small' | 'medium' | 'large' = 'medium'): string {
    const raw = (item as any).artwork || (item as any).artworkUrl || (item as any).avatarUrl;
    if (raw) return raw;
    return 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80';
  }
}

export const youtubeMusicProvider = new YouTubeMusicProvider();
