import { useState, useEffect, useCallback } from 'react';
import { Song, DownloadedTrack } from '../types';
import { db } from '../services/indexedDB';

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function useDownloads() {
  const [downloadedTracks, setDownloadedTracks] = useState<DownloadedTrack[]>([]);
  const [downloadedSet, setDownloadedSet] = useState<Set<string>>(new Set());
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [totalBytes, setTotalBytes] = useState(0);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refreshDownloads = useCallback(async () => {
    try {
      const [tracks, usage, offlineSetting] = await Promise.all([
        db.getDownloadedSongs(),
        db.getOfflineStorageUsage(),
        db.getSetting<boolean>('offline_mode', false),
      ]);

      const formattedTracks: DownloadedTrack[] = tracks.map((t) => ({
        songId: t.song.id,
        song: t.song,
        sizeBytes: t.sizeBytes,
        cachedAt: t.cachedAt,
      }));

      setDownloadedTracks(formattedTracks);
      setDownloadedSet(new Set(tracks.map((t) => t.song.id)));
      setTotalBytes(usage.totalBytes);
      setIsOfflineMode(Boolean(offlineSetting));
    } catch (err) {
      console.warn('Failed to load downloaded tracks:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshDownloads();

    const handleDownloadsChanged = () => {
      refreshDownloads();
    };

    window.addEventListener('celestial-downloads-changed', handleDownloadsChanged);
    return () => {
      window.removeEventListener('celestial-downloads-changed', handleDownloadsChanged);
    };
  }, [refreshDownloads]);

  const isDownloaded = useCallback(
    (songId: string): boolean => {
      if (!songId) return false;
      return downloadedSet.has(songId);
    },
    [downloadedSet]
  );

  const isDownloading = useCallback(
    (songId: string): boolean => {
      if (!songId) return false;
      return downloadingIds.has(songId);
    },
    [downloadingIds]
  );

  const getProgress = useCallback(
    (songId: string): number => {
      return downloadProgress[songId] || 0;
    },
    [downloadProgress]
  );

  const downloadSong = useCallback(
    async (song: Song): Promise<boolean> => {
      if (!song || isDownloaded(song.id) || isDownloading(song.id)) {
        return false;
      }

      setDownloadingIds((prev) => new Set(prev).add(song.id));
      setDownloadProgress((prev) => ({ ...prev, [song.id]: 0 }));

      try {
        const success = await db.downloadTrackWithProgress(song, (pct) => {
          setDownloadProgress((prev) => ({ ...prev, [song.id]: pct }));
        });

        if (success) {
          await refreshDownloads();
        }
        return success;
      } catch (err) {
        console.warn(`Failed to download song ${song.title}:`, err);
        return false;
      } finally {
        setDownloadingIds((prev) => {
          const next = new Set(prev);
          next.delete(song.id);
          return next;
        });
        setDownloadProgress((prev) => {
          const next = { ...prev };
          delete next[song.id];
          return next;
        });
      }
    },
    [isDownloaded, isDownloading, refreshDownloads]
  );

  const removeDownload = useCallback(
    async (songId: string): Promise<void> => {
      await db.removeDownloadedTrack(songId);
      await refreshDownloads();
    },
    [refreshDownloads]
  );

  const clearAllDownloads = useCallback(async (): Promise<void> => {
    await db.clearAllDownloadedTracks();
    await refreshDownloads();
  }, [refreshDownloads]);

  const toggleOfflineMode = useCallback(
    async (enabled: boolean): Promise<void> => {
      setIsOfflineMode(enabled);
      await db.saveSetting('offline_mode', enabled);
    },
    []
  );

  return {
    downloadedTracks,
    downloadCount: downloadedTracks.length,
    totalBytes,
    storageFormatted: formatBytes(totalBytes),
    isLoading,
    isDownloaded,
    isDownloading,
    getProgress,
    downloadSong,
    removeDownload,
    clearAllDownloads,
    isOfflineMode,
    toggleOfflineMode,
    refreshDownloads,
  };
}
