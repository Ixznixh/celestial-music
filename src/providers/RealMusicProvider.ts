/**
 * RealMusicProvider
 * 
 * Production music provider interfacing with our internal backend server API.
 * All YouTube Music provider-specific operations (via youtubei.js) are executed
 * safely on the server side. Zero external API keys or client-side dependencies needed.
 */

import { MusicProvider } from './MusicProvider';
import { Song, Album, Artist, Playlist, SearchResults, StreamInfo, HomeSection, Lyrics } from '../types';
import { musicApi } from '../services/musicApi';

export class RealMusicProvider implements MusicProvider {
  public id = 'real-music-provider';
  public name = 'YouTube Music (Backend Provider)';

  async search(query: string, filter?: string): Promise<SearchResults> {
    const trimmed = (query || '').trim();
    if (!trimmed) {
      return { songs: [], artists: [], albums: [], playlists: [] };
    }

    const params: Record<string, string | undefined> = { q: trimmed };
    if (filter) {
      params.filter = filter;
    }

    const data = await musicApi.get<SearchResults>('/search', params);
    return {
      songs: data.songs || [],
      artists: data.artists || [],
      albums: data.albums || [],
      playlists: data.playlists || [],
    };
  }

  async getSong(id: string): Promise<Song> {
    return musicApi.get<Song>(`/song/${encodeURIComponent(id)}`);
  }

  async getAlbum(id: string): Promise<Album> {
    return musicApi.get<Album>(`/album/${encodeURIComponent(id)}`);
  }

  async getArtist(id: string): Promise<Artist> {
    return musicApi.get<Artist>(`/artist/${encodeURIComponent(id)}`);
  }

  async getPlaylist(id: string): Promise<Playlist> {
    return musicApi.get<Playlist>(`/playlist/${encodeURIComponent(id)}`);
  }

  async getStream(id: string): Promise<StreamInfo> {
    return musicApi.get<StreamInfo>(`/stream/${encodeURIComponent(id)}`);
  }

  getArtwork(item: Song | Album | Artist | Playlist): string {
    if ('avatarUrl' in item) return item.avatarUrl;
    return item.artworkUrl || '';
  }

  async getLyrics(
    songId: string,
    meta?: { title?: string; artist?: string; duration?: number; album?: string }
  ): Promise<Lyrics | null> {
    try {
      const params: Record<string, string | number | undefined> = {};
      if (meta?.title) params.title = meta.title;
      if (meta?.artist) params.artist = meta.artist;
      if (meta?.duration) params.duration = meta.duration;
      if (meta?.album) params.album = meta.album;

      return await musicApi.get<Lyrics | null>(`/lyrics/${encodeURIComponent(songId)}`, params);
    } catch {
      return null;
    }
  }

  async getHomeSections(forceRefresh: boolean = false, mood?: string): Promise<HomeSection[]> {
    const params: Record<string, string | undefined> = {};
    if (forceRefresh) {
      params.refresh = 'true';
      params._t = Date.now().toString();
    }
    if (mood) params.mood = mood;

    try {
      const res = await musicApi.get<{ sections: HomeSection[] } | HomeSection[]>('/home', params);
      if (Array.isArray(res) && res.length > 0) {
        return res;
      }
      if (res && Array.isArray((res as any).sections) && (res as any).sections.length > 0) {
        return (res as any).sections;
      }
    } catch (err: any) {
      // Graceful fallback to cached home sections if network/rate-limit occurs
      try {
        const cached = sessionStorage.getItem('celestial_home_sections');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.info('[RealMusicProvider] Serving cached home sections during network notice');
            return parsed;
          }
        }
      } catch {}
      throw err;
    }
    return [];
  }
}

export const realMusicProvider = new RealMusicProvider();
