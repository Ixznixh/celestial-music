import { Song, Album, Artist, Playlist, SearchResults, StreamInfo, HomeSection, Lyrics } from '../types';

export interface MusicProvider {
  id?: string;
  name?: string;
  search(query: string, filter?: string): Promise<SearchResults>;
  getArtist(id: string): Promise<Artist>;
  getAlbum(id: string): Promise<Album>;
  getSong(id: string): Promise<Song>;
  getPlaylist(id: string): Promise<Playlist>;
  getStream(id: string): Promise<StreamInfo>;
  getArtwork?(item: Song | Album | Artist | Playlist, size?: 'small' | 'medium' | 'large'): string;
  getLyrics?(songId: string, meta?: { title?: string; artist?: string; duration?: number; album?: string }): Promise<Lyrics | null>;
  getHomeSections?(forceRefresh?: boolean, mood?: string): Promise<HomeSection[]>;
}

export type { Song, Album, Artist, Playlist, SearchResults, StreamInfo, HomeSection, Lyrics };
