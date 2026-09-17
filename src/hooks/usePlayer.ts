import { useEffect, useState, useCallback } from 'react';
import { audioEngine } from '../services/audioEngine';
import { backgroundAudioManager } from '../player/BackgroundAudioManager';
import { Song, PlaybackState } from '../types';

export function usePlayer() {
  const [state, setState] = useState<PlaybackState>(() => audioEngine.getState());

  useEffect(() => {
    const unsubscribe = audioEngine.subscribe((newState) => {
      setState(newState);
    });
    return unsubscribe;
  }, []);

  // Set up Media Session API & Background Playback in the player hook
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    const safeSetActionHandler = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (err) {
        // Action not supported by current browser environment
      }
    };

    // Lock-screen & Notification Action Handlers
    safeSetActionHandler('play', () => {
      backgroundAudioManager.startPlaybackAnchor(state.currentSong);
      audioEngine.play();
    });

    safeSetActionHandler('pause', () => {
      backgroundAudioManager.stopPlaybackAnchor();
      audioEngine.pause();
    });

    safeSetActionHandler('stop', () => {
      backgroundAudioManager.stopPlaybackAnchor();
      audioEngine.pause();
      audioEngine.seek(0);
      try { navigator.mediaSession.playbackState = 'none'; } catch {}
    });

    safeSetActionHandler('previoustrack', () => {
      audioEngine.previous();
    });

    safeSetActionHandler('nexttrack', () => {
      audioEngine.next();
    });

    safeSetActionHandler('seekbackward', (details) => {
      const offset = details.seekOffset || 10;
      audioEngine.seek(Math.max(0, state.currentTime - offset));
    });

    safeSetActionHandler('seekforward', (details) => {
      const offset = details.seekOffset || 10;
      const target = state.duration > 0
        ? Math.min(state.duration, state.currentTime + offset)
        : state.currentTime + offset;
      audioEngine.seek(target);
    });

    safeSetActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined && !isNaN(details.seekTime)) {
        audioEngine.seek(details.seekTime);
      }
    });
  }, [state.currentTime, state.duration, state.currentSong]);

  // Update Media Session Metadata when currentSong changes
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    const currentSong = state.currentSong;
    if (!currentSong) {
      try { navigator.mediaSession.metadata = null; } catch {}
      return;
    }

    try {
      const isYtId = currentSong.id && currentSong.id.length === 11 && !currentSong.id.includes(' ');
      const rawArt = currentSong.artwork || currentSong.artworkUrl || (isYtId ? `https://i.ytimg.com/vi/${currentSong.id}/hqdefault.jpg` : '/apple-touch-icon.png');
      
      let primaryArt = rawArt;
      if (typeof window !== 'undefined' && rawArt && !rawArt.startsWith('http://') && !rawArt.startsWith('https://')) {
        try {
          primaryArt = new URL(rawArt, window.location.origin).href;
        } catch {}
      }

      const artworkList: MediaImage[] = [
        { src: primaryArt, sizes: '96x96', type: 'image/jpeg' },
        { src: primaryArt, sizes: '128x128', type: 'image/jpeg' },
        { src: primaryArt, sizes: '192x192', type: 'image/jpeg' },
        { src: primaryArt, sizes: '256x256', type: 'image/jpeg' },
        { src: primaryArt, sizes: '384x384', type: 'image/jpeg' },
        { src: primaryArt, sizes: '512x512', type: 'image/jpeg' },
      ];

      if (isYtId) {
        artworkList.push(
          { src: `https://i.ytimg.com/vi/${currentSong.id}/maxresdefault.jpg`, sizes: '1280x720', type: 'image/jpeg' },
          { src: `https://i.ytimg.com/vi/${currentSong.id}/sddefault.jpg`, sizes: '640x480', type: 'image/jpeg' },
          { src: `https://i.ytimg.com/vi/${currentSong.id}/hqdefault.jpg`, sizes: '480x360', type: 'image/jpeg' }
        );
      }

      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.title || 'Unknown Track',
        artist: currentSong.artist || (currentSong as any).artists || 'Celestial Music',
        album: currentSong.album || 'Celestial Music',
        artwork: artworkList,
      });
    } catch (err) {
      console.warn('[usePlayer] Failed to update MediaSession metadata:', err);
    }
  }, [state.currentSong]);

  // Sync Media Session PlaybackState & PositionState
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.playbackState = state.isPlaying ? 'playing' : 'paused';
    } catch {}

    if (typeof navigator.mediaSession.setPositionState === 'function') {
      try {
        const dur = state.duration;
        const cur = state.currentTime;
        if (
          typeof dur === 'number' &&
          isFinite(dur) &&
          dur > 0 &&
          typeof cur === 'number' &&
          isFinite(cur) &&
          cur >= 0
        ) {
          navigator.mediaSession.setPositionState({
            duration: Math.max(1, dur),
            playbackRate: 1,
            position: Math.min(Math.max(0, cur), dur),
          });
        }
      } catch {}
    }
  }, [state.isPlaying, state.currentTime, state.duration]);

  const playTrack = useCallback((song: Song, contextQueue?: Song[]) => {
    backgroundAudioManager.unlockAudioContext().catch(() => {});
    backgroundAudioManager.startPlaybackAnchor(song);
    return audioEngine.playTrack(song, contextQueue);
  }, []);

  const playQueueIndex = useCallback((idx: number) => {
    backgroundAudioManager.unlockAudioContext().catch(() => {});
    return audioEngine.playQueueIndex(idx);
  }, []);

  const loadSuggestions = useCallback((songId?: string) => {
    return audioEngine.loadSuggestions(songId);
  }, []);

  const play = useCallback(() => {
    backgroundAudioManager.startPlaybackAnchor(state.currentSong);
    return audioEngine.play();
  }, [state.currentSong]);

  const pause = useCallback(() => {
    backgroundAudioManager.stopPlaybackAnchor();
    return audioEngine.pause();
  }, []);

  const togglePlay = useCallback(() => {
    if (state.isPlaying) {
      backgroundAudioManager.stopPlaybackAnchor();
      return audioEngine.pause();
    } else {
      backgroundAudioManager.startPlaybackAnchor(state.currentSong);
      return audioEngine.play();
    }
  }, [state.isPlaying, state.currentSong]);

  const seek = useCallback((time: number) => audioEngine.seek(time), []);
  const next = useCallback(() => audioEngine.next(), []);
  const previous = useCallback(() => audioEngine.previous(), []);
  const setVolume = useCallback((vol: number) => audioEngine.setVolume(vol), []);
  const toggleMute = useCallback(() => audioEngine.toggleMute(), []);
  const toggleShuffle = useCallback(() => audioEngine.toggleShuffle(), []);
  const cycleRepeatMode = useCallback(() => audioEngine.cycleRepeatMode(), []);
  const addToQueue = useCallback((song: Song) => audioEngine.addToQueue(song), []);
  const playNext = useCallback((song: Song) => audioEngine.playNext(song), []);
  const reorderQueue = useCallback((start: number, end: number) => audioEngine.reorderQueue(start, end), []);
  const removeFromQueue = useCallback((idx: number) => audioEngine.removeFromQueue(idx), []);
  const clearQueue = useCallback(() => audioEngine.clearQueue(), []);
  const clearUpcoming = useCallback(() => audioEngine.clearUpcoming(), []);
  const clearUserQueue = useCallback(() => audioEngine.clearUserQueue(), []);
  const clearAutoplayQueue = useCallback(() => audioEngine.clearAutoplayQueue(), []);
  const setCrossfade = useCallback((seconds: number) => audioEngine.setCrossfade(seconds), []);
  const setAudioQuality = useCallback((quality: 'normal' | 'high' | 'lossless' | 'hires') => audioEngine.setAudioQuality(quality), []);

  return {
    ...state,
    playTrack,
    playQueueIndex,
    loadSuggestions,
    play,
    pause,
    togglePlay,
    seek,
    next,
    previous,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeatMode,
    addToQueue,
    playNext,
    reorderQueue,
    removeFromQueue,
    clearQueue,
    clearUpcoming,
    clearUserQueue,
    clearAutoplayQueue,
    setCrossfade,
    setAudioQuality,
  };
}
