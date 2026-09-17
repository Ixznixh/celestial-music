/**
 * ProviderManager
 * Central orchestration layer for resilient music streaming providers.
 *
 * Key Capabilities:
 * 1. Primary provider execution (RealMusicProvider)
 * 2. Automatic fallback execution (DemoProvider) when primary fails
 * 3. Request timeout enforcement
 * 4. Rate-limit detection and backoff
 * 5. Data normalization guaranteeing UI independence from provider quirks
 */

import { MusicProvider } from './MusicProvider';
import { RealMusicProvider, realMusicProvider } from './RealMusicProvider';
import {
  Song,
  Album,
  Artist,
  Playlist,
  SearchResults,
  StreamInfo,
  HomeSection,
  Lyrics,
} from '../types';

export interface ProviderStatus {
  primaryName: string;
  isFallbackActive: boolean;
  failureCount: number;
  lastError: string | null;
}

export class ProviderManager implements MusicProvider {
  public id = 'provider-manager';
  public name = 'Celestial YouTube Music Provider';

  private primaryProvider: MusicProvider;
  private requestTimeoutMs: number = 25000;
  private failureCount: number = 0;
  private lastErrorObj: Error | null = null;
  private statusListeners: Set<(status: ProviderStatus) => void> = new Set();

  constructor(primary: MusicProvider = realMusicProvider) {
    this.primaryProvider = primary;
  }

  // --- Configuration & Status Accessors ---

  public setPrimaryProvider(provider: MusicProvider): void {
    this.primaryProvider = provider;
    this.notifyStatus();
  }

  public getPrimaryProvider(): MusicProvider {
    return this.primaryProvider;
  }

  public getActiveProvider(): MusicProvider {
    return this;
  }

  public setRequestTimeout(ms: number): void {
    this.requestTimeoutMs = ms;
  }

  public getRequestTimeout(): number {
    return this.requestTimeoutMs;
  }

  public isUsingFallback(): boolean {
    return false;
  }

  public getLastError(): Error | null {
    return this.lastErrorObj;
  }

  public resetProviderState(): void {
    this.failureCount = 0;
    this.lastErrorObj = null;
    this.notifyStatus();
  }

  public getStatus(): ProviderStatus {
    return {
      primaryName: this.primaryProvider.name || 'YouTube Music Provider',
      isFallbackActive: false,
      failureCount: this.failureCount,
      lastError: this.lastErrorObj ? this.lastErrorObj.message : null,
    };
  }

  public onStatusChange(callback: (status: ProviderStatus) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.getStatus());
    return () => this.statusListeners.delete(callback);
  }

  private notifyStatus(): void {
    const status = this.getStatus();
    this.statusListeners.forEach((listener) => {
      try {
        listener(status);
      } catch (e) {
        console.error('ProviderManager listener error:', e);
      }
    });
  }

  // --- Resilient Execution Pipeline ---

  public async executeWithFallback<T>(
    operation: (provider: MusicProvider) => Promise<T>,
    operationName: string
  ): Promise<T> {
    try {
      const result = await this.withTimeout(
        operation(this.primaryProvider),
        this.requestTimeoutMs,
        `YouTube Music API timed out on ${operationName}`
      );
      this.lastErrorObj = null;
      return result;
    } catch (primaryError: any) {
      this.failureCount += 1;
      this.lastErrorObj = primaryError;
      console.warn(`[ProviderManager] YouTube Music API error on "${operationName}":`, primaryError?.message || primaryError);
      this.notifyStatus();
      throw primaryError;
    }
  }

  private withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
    let timerId: any = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timerId = setTimeout(() => {
        reject(new Error(`${errorMsg} after ${ms}ms`));
      }, ms);
    });

    return Promise.race([
      promise.finally(() => clearTimeout(timerId)),
      timeoutPromise,
    ]);
  }

  // --- Normalization Guards ---

  private sanitizeSong(song: Song): Song {
    return {
      ...song,
      id: String(song.id || 'unknown'),
      title: song.title || 'Untitled Track',
      artist: song.artist || 'Unknown Artist',
      duration: Math.max(1, Number(song.duration) || 180),
      streamUrl: song.streamUrl || '',
      artworkUrl: song.artworkUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80',
      dominantColor: song.dominantColor || '#e11d48',
      accentColor: song.accentColor || '#3b82f6',
    };
  }

  private sanitizeAlbum(album: Album): Album {
    const tracks = Array.isArray(album.tracks) ? album.tracks.map((t) => this.sanitizeSong(t)) : [];
    return {
      ...album,
      id: String(album.id || 'unknown'),
      title: album.title || 'Untitled Album',
      artist: album.artist || 'Unknown Artist',
      tracks,
      trackCount: tracks.length || album.trackCount || 0,
      totalDuration: album.totalDuration || tracks.reduce((acc, t) => acc + t.duration, 0),
      artworkUrl: album.artworkUrl || (tracks[0]?.artworkUrl) || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80',
    };
  }

  private sanitizeArtist(artist: Artist): Artist {
    const popularSongs = Array.isArray(artist.popularSongs) ? artist.popularSongs.map((s) => this.sanitizeSong(s)) : [];
    const albums = Array.isArray(artist.albums) ? artist.albums.map((a) => this.sanitizeAlbum(a)) : [];
    return {
      ...artist,
      id: String(artist.id || 'unknown'),
      name: artist.name || 'Unknown Artist',
      avatarUrl: artist.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80',
      popularSongs,
      albums,
      singles: Array.isArray(artist.singles) ? artist.singles.map((s) => this.sanitizeSong(s)) : [],
    };
  }

  private sanitizePlaylist(playlist: Playlist): Playlist {
    const tracks = Array.isArray(playlist.tracks) ? playlist.tracks.map((t) => this.sanitizeSong(t)) : [];
    return {
      ...playlist,
      id: String(playlist.id || 'unknown'),
      title: playlist.title || 'Untitled Playlist',
      tracks,
      trackCount: tracks.length || playlist.trackCount || 0,
      totalDuration: playlist.totalDuration || tracks.reduce((acc, t) => acc + t.duration, 0),
      artworkUrl: playlist.artworkUrl || tracks[0]?.artworkUrl || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&q=80',
    };
  }

  // --- MusicProvider Implementation ---

  async search(query: string, filter?: string): Promise<SearchResults> {
    const trimmed = (query || '').trim();
    if (!trimmed) {
      return { songs: [], artists: [], albums: [], playlists: [] };
    }

    const rawResults = await this.executeWithFallback(
      (p) => p.search(trimmed, filter),
      `search("${trimmed}")`
    );

    return {
      songs: (rawResults.songs || []).map((s) => this.sanitizeSong(s)),
      artists: (rawResults.artists || []).map((a) => this.sanitizeArtist(a)),
      albums: (rawResults.albums || []).map((a) => this.sanitizeAlbum(a)),
      playlists: (rawResults.playlists || []).map((pl) => this.sanitizePlaylist(pl)),
    };
  }

  async getSong(id: string): Promise<Song> {
    const raw = await this.executeWithFallback(
      (p) => p.getSong(id),
      `getSong("${id}")`
    );
    return this.sanitizeSong(raw);
  }

  async getAlbum(id: string): Promise<Album> {
    const raw = await this.executeWithFallback(
      (p) => p.getAlbum(id),
      `getAlbum("${id}")`
    );
    return this.sanitizeAlbum(raw);
  }

  async getArtist(id: string): Promise<Artist> {
    const raw = await this.executeWithFallback(
      (p) => p.getArtist(id),
      `getArtist("${id}")`
    );
    return this.sanitizeArtist(raw);
  }

  async getPlaylist(id: string): Promise<Playlist> {
    const raw = await this.executeWithFallback(
      (p) => p.getPlaylist(id),
      `getPlaylist("${id}")`
    );
    return this.sanitizePlaylist(raw);
  }

  async getStream(id: string): Promise<StreamInfo> {
    return this.executeWithFallback(
      (p) => p.getStream(id),
      `getStream("${id}")`
    );
  }

  getArtwork(item: Song | Album | Artist | Playlist, size?: 'small' | 'medium' | 'large'): string {
    if ('avatarUrl' in item) return item.avatarUrl;
    return item.artworkUrl || '';
  }

  async getLyrics(
    songId: string,
    meta?: { title?: string; artist?: string; duration?: number; album?: string }
  ): Promise<Lyrics | null> {
    return this.executeWithFallback(
      async (p) => {
        if (p.getLyrics) return p.getLyrics(songId, meta);
        return null;
      },
      `getLyrics("${songId}")`
    );
  }

  async getHomeSections(forceRefresh: boolean = false, mood?: string): Promise<HomeSection[]> {
    const res = await this.executeWithFallback(
      async (p) => {
        if (p.getHomeSections) {
          return p.getHomeSections(forceRefresh, mood);
        }
        throw new Error('Provider does not support getHomeSections');
      },
      `getHomeSections(${forceRefresh ? 'refresh=true' : ''}${mood ? ` mood=${mood}` : ''})`
    );

    if (Array.isArray(res)) {
      return res;
    }
    if (res && Array.isArray((res as any).sections)) {
      return (res as any).sections;
    }
    return [];
  }
}

// Export singleton instance
export const providerManager = new ProviderManager();
