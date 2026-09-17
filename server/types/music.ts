/**
 * Normalized Music Models for Celestial Backend API
 * 
 * Guarantees a consistent, provider-agnostic data contract.
 * Frontends never depend on raw YouTube Music / Innertube structures.
 */

export interface Song {
  id: string;
  title: string;
  artists: string;
  artist?: string;
  artistId?: string;
  album: string;
  albumId: string;
  artwork: string;
  artworkUrl?: string;
  duration: number; // in seconds
  explicit?: boolean;
  provider: string;
  providerUrl?: string;
  streamUrl?: string;
  plays?: number;
  dominantColor?: string;
  accentColor?: string;
  trackNumber?: number;
  year?: number;
}

export interface Artist {
  id: string;
  name: string;
  artwork: string;
  avatarUrl?: string;
  description?: string;
  bio?: string;
  provider: string;
  genre?: string;
  popularSongs?: Song[];
  albums?: Album[];
  singles?: Song[];
  relatedArtists?: { id: string; name: string; artwork?: string; avatarUrl?: string; genre?: string }[];
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  artwork: string;
  artworkUrl?: string;
  year?: number;
  releaseYear?: number;
  trackCount: number;
  tracks: Song[];
  totalDuration?: number;
  dominantColor?: string;
  provider?: string;
}

export interface Playlist {
  id: string;
  title: string;
  description?: string;
  artwork: string;
  artworkUrl?: string;
  trackCount: number;
  tracks: Song[];
  totalDuration?: number;
  provider?: string;
  isCustom?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface SearchResults {
  songs: Song[];
  artists: Artist[];
  albums: Album[];
  playlists: Playlist[];
}

export interface HomeSection {
  id: string;
  title: string;
  subtitle?: string;
  type: 'album' | 'song' | 'playlist' | 'artist';
  items: (Song | Album | Playlist | Artist)[];
}

export interface HomeData {
  sections: HomeSection[];
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

export interface StreamInfo {
  streamUrl: string;
  format?: string;
  bitrate?: number;
  duration?: number;
  license?: string;
  available?: boolean;
  error?: string;
}
