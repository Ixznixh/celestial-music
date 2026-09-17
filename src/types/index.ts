/**
 * Core type definitions for Celestial Music Player
 */

export interface Song {
  id: string;
  title: string;
  artist: string;
  artists?: string;
  artistId: string;
  album: string;
  albumId: string;
  duration: number; // in seconds
  streamUrl: string;
  artwork?: string;
  artworkUrl: string;
  dominantColor?: string; // hex or rgb for artwork-derived gradient
  accentColor?: string;
  genre?: string;
  year?: number;
  trackNumber?: number;
  plays?: number;
  explicit?: boolean;
  provider?: string;
  providerUrl?: string;
  lyrics?: LyricsLine[];
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  releaseYear: number;
  artworkUrl: string;
  dominantColor?: string;
  trackCount: number;
  totalDuration: number; // seconds
  tracks: Song[];
  genre?: string;
  recordLabel?: string;
}

export interface Artist {
  id: string;
  name: string;
  avatarUrl: string;
  headerUrl?: string;
  genre: string;
  bio?: string;
  monthlyListeners?: number;
  popularSongs: Song[];
  albums: Album[];
  singles: Song[];
  relatedArtists?: { id: string; name: string; avatarUrl: string; genre?: string }[];
}

export interface Playlist {
  id: string;
  title: string;
  description?: string;
  artworkUrl?: string;
  collageArtworks?: string[];
  trackCount: number;
  totalDuration: number; // seconds
  tracks: Song[];
  isCustom?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface LyricsLine {
  time: number; // seconds
  text: string;
}

export interface Lyrics {
  songId: string;
  lines: LyricsLine[];
  isSynced: boolean;
}

export type RepeatMode = 'off' | 'all' | 'one';

export interface PlaybackState {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isBuffering: boolean;
  isLoadingSuggestions?: boolean;
  queue: Song[];
  queueIndex: number;
  userQueue?: Song[];
  suggestionsQueue?: Song[];
  shuffle: boolean;
  repeat: RepeatMode;
  error: string | null;
}

export interface HomeSection {
  id: string;
  title: string;
  subtitle?: string;
  type: 'album' | 'song' | 'playlist' | 'artist';
  items: (Song | Album | Playlist | Artist)[];
}

export interface SearchResults {
  songs: Song[];
  artists: Artist[];
  albums: Album[];
  playlists: Playlist[];
}

export interface HomeData {
  sections: HomeSection[];
}

export interface StreamInfo {
  streamUrl: string;
  format?: string;
  bitrate?: number;
  duration?: number;
  license?: string;
  available?: boolean;
  error?: string;
}

export interface MusicProvider {
  id?: string;
  name?: string;
  search(query: string, filter?: string): Promise<SearchResults>;
  getHome?(): Promise<HomeData>;
  getHomeSections?(forceRefresh?: boolean, mood?: string): Promise<HomeSection[]>;
  getArtist(id: string): Promise<Artist>;
  getAlbum(id: string): Promise<Album>;
  getSong(id: string): Promise<Song>;
  getPlaylist(id: string): Promise<Playlist>;
  getStream(id: string): Promise<StreamInfo>;
  getArtwork?(item: Song | Album | Artist | Playlist, size?: 'small' | 'medium' | 'large'): string;
  getLyrics?(songId: string): Promise<Lyrics | null>;
}

export interface AppSettings {
  appearance: 'system' | 'dark' | 'light';
  crossfade: number; // 0, 2, 4, 8 seconds
  audioQuality: 'normal' | 'high' | 'lossless' | 'hires';
  autoplay: boolean;
  soundCheck: boolean;
  offlineMode?: boolean;
}

export interface DownloadedTrack {
  songId: string;
  song: Song;
  sizeBytes: number;
  cachedAt: number;
}

export type AppView = 
  | { type: 'home' }
  | { type: 'search' }
  | { type: 'library' }
  | { type: 'album'; albumId: string }
  | { type: 'artist'; artistId: string }
  | { type: 'playlist'; playlistId: string }
  | { type: 'seeAll'; sectionId: string; title: string };
