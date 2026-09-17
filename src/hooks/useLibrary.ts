import { useEffect, useState, useCallback } from 'react';
import { Song, Album, Artist, Playlist } from '../types';
import { db, isDemoItem } from '../services/indexedDB';

export function useLibrary() {
  const [favoriteSongs, setFavoriteSongs] = useState<Song[]>([]);
  const [savedAlbums, setSavedAlbums] = useState<Album[]>([]);
  const [savedArtists, setSavedArtists] = useState<Artist[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadLibrary = useCallback(async () => {
    try {
      const [favs, albs, arts, pls, recents] = await Promise.all([
        db.getFavorites(),
        db.getSavedAlbums(),
        db.getSavedArtists(),
        db.getPlaylists(),
        db.getRecentlyPlayed(30),
      ]);

      let localFavs = favs.filter((s) => !isDemoItem(s));
      let localPls = pls.filter((p) => !isDemoItem(p)).map((p) => ({
        ...p,
        tracks: (p.tracks || []).filter((t) => !isDemoItem(t)),
        trackCount: (p.tracks || []).filter((t) => !isDemoItem(t)).length,
      }));

      // Build Offline Backup Playlist
      const [cachedQueue, downloadedList] = await Promise.all([
        db.getCachedQueueTracks(),
        db.getDownloadedSongs(),
      ]);
      const offlineSongsMap = new Map<string, Song>();

      // Add all user-downloaded songs first
      downloadedList.forEach((d) => {
        if (d.song && !isDemoItem(d.song)) {
          offlineSongsMap.set(d.song.id, d.song);
        }
      });
      
      if (cachedQueue.currentTrack && !isDemoItem(cachedQueue.currentTrack)) {
        offlineSongsMap.set(cachedQueue.currentTrack.id, cachedQueue.currentTrack);
      }
      if (cachedQueue.nextTrack && !isDemoItem(cachedQueue.nextTrack)) {
        offlineSongsMap.set(cachedQueue.nextTrack.id, cachedQueue.nextTrack);
      }
      if (cachedQueue.queue && cachedQueue.queue.length > 0) {
        cachedQueue.queue.forEach((s) => {
          if (s && !isDemoItem(s)) offlineSongsMap.set(s.id, s);
        });
      }

      const offlineTracks = Array.from(offlineSongsMap.values());
      const offlinePlaylist: Playlist = {
        id: 'offline-backup-playlist',
        title: 'Offline Backup',
        description: 'All your cached and downloaded songs available for offline listening.',
        artworkUrl: offlineTracks[0]?.artworkUrl || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=800&q=80',
        collageArtworks: Array.from(new Set(offlineTracks.map(t => t.artworkUrl))).slice(0, 4),
        trackCount: offlineTracks.length,
        totalDuration: offlineTracks.reduce((acc, cur) => acc + cur.duration, 0),
        tracks: offlineTracks,
        isCustom: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      
      // Avoid duplicate if it somehow exists
      localPls = localPls.filter(p => p.id !== 'offline-backup-playlist');
      localPls.unshift(offlinePlaylist);

      // Proactively download missing audio blobs in the background for true offline availability
      setTimeout(() => {
        if (typeof window !== 'undefined' && navigator.onLine) {
          (async () => {
            for (const s of offlineTracks) {
              await db.ensureAudioBlobCached(s).catch(() => {});
            }
          })();
        }
      }, 2000);

      setFavoriteSongs(localFavs);
      setSavedAlbums(albs.filter((a) => !isDemoItem(a)));
      setSavedArtists(arts.filter((a) => !isDemoItem(a)));
      setRecentlyPlayed(recents.filter((s) => !isDemoItem(s)));
      setPlaylists(localPls);
    } catch (e) {
      console.error('Error reading library from IndexedDB:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLibrary();

    const handleDownloadsChanged = () => {
      loadLibrary();
    };

    window.addEventListener('celestial-downloads-changed', handleDownloadsChanged);
    return () => {
      window.removeEventListener('celestial-downloads-changed', handleDownloadsChanged);
    };
  }, [loadLibrary]);

  // Favorites
  const toggleFavorite = useCallback(async (song: Song) => {
    const isFav = favoriteSongs.some((s) => s.id === song.id);
    if (isFav) {
      await db.removeFavorite(song.id);
      setFavoriteSongs((prev) => prev.filter((s) => s.id !== song.id));
    } else {
      await db.addFavorite(song);
      setFavoriteSongs((prev) => [song, ...prev]);
    }
  }, [favoriteSongs]);

  const isFavorite = useCallback(
    (songId: string) => favoriteSongs.some((s) => s.id === songId),
    [favoriteSongs]
  );

  // Albums
  const toggleSaveAlbum = useCallback(async (album: Album) => {
    const isSaved = savedAlbums.some((a) => a.id === album.id);
    if (isSaved) {
      await db.removeSavedAlbum(album.id);
      setSavedAlbums((prev) => prev.filter((a) => a.id !== album.id));
    } else {
      await db.saveAlbum(album);
      setSavedAlbums((prev) => [album, ...prev]);
    }
  }, [savedAlbums]);

  const isAlbumSaved = useCallback(
    (albumId: string) => savedAlbums.some((a) => a.id === albumId),
    [savedAlbums]
  );

  // Artists
  const toggleSaveArtist = useCallback(async (artist: Artist) => {
    const isSaved = savedArtists.some((a) => a.id === artist.id);
    if (isSaved) {
      await db.removeSavedArtist(artist.id);
      setSavedArtists((prev) => prev.filter((a) => a.id !== artist.id));
    } else {
      await db.saveArtist(artist);
      setSavedArtists((prev) => [artist, ...prev]);
    }
  }, [savedArtists]);

  const isArtistSaved = useCallback(
    (artistId: string) => savedArtists.some((a) => a.id === artistId),
    [savedArtists]
  );

  // Playlists
  const createPlaylist = useCallback(async (title: string, description?: string) => {
    const newPlaylist: Playlist = {
      id: `playlist-${Date.now()}`,
      title: title.trim(),
      description: description?.trim() || '',
      artworkUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80',
      collageArtworks: [],
      trackCount: 0,
      totalDuration: 0,
      tracks: [],
      isCustom: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.savePlaylist(newPlaylist);
    setPlaylists((prev) => [newPlaylist, ...prev]);
    return newPlaylist;
  }, []);

  const updatePlaylist = useCallback(async (updated: Playlist) => {
    await db.savePlaylist(updated);
    setPlaylists((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }, []);

  const deletePlaylist = useCallback(async (playlistId: string) => {
    await db.deletePlaylist(playlistId);
    setPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
  }, []);

  const addSongToPlaylist = useCallback(async (playlistId: string, song: Song) => {
    const target = playlists.find((p) => p.id === playlistId);
    if (!target) return;

    if (target.tracks.some((s) => s.id === song.id)) {
      return; // Already in playlist
    }

    const updatedTracks = [...target.tracks, song];
    const totalDuration = updatedTracks.reduce((acc, cur) => acc + cur.duration, 0);
    const updatedCollage = Array.from(new Set(updatedTracks.map((t) => t.artworkUrl))).slice(0, 4);

    const updated: Playlist = {
      ...target,
      tracks: updatedTracks,
      trackCount: updatedTracks.length,
      totalDuration,
      collageArtworks: updatedCollage,
      artworkUrl: target.artworkUrl || song.artworkUrl,
      updatedAt: Date.now(),
    };

    await db.savePlaylist(updated);
    setPlaylists((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }, [playlists]);

  const removeSongFromPlaylist = useCallback(async (playlistId: string, songId: string) => {
    const target = playlists.find((p) => p.id === playlistId);
    if (!target) return;

    const updatedTracks = target.tracks.filter((t) => t.id !== songId);
    const totalDuration = updatedTracks.reduce((acc, cur) => acc + cur.duration, 0);
    const updatedCollage = Array.from(new Set(updatedTracks.map((t) => t.artworkUrl))).slice(0, 4);

    const updated: Playlist = {
      ...target,
      tracks: updatedTracks,
      trackCount: updatedTracks.length,
      totalDuration,
      collageArtworks: updatedCollage,
      updatedAt: Date.now(),
    };

    await db.savePlaylist(updated);
    setPlaylists((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }, [playlists]);

  const reorderPlaylistTracks = useCallback(async (playlistId: string, fromIndex: number, toIndex: number) => {
    const target = playlists.find((p) => p.id === playlistId);
    if (!target) return;

    const newTracks = [...target.tracks];
    const [moved] = newTracks.splice(fromIndex, 1);
    newTracks.splice(toIndex, 0, moved);

    const updated: Playlist = {
      ...target,
      tracks: newTracks,
      updatedAt: Date.now(),
    };

    await db.savePlaylist(updated);
    setPlaylists((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }, [playlists]);

  const clearRecentlyPlayed = useCallback(async () => {
    await db.clearRecentlyPlayed();
    setRecentlyPlayed([]);
  }, []);

  const refreshRecents = useCallback(async () => {
    const recents = await db.getRecentlyPlayed(30);
    setRecentlyPlayed(recents);
  }, []);

  return {
    favoriteSongs,
    savedAlbums,
    savedArtists,
    playlists,
    recentlyPlayed,
    isLoading,
    toggleFavorite,
    isFavorite,
    toggleSaveAlbum,
    isAlbumSaved,
    toggleSaveArtist,
    isArtistSaved,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
    reorderPlaylistTracks,
    clearRecentlyPlayed,
    refreshRecents,
    reloadLibrary: loadLibrary,
  };
}
