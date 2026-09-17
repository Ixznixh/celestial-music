import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProviderManager } from '../ProviderManager';
import { MusicProvider } from '../MusicProvider';
import { Song, Album, Artist, Playlist, SearchResults, StreamInfo } from '../../types';

// Sample test fixture models
const mockSong: Song = {
  id: 'test-song-1',
  title: 'Neon Sunrise',
  artist: 'Mock Artist',
  artistId: 'art-1',
  album: 'Mock Album',
  albumId: 'alb-1',
  duration: 200,
  streamUrl: 'https://example.com/stream.mp3',
  artworkUrl: 'https://example.com/artwork.jpg',
  dominantColor: '#4f46e5',
};

const mockAlbum: Album = {
  id: 'test-alb-1',
  title: 'Mock Album',
  artist: 'Mock Artist',
  artistId: 'art-1',
  releaseYear: 2025,
  artworkUrl: 'https://example.com/alb.jpg',
  trackCount: 1,
  totalDuration: 200,
  tracks: [mockSong],
};

const mockArtist: Artist = {
  id: 'test-art-1',
  name: 'Mock Artist',
  avatarUrl: 'https://example.com/artist.jpg',
  genre: 'Electronic',
  popularSongs: [mockSong],
  albums: [mockAlbum],
  singles: [],
};

const mockPlaylist: Playlist = {
  id: 'test-pl-1',
  title: 'Test Playlist',
  trackCount: 1,
  totalDuration: 200,
  tracks: [mockSong],
  createdAt: 1000,
  updatedAt: 2000,
};

const mockStream: StreamInfo = {
  streamUrl: 'https://example.com/stream.mp3',
  format: 'audio/mp3',
  duration: 200,
  license: 'Creative Commons',
};

// 1. Fully operational Mock Provider
class MockOperationalProvider implements MusicProvider {
  id = 'mock-operational';
  name = 'Operational Provider';

  async search(query: string): Promise<SearchResults> {
    if (query === 'empty_test') {
      return { songs: [], artists: [], albums: [], playlists: [] };
    }
    return {
      songs: [mockSong],
      artists: [mockArtist],
      albums: [mockAlbum],
      playlists: [mockPlaylist],
    };
  }

  async getSong(id: string): Promise<Song> {
    if (id === 'test-song-1') return mockSong;
    throw new Error(`Track not found: ${id}`);
  }

  async getAlbum(id: string): Promise<Album> {
    if (id === 'test-alb-1') return mockAlbum;
    throw new Error(`Album not found: ${id}`);
  }

  async getArtist(id: string): Promise<Artist> {
    if (id === 'test-art-1') return mockArtist;
    throw new Error(`Artist not found: ${id}`);
  }

  async getPlaylist(id: string): Promise<Playlist> {
    if (id === 'test-pl-1') return mockPlaylist;
    throw new Error(`Playlist not found: ${id}`);
  }

  async getStream(id: string): Promise<StreamInfo> {
    if (id === 'test-song-1') return mockStream;
    throw new Error(`Stream not found for ${id}`);
  }
}

// 2. Mock Provider that always fails (simulating HTTP 500 / 429 / Network Crash)
class MockFailingProvider implements MusicProvider {
  id = 'mock-failing';
  name = 'Failing Provider';

  async search(): Promise<SearchResults> {
    throw new Error('Remote API connection refused: HTTP 500');
  }

  async getSong(id: string): Promise<Song> {
    throw new Error(`Provider outage when fetching song ${id}`);
  }

  async getAlbum(id: string): Promise<Album> {
    throw new Error(`Provider outage when fetching album ${id}`);
  }

  async getArtist(id: string): Promise<Artist> {
    throw new Error(`Provider outage when fetching artist ${id}`);
  }

  async getPlaylist(id: string): Promise<Playlist> {
    throw new Error(`Provider outage when fetching playlist ${id}`);
  }

  async getStream(id: string): Promise<StreamInfo> {
    throw new Error(`Provider outage when fetching stream ${id}`);
  }
}

// 3. Mock Provider that hangs / times out
class MockHangingTimeoutProvider implements MusicProvider {
  id = 'mock-timeout';
  name = 'Timeout Provider';

  async search(): Promise<SearchResults> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { songs: [], artists: [], albums: [], playlists: [] };
  }

  async getSong(): Promise<Song> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return mockSong;
  }

  async getAlbum(): Promise<Album> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return mockAlbum;
  }

  async getArtist(): Promise<Artist> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return mockArtist;
  }

  async getPlaylist(): Promise<Playlist> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return mockPlaylist;
  }

  async getStream(): Promise<StreamInfo> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return mockStream;
  }
}

describe('ProviderManager & Mock Music Provider Integration', () => {
  let primaryMock: MockOperationalProvider;
  let fallbackMock: MockOperationalProvider;
  let failingMock: MockFailingProvider;
  let timeoutMock: MockHangingTimeoutProvider;
  let manager: ProviderManager;

  beforeEach(() => {
    primaryMock = new MockOperationalProvider();
    fallbackMock = new MockOperationalProvider();
    failingMock = new MockFailingProvider();
    timeoutMock = new MockHangingTimeoutProvider();

    manager = new ProviderManager(primaryMock);
    manager.setRequestTimeout(2000); // 2 second timeout for normal tests
  });

  // 1. Search test
  it('should successfully search songs, albums, artists, and playlists through provider', async () => {
    const results = await manager.search('Neon');

    expect(results).toBeDefined();
    expect(results.songs.length).toBeGreaterThan(0);
    expect(results.songs[0].title).toBe('Neon Sunrise');
    expect(results.albums.length).toBeGreaterThan(0);
    expect(results.albums[0].title).toBe('Mock Album');
    expect(results.artists.length).toBeGreaterThan(0);
    expect(results.artists[0].name).toBe('Mock Artist');
    expect(results.playlists.length).toBeGreaterThan(0);
    expect(results.playlists[0].title).toBe('Test Playlist');
  });

  // 2. Song lookup test
  it('should successfully lookup song by id and normalize model fields', async () => {
    const song = await manager.getSong('test-song-1');

    expect(song).toBeDefined();
    expect(song.id).toBe('test-song-1');
    expect(song.title).toBe('Neon Sunrise');
    expect(song.artist).toBe('Mock Artist');
    expect(song.streamUrl).toBe('https://example.com/stream.mp3');
  });

  // 3. Album lookup test
  it('should successfully lookup album by id with tracks list', async () => {
    const album = await manager.getAlbum('test-alb-1');

    expect(album).toBeDefined();
    expect(album.id).toBe('test-alb-1');
    expect(album.title).toBe('Mock Album');
    expect(album.tracks).toHaveLength(1);
    expect(album.tracks[0].title).toBe('Neon Sunrise');
  });

  // 4. Artist lookup test
  it('should successfully lookup artist by id with popular tracks and albums', async () => {
    const artist = await manager.getArtist('test-art-1');

    expect(artist).toBeDefined();
    expect(artist.id).toBe('test-art-1');
    expect(artist.name).toBe('Mock Artist');
    expect(artist.popularSongs).toHaveLength(1);
    expect(artist.albums).toHaveLength(1);
  });

  // 5. Stream lookup test
  it('should successfully lookup stream information for playable audio', async () => {
    const stream = await manager.getStream('test-song-1');

    expect(stream).toBeDefined();
    expect(stream.streamUrl).toBe('https://example.com/stream.mp3');
    expect(stream.format).toBe('audio/mp3');
    expect(stream.duration).toBe(200);
  });

  // 6. Provider failure test
  it('should propagate error and record failure count when primary fails', async () => {
    manager.setPrimaryProvider(failingMock);

    await expect(manager.search('Test Query')).rejects.toThrow('HTTP 500');
    expect(manager.getStatus().failureCount).toBeGreaterThanOrEqual(1);
    expect(manager.getLastError()?.message).toContain('HTTP 500');
  });

  // 7. API timeout test
  it('should trigger error when primary provider exceeds request timeout', async () => {
    // Configure a short 50ms timeout on manager
    manager.setRequestTimeout(50);
    manager.setPrimaryProvider(timeoutMock); // Takes 500ms

    await expect(manager.getSong('test-song-1')).rejects.toThrow('timed out');
    expect(manager.getLastError()?.message).toContain('timed out');
  });

  // 8. Empty search results test
  it('should gracefully handle empty search results without throwing errors', async () => {
    // 8a: Empty query string
    const emptyQueryResults = await manager.search('');
    expect(emptyQueryResults.songs).toEqual([]);
    expect(emptyQueryResults.artists).toEqual([]);
    expect(emptyQueryResults.albums).toEqual([]);
    expect(emptyQueryResults.playlists).toEqual([]);

    // 8b: Whitespace only query
    const whitespaceResults = await manager.search('   ');
    expect(whitespaceResults.songs).toEqual([]);

    // 8c: Query with 0 matches
    const noMatchResults = await manager.search('empty_test');
    expect(noMatchResults.songs).toEqual([]);
    expect(noMatchResults.artists).toEqual([]);
    expect(noMatchResults.albums).toEqual([]);
    expect(noMatchResults.playlists).toEqual([]);
  });

  // 9. Provider switching configuration test
  it('should allow switching primary and fallback providers dynamically without UI rework', async () => {
    const customProvider = new MockOperationalProvider();
    customProvider.name = 'Custom Third-Party Provider';

    manager.setPrimaryProvider(customProvider);
    expect(manager.getPrimaryProvider().name).toBe('Custom Third-Party Provider');

    const status = manager.getStatus();
    expect(status.primaryName).toBe('Custom Third-Party Provider');
  });
});
