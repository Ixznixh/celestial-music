import { useEffect, useState, useCallback, useRef } from 'react';
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

  const playTrack = useCallback((song: Song, contextQueue?: Song[]) => {
    if (!song) return;

    // 1. Lightweight HEAD request & cache-warmup strategy immediately upon track selection
    const cleanId = song.id.replace(/^(yt_liked_|yt_top_|yt_sync_)/, '').trim();
    const streamUrl = `/api/song/${encodeURIComponent(cleanId)}/audio?title=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artist || '')}&album=${encodeURIComponent(song.album || '')}`;
    try {
      fetch(streamUrl, {
        method: 'HEAD',
        headers: { 'X-Cache-Warmup': '1' },
      }).catch(() => {});
    } catch {}

    // 2. Unlock AudioContext and start background playback anchor
    backgroundAudioManager.unlockAudioContext().catch(() => {});
    backgroundAudioManager.startPlaybackAnchor(song);

    // 3. Initiate playback in audio engine
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
  const seekBackward = useCallback((seconds = 10) => audioEngine.seekBackward(seconds), []);
  const seekForward = useCallback((seconds = 10) => audioEngine.seekForward(seconds), []);
  const next = useCallback(() => audioEngine.next(), []);
  const previous = useCallback(() => audioEngine.previous(), []);
  const setVolume = useCallback((vol: number) => audioEngine.setVolume(vol), []);
  const toggleMute = useCallback(() => audioEngine.toggleMute(), []);
  const toggleShuffle = useCallback(() => audioEngine.toggleShuffle(), []);
  const cycleRepeatMode = useCallback(() => audioEngine.cycleRepeatMode(), []);
  const addToQueue = useCallback((song: Song) => audioEngine.addToQueue(song), []);
  const playNext = useCallback((song: Song) => audioEngine.playNext(song), []);
  const reorderQueue = useCallback((start: number, end: number) => audioEngine.reorderQueue(start, end), []);
  const setUpcomingTracks = useCallback((upcoming: Song[]) => audioEngine.setUpcomingTracks(upcoming), []);
  const removeFromQueue = useCallback((idx: number) => audioEngine.removeFromQueue(idx), []);
  const clearQueue = useCallback(() => audioEngine.clearQueue(), []);
  const clearUpcoming = useCallback(() => audioEngine.clearUpcoming(), []);
  const clearUserQueue = useCallback(() => audioEngine.clearUserQueue(), []);
  const clearAutoplayQueue = useCallback(() => audioEngine.clearAutoplayQueue(), []);
  const setCrossfade = useCallback((seconds: number) => audioEngine.setCrossfade(seconds), []);
  const setAudioQuality = useCallback((quality: 'normal' | 'high' | 'lossless' | 'hires') => audioEngine.setAudioQuality(quality), []);
  const updateSettings = useCallback((settings: any) => audioEngine.updateSettings(settings), []);

  // Synchronously update actionsRef on every render to ensure handlers always invoke latest methods & state
  const actionsRef = useRef({
    play,
    pause,
    togglePlay,
    next,
    previous,
    seek,
    seekBackward,
    seekForward,
    state,
  });

  actionsRef.current = {
    play,
    pause,
    togglePlay,
    next,
    previous,
    seek,
    seekBackward,
    seekForward,
    state,
  };

  // Permanent, stable Media Session Action Handlers Registration.
  // Handlers are bound to stable function references that delegate to actionsRef.current.
  // Handlers are NOT detached on re-renders or track transitions, ensuring Lock Screen and Control Center
  // buttons remain permanently responsive throughout the app lifecycle.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    const safeSetActionHandler = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {}
    };

    safeSetActionHandler('play', () => {
      console.info('[MediaSession OS Event] Received "play" command from OS');
      try {
        const { play: doPlay } = actionsRef.current;
        Promise.resolve(doPlay()).catch(() => {});
      } catch (err) {
        console.error('[MediaSession OS Event] Error executing play handler:', err);
      }
    });

    safeSetActionHandler('pause', () => {
      console.info('[MediaSession OS Event] Received "pause" command from OS');
      try {
        const { pause: doPause } = actionsRef.current;
        Promise.resolve(doPause()).catch(() => {});
      } catch (err) {
        console.error('[MediaSession OS Event] Error executing pause handler:', err);
      }
    });

    // Explicit binding for previoustrack - non-blocking return prevents OS command rejection
    safeSetActionHandler('previoustrack', () => {
      console.info('[MediaSession OS Event] Received "previoustrack" command from OS', {
        currentTrack: actionsRef.current.state.currentSong?.title,
        queueIndex: actionsRef.current.state.queueIndex,
      });
      try {
        const handler = actionsRef.current.previous;
        if (typeof handler === 'function') {
          Promise.resolve(handler()).catch(() => {});
        }
      } catch (err) {
        console.error('[MediaSession OS Event] Error executing previoustrack handler:', err);
      }
    });

    // Explicit binding for nexttrack - non-blocking return prevents OS command rejection
    safeSetActionHandler('nexttrack', () => {
      console.info('[MediaSession OS Event] Received "nexttrack" command from OS', {
        currentTrack: actionsRef.current.state.currentSong?.title,
        queueIndex: actionsRef.current.state.queueIndex,
      });
      try {
        const handler = actionsRef.current.next;
        if (typeof handler === 'function') {
          Promise.resolve(handler()).catch(() => {});
        }
      } catch (err) {
        console.error('[MediaSession OS Event] Error executing nexttrack handler:', err);
      }
    });

    // Explicitly unregister seekforward and seekbackward so OS Control Center (Windows / macOS / Android / iOS)
    // displays the standard music Skip/Next Track (>>|) and Rewind/Previous Track (|<<) buttons instead of 10s circular jump buttons
    safeSetActionHandler('seekforward', null);
    safeSetActionHandler('seekbackward', null);

    safeSetActionHandler('seekto', (details) => {
      console.info('[MediaSession OS Event] Received "seekto" command from OS', details);
      try {
        if (details.seekTime !== undefined && !isNaN(details.seekTime)) {
          const handler = actionsRef.current.seek;
          if (typeof handler === 'function') {
            Promise.resolve(handler(details.seekTime)).catch(() => {});
          }
        }
      } catch (err) {
        console.error('[MediaSession OS Event] Error executing seekto handler:', err);
      }
    });

    safeSetActionHandler('stop', () => {
      console.info('[MediaSession OS Event] Received "stop" command from OS');
      try {
        const { pause: doPause, seek: doSeek } = actionsRef.current;
        Promise.resolve(doPause()).catch(() => {});
        Promise.resolve(doSeek(0)).catch(() => {});
      } catch (err) {
        console.error('[MediaSession OS Event] Error executing stop handler:', err);
      }
    });
  }, []);

  // Update Media Session metadata whenever currentSong changes
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !state.currentSong) return;
    try {
      audioEngine.updateMediaSessionMetadata(state.currentSong);
    } catch {}
  }, [state.currentSong?.id]);

  // Keep OS MediaSession playbackState in sync with active React state
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = state.isPlaying ? 'playing' : 'paused';
    } catch {}
  }, [state.isPlaying]);

  // Keep OS Lock Screen position and duration in sync
  useEffect(() => {
    if (
      typeof navigator === 'undefined' ||
      !('mediaSession' in navigator) ||
      typeof navigator.mediaSession.setPositionState !== 'function' ||
      !state.duration ||
      state.duration <= 0
    ) {
      return;
    }

    try {
      navigator.mediaSession.setPositionState({
        duration: Math.max(1, state.duration),
        playbackRate: state.isPlaying ? 1.0 : 0,
        position: Math.min(Math.max(0, state.currentTime), state.duration),
      });
    } catch {}
  }, [state.currentTime, state.duration, state.isPlaying]);

  // Confirm buffer readiness via HTMLMediaElement 'canplaythrough' event
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const el = document.getElementById('audioPlayer') as HTMLAudioElement | null;
    if (!el) return;

    const handleCanPlayThrough = () => {
      console.info('[usePlayer] "canplaythrough" event confirmed: buffer readiness verified for uninterrupted playback');
      if (actionsRef.current.state.isBuffering) {
        actionsRef.current.play();
      }
    };

    const handleWaiting = () => {
      console.info('[usePlayer] Media element waiting for buffer data');
    };

    el.addEventListener('canplaythrough', handleCanPlayThrough);
    el.addEventListener('waiting', handleWaiting);

    return () => {
      el.removeEventListener('canplaythrough', handleCanPlayThrough);
      el.removeEventListener('waiting', handleWaiting);
    };
  }, []);

  // Proactive pre-buffering trigger: Initiates HTMLMediaElement.load() for the next song in the queue
  // 10 seconds before the current track completes, ensuring seamless zero-latency playback transitions
  const preloadedTrackRef = useRef<string | null>(null);

  useEffect(() => {
    if (!state.isPlaying || !state.duration || state.duration <= 0) return;

    const timeLeft = state.duration - state.currentTime;
    // Trigger proactive pre-buffering when within 10 seconds of track completion
    if (timeLeft <= 10 && timeLeft > 0.2) {
      const upcoming = (state.upcomingTracks && state.upcomingTracks.length > 0)
        ? state.upcomingTracks[0]
        : (state.queue && state.queueIndex >= 0 && state.queueIndex + 1 < state.queue.length)
          ? state.queue[state.queueIndex + 1]
          : null;

      if (upcoming && upcoming.id && preloadedTrackRef.current !== upcoming.id) {
        preloadedTrackRef.current = upcoming.id;
        const cleanId = upcoming.id.replace(/^(yt_liked_|yt_top_|yt_sync_)/, '').trim();
        const nextUrl = upcoming.streamUrl && upcoming.streamUrl.startsWith('http')
          ? upcoming.streamUrl
          : `/api/song/${encodeURIComponent(cleanId)}/audio?title=${encodeURIComponent(upcoming.title || '')}&artist=${encodeURIComponent(upcoming.artist || '')}&album=${encodeURIComponent(upcoming.album || '')}`;

        console.info(`[Proactive Pre-Buffering] 10s countdown triggered for next track "${upcoming.title}" (${timeLeft.toFixed(1)}s remaining)`);

        // 1. Proactive HTMLMediaElement.load() on auxiliary preloader element
        try {
          if (typeof document !== 'undefined') {
            let preloader = document.getElementById('audio-preloader-element') as HTMLAudioElement | null;
            if (!preloader) {
              preloader = document.createElement('audio');
              preloader.id = 'audio-preloader-element';
              preloader.preload = 'auto';
              preloader.style.display = 'none';
              document.body.appendChild(preloader);
            }
            preloader.preload = 'auto';
            if (preloader.src !== nextUrl) {
              preloader.src = nextUrl;
              preloader.load();
            }
          }
        } catch (err) {
          console.warn('[Proactive Pre-Buffering] Preloader element error:', err);
        }

        // 2. Prewarm audio engine and pre-buffer initial MediaSource chunk
        audioEngine.preloadNextTrack();
      }
    } else if (timeLeft > 12) {
      preloadedTrackRef.current = null;
    }
  }, [state.currentTime, state.duration, state.isPlaying, state.upcomingTracks, state.queue, state.queueIndex]);

  // Web Audio look-ahead buffer for the subsequent track in the queue
  // Pre-fetches the initial audio segment directly into the AudioEngine segment cache for 0-latency playback transitions
  useEffect(() => {
    // 1. Explicitly ensure HTMLMediaElement preload attribute is set to 'auto'
    if (typeof document !== 'undefined') {
      const el = document.getElementById('audioPlayer') as HTMLAudioElement | null;
      if (el && el.preload !== 'auto') {
        el.preload = 'auto';
      }
    }

    // 2. Pre-buffer upcoming track stream segment
    if (!state.isPlaying || !state.currentSong) return;

    const upcoming = (state.upcomingTracks && state.upcomingTracks.length > 0)
      ? state.upcomingTracks[0]
      : (state.queue && state.queueIndex >= 0 && state.queueIndex + 1 < state.queue.length)
        ? state.queue[state.queueIndex + 1]
        : null;

    if (!upcoming || !upcoming.id || upcoming.id === state.currentSong.id) return;

    const cleanId = upcoming.id.replace(/^(yt_liked_|yt_top_|yt_sync_)/, '').trim();
    if (audioEngine.getPrebufferedSegment(cleanId)) return;

    const upcomingStreamUrl = (upcoming.streamUrl && upcoming.streamUrl.startsWith('http'))
      ? upcoming.streamUrl
      : `/api/song/${encodeURIComponent(cleanId)}/audio?title=${encodeURIComponent(upcoming.title || '')}&artist=${encodeURIComponent(upcoming.artist || '')}&album=${encodeURIComponent(upcoming.album || '')}`;

    let isCancelled = false;

    // Fetch initial segment (~512KB) and prime memory cache
    fetch(upcomingStreamUrl, {
      headers: { Range: 'bytes=0-524287' },
    })
      .then(async (res) => {
        if (isCancelled) return;
        if (res.ok || res.status === 206) {
          const rawBuffer = await res.arrayBuffer();
          if (isCancelled || !rawBuffer || rawBuffer.byteLength === 0) return;

          // Store in AudioEngine's pre-buffered segment cache for instant transition
          audioEngine.setPrebufferedSegment(cleanId, rawBuffer);
          audioEngine.setPrebufferedSegment(upcoming.id, rawBuffer);
          console.info(`[Look-Ahead Buffer] Cached ${(rawBuffer.byteLength / 1024).toFixed(0)}KB initial stream segment for "${upcoming.title}"`);
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [state.currentSong?.id, state.isPlaying, state.upcomingTracks, state.queue, state.queueIndex]);

  return {
    ...state,
    playTrack,
    playQueueIndex,
    loadSuggestions,
    play,
    pause,
    togglePlay,
    seek,
    seekBackward,
    seekForward,
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
    updateSettings,
  };
}
