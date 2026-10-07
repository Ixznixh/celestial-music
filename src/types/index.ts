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
  providerName?: string;
  providerId?: string;
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
  // Appearance
  appearance: 'system' | 'dark' | 'light';
  reduceAnimation: boolean;
  reduceDynamicBlur: boolean;
  liquidGlass: boolean;
  fullscreenCoverArt: boolean;
  legacyMeshGradient: boolean;
  animatedCoverArt: boolean;
  playAnimatedCoverOverCellular: boolean;
  syncedLyrics: boolean;
  blurUnfocusedLyrics: boolean;
  lyricsSource: string;
  translationLanguage: string;

  // Audio Quality & Sources
  audioQuality: 'normal' | 'high' | 'lossless' | 'hires';
  audioQualityWifi: 'low' | 'medium' | 'high' | 'lossless';
  audioQualityMobile: 'low' | 'medium' | 'high' | 'lossless';
  downloadQuality: 'low' | 'medium' | 'high' | 'lossless';
  downloadOverWifiOnly: boolean;
  exportCompatibleDownloads: boolean;
  dolbyAtmos: boolean;
  enableJioSaavnSource: boolean;
  trackLengthTolerance: number; // 1 - 10s (default 3s)
  webdavUrl?: string;
  smbShareUrl?: string;

  // Playback
  preferMusicOnly: boolean;
  outputPrecision: '16-bit PCM' | '32-bit float';
  preferUsbDac: boolean;
  loudnessNormalization: boolean;
  crossfade: number; // 0, 2, 4, 8, 12 seconds
  automix: boolean;
  automixPerformance: 'Balanced' | 'High' | 'Low';
  skipSilence: boolean;
  spatialAudio: boolean;
  autoplay: boolean;
  soundCheck: boolean;
  offlineMode?: boolean;

  // Equalizer
  equalizerEnabled: boolean;
  equalizerPreset: string;
  equalizerBands: number[]; // 7 bands in dB (-12 to +12)
  equalizerBassTone: number; // -10 to +10
  equalizerTrebleTone: number; // -10 to +10
  equalizerBalance: number; // -10 (L) to +10 (R)

  // Performance & Storage & Local
  highPerformanceMode: boolean;
  lowPowerMode: boolean;
  autoLowPowerOnBattery?: boolean;
  lowPowerBackgroundSync?: boolean;
  lowPowerStopAnimations?: boolean;
  localMusicFolder: string;
  filterNonMusicAudio: boolean;
  songCacheLimitMB: number; // 256, 512, 1024, 2048, 0 (unlimited)

  // Your Data & Integrations
  workOutGenres: boolean;
  discordRichPresence: boolean;
  listenBrainzToken: string;
  listenBrainzEnabled: boolean;
  lastFmEnabled: boolean;
  lastFmUser: string;
  spotifyCanvasEnabled: boolean;

  // Misc & Advanced
  playNextOnSwipe: boolean;
  dontRepeatSongsInSession: boolean;
  stopMusicOnCloseFromRecents: boolean;
  hideVolumeBar: boolean;
  hideSongStatus: boolean;
  appLanguage: string;
  smartAudioAlignment: boolean;
  showStatsForNerds: boolean;
}

export interface DownloadedTrack {
  songId: string;
  song: Song;
  sizeBytes: number;
  cachedAt: number;
}

export type AppView = 
  | { type: 'home' }
  | { type: 'explore' }
  | { type: 'search' }
  | { type: 'library' }
  | { type: 'album'; albumId: string }
  | { type: 'artist'; artistId: string }
  | { type: 'playlist'; playlistId: string }
  | { type: 'seeAll'; sectionId: string; title: string };
