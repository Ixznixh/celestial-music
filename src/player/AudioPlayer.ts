/**
 * AudioPlayer.ts
 * 
 * Production Music Streaming Engine
 * Combines Spotify Web Persistent Audio Architecture with YouTube Music Playback:
 * 
 * 1. Persistent HTML5 <audio> Element:
 *    - Mounted directly in the DOM (id="audioPlayer", preload="auto", playsinline, crossorigin="anonymous")
 *    - Unlocked on initial user tap (required on iOS WebKit & Android Chrome)
 *    - Maintains system-level AVAudioSessionCategoryPlayback & Audio Focus
 * 2. Real Music Audio Playback via Embedded YouTube Player:
 *    - Seamlessly loads and plays original tracks with zero API key dependencies
 *    - High-fidelity audio, synchronized volume, and seamless seek controls
 * 3. Full Media Session API (Decoded Spotify Web Implementation):
 *    - Lock screen, Control Center, and notification shade controls (Play, Pause, Next, Previous, Seek)
 *    - Multi-resolution artwork (96x96 up to 1280x720)
 *    - Accurate setPositionState synchronized with playback time
 * 4. Resilient Background & Lock-Screen Continuity:
 *    - NEVER pauses on document.visibilitychange
 *    - Event-driven progress tracking (timeupdate) resistant to background timer throttling
 *    - Auto-advances queue in background on 'ended' event
 *    - Server-side prewarming for zero-latency gapless transitions
 */

import { Song, PlaybackState, RepeatMode, AppSettings } from '../types';
import { QueueManager } from './QueueManager';
import { db, isDemoItem } from '../services/indexedDB';
import { extractYouTubeVideoId, parseDurationInSeconds } from '../utils/formatters';
import { diagnostics } from './PlaybackDiagnostics';
import { backgroundAudioManager } from './BackgroundAudioManager';
import { audioGraph, isIOS } from './AudioGraph';

const STORAGE_STATE_KEY = 'celestial_player_playback_state';
const SILENT_AUDIO_DATA_URI =
  'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA==';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

export class AudioPlayer {
  private audio: HTMLAudioElement;
  private queueManager: QueueManager;
  private listeners: Set<(state: PlaybackState) => void> = new Set();

  // YouTube Engine
  private ytPlayer: any = null;
  private isYTReady = false;
  private isYTActive = false;
  private pendingSong: Song | null = null;
  private pendingStartTime: number = 0;

  // Background audio & progress
  private timeUpdateInterval: number | null = null;
  private isFetchingSuggestions = false;
  private lastSuggestedSongId: string | null = null;
  private crossfadeDuration: number = 0;
  private currentQuality: 'normal' | 'high' | 'lossless' | 'hires' = 'lossless';
  private playbackSessionId = 0;
  private intendedPlayState = false;
  private lastPersistTime = 0;
  private prewarmedSongId: string | null = null;
  private isSeeking = false;
  private seekDebounceTimer: any = null;
  private streamUrlCache = new Map<string, string>();
  private preloaderAudio: HTMLAudioElement | null = null;
  private lowPowerMode = false;

  private state: PlaybackState = {
    currentSong: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.85,
    isMuted: false,
    isBuffering: false,
    isLoadingSuggestions: false,
    queue: [],
    queueIndex: -1,
    userQueue: [],
    suggestionsQueue: [],
    shuffle: false,
    repeat: 'off',
    error: null,
  };

  constructor() {
    this.queueManager = new QueueManager();

    // 1. Grab or initialize the single persistent HTMLAudioElement
    this.audio = this.initPersistentAudio();
    diagnostics.registerAudioElement(this.audio);
    try {
      audioGraph.init(this.audio);
    } catch {}

    // 2. Setup native event listeners on persistent audio element
    this.setupAudioListeners();

    // 3. Setup YouTube Player in hidden persistent container
    this.setupYouTubePlayer();

    // 4. Setup Media Session API (Lock screen, Control Center, Android notification)
    this.setupMediaSession();

    // 5. Setup Visibility Continuity (Ensure playback never stops on minimize/lock)
    this.setupVisibilityHandler();

    // 6. Start time tracker
    this.startTimeTracker();

    // 7. Restore previous state
    this.restoreSession();
  }

  /**
   * Initializes or attaches to the persistent <audio id="audioPlayer"> element.
   * On iOS Safari and Android Chrome, keeping a single DOM-mounted audio element
   * ensures the authorized audio session remains permanently active when the
   * screen is locked or the browser is minimized.
   */
  private initPersistentAudio(): HTMLAudioElement {
    let el: HTMLAudioElement | null = null;
    if (typeof document !== 'undefined') {
      el = document.getElementById('audioPlayer') as HTMLAudioElement | null;
      if (!el) {
        el = document.createElement('audio');
        el.id = 'audioPlayer';
        el.style.position = 'fixed';
        el.style.top = '-9999px';
        el.style.left = '-9999px';
        el.style.width = '1px';
        el.style.height = '1px';
        el.style.opacity = '0.001';
        el.style.pointerEvents = 'none';
        if (document.body) {
          document.body.appendChild(el);
        } else {
          window.addEventListener('DOMContentLoaded', () => {
            if (el && !document.body.contains(el)) {
              document.body.appendChild(el);
            }
          }, { once: true });
        }
      }
    } else {
      el = new Audio();
    }

    el.preload = 'auto';
    if (!isIOS()) {
      el.crossOrigin = 'anonymous';
    }
    el.setAttribute('playsinline', 'true');
    el.setAttribute('webkit-playsinline', 'true');
    el.setAttribute('x5-playsinline', 'true');

    return el;
  }

  /**
   * Setup YouTube Iframe Player
   */
  private setupYouTubePlayer(): void {
    if (typeof window === 'undefined') return;

    const initContainer = () => {
      let container = document.getElementById('yt-player-target');
      if (!container) {
        container = document.createElement('div');
        container.id = 'yt-player-target';
        container.style.position = 'fixed';
        container.style.bottom = '0px';
        container.style.right = '0px';
        container.style.width = '200px';
        container.style.height = '200px';
        container.style.opacity = '0.01';
        container.style.pointerEvents = 'none';
        container.style.zIndex = '-1';
        document.body.appendChild(container);
      }
      this.instantiateYTPlayer();
    };

    if (window.YT && window.YT.Player) {
      if (document.body) {
        initContainer();
      } else {
        window.addEventListener('DOMContentLoaded', initContainer);
      }
    } else {
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof prevCallback === 'function') prevCallback();
        initContainer();
      };

      const pollInterval = window.setInterval(() => {
        if (window.YT && window.YT.Player) {
          window.clearInterval(pollInterval);
          initContainer();
        }
      }, 150);
      window.setTimeout(() => window.clearInterval(pollInterval), 15000);

      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.async = true;
        document.head.appendChild(tag);
      }
    }
  }

  private instantiateYTPlayer(): void {
    if (typeof window === 'undefined' || !window.YT || !window.YT.Player) return;
    if (this.ytPlayer) return;

    try {
      this.ytPlayer = new window.YT.Player('yt-player-target', {
        height: '200',
        width: '200',
        host: 'https://www.youtube-nocookie.com',
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          enablejsapi: 1,
          iv_load_policy: 3,
          origin: typeof window !== 'undefined' ? window.location.origin : '',
          widget_referrer: typeof window !== 'undefined' ? window.location.href : '',
        },
        events: {
          onReady: () => {
            this.isYTReady = true;
            if (this.ytPlayer && typeof this.ytPlayer.setVolume === 'function') {
              this.ytPlayer.setVolume(Math.round(this.state.volume * 100));
              if (this.state.isMuted) {
                this.ytPlayer.mute();
              } else if (typeof this.ytPlayer.unMute === 'function') {
                this.ytPlayer.unMute();
              }
            }
            if (this.pendingSong) {
              const song = this.pendingSong;
              const startSec = this.pendingStartTime || 0;
              this.pendingSong = null;
              this.pendingStartTime = 0;
              const cleanId = extractYouTubeVideoId(song.id) || song.id.replace(/^(yt_liked_|yt_top_|yt_sync_)/, '').trim();
              this.playViaYouTube(cleanId, startSec, this.playbackSessionId);
            }
          },
          onStateChange: (event: any) => {
            // YT.PlayerState: UNSTARTED (-1), ENDED (0), PLAYING (1), PAUSED (2), BUFFERING (3), CUED (5)
            const stateVal = event.data;
            if (stateVal === 1) {
              this.state.isPlaying = true;
              this.state.isBuffering = false;
              this.state.error = null;
              const dur = this.ytPlayer.getDuration();
              if (dur && dur > 0) {
                this.state.duration = dur;
              }
              if (this.state.currentSong) {
                this.updateMediaSessionMetadata(this.state.currentSong);
              }
              this.updateMediaSessionPlaybackState('playing');
              this.notify();
            } else if (stateVal === 5 || stateVal === -1) {
              if (this.intendedPlayState && this.ytPlayer && typeof this.ytPlayer.playVideo === 'function') {
                try { this.ytPlayer.playVideo(); } catch {}
              }
            } else if (stateVal === 2) {
              if (this.intendedPlayState) {
                // If tab is minimized or screen locked, keep playing state in MediaSession
                if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
                  this.state.isPlaying = true;
                  this.updateMediaSessionPlaybackState('playing');
                } else if (this.ytPlayer && typeof this.ytPlayer.playVideo === 'function') {
                  try { this.ytPlayer.playVideo(); } catch {}
                }
              } else {
                this.state.isPlaying = false;
                this.updateMediaSessionPlaybackState('paused');
                this.notify();
              }
            } else if (stateVal === 3) {
              this.state.isBuffering = true;
              this.notify();
            } else if (stateVal === 0) {
              this.handleTrackEnded();
            }
          },
          onError: async (event: any) => {
            const errCode = event?.data || event;
            console.warn('[YouTube Player] Playback error notice:', errCode);
            if (!this.isYTActive || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) {
              return;
            }

            // Auto-heal error 150/101 (embedding restricted by author) or 100/2/5
            if (this.state.currentSong && (errCode === 150 || errCode === 101 || errCode === 100 || errCode === 2 || errCode === 5)) {
              const currentId = extractYouTubeVideoId(this.state.currentSong.id) || this.state.currentSong.id;
              try {
                const res = await fetch(
                  `/api/song/alternative-yt?title=${encodeURIComponent(this.state.currentSong.title)}&artist=${encodeURIComponent(
                    this.state.currentSong.artist || ''
                  )}&excludeId=${encodeURIComponent(currentId)}`
                );
                if (res.ok) {
                  const data = await res.json();
                  if (data?.success && data.videoId && data.videoId !== currentId) {
                    console.info('[YouTube Player] Recovering with embeddable alternate track:', data.videoId);
                    this.playViaYouTube(data.videoId, this.state.currentTime, this.playbackSessionId);
                    return;
                  }
                }
              } catch (e) {
                console.warn('[YouTube Player] Auto-heal fetch error:', e);
              }
            }

            if (this.intendedPlayState) {
              this.next();
            }
          },
        },
      });
    } catch (e) {
      console.warn('[AudioPlayer] Failed to instantiate YT Player:', e);
    }
  }

  /**
   * Visibility Change Handler
   * CRITICAL: Spotify Web Rule: NEVER pause audio when document.hidden or visibility changes!
   * The OS keeps playing the audio stream. When returning to visible, we sync time & lock screen state.
   */
  private setupVisibilityHandler(): void {
    if (typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', () => {
      // Re-adjust time tracker frequency based on foreground vs background state in Low Power Mode
      if (this.lowPowerMode) {
        this.startTimeTracker();
      }

      if (document.visibilityState === 'hidden') {
        // Tab backgrounded or screen locked: maintain foreground media session lock
        if (this.intendedPlayState) {
          this.state.isPlaying = true;
          this.updateMediaSessionPlaybackState('playing');
          if (this.state.currentSong) {
            this.updateMediaSessionMetadata(this.state.currentSong);
          }
          this.updateMediaSessionPosition(true);

          // Ensure native audio element continues playing smoothly in background
          if (!this.isYTActive && this.audio && this.audio.paused) {
            this.audio.play().catch(() => {});
          }
          // Note: Never call ytPlayer.playVideo() while hidden - iOS WebKit terminates video iframes
        }
      } else if (document.visibilityState === 'visible') {
        // Tab brought to foreground: re-sync state & UI
        if (this.isYTActive && this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function') {
          try {
            const ytTime = this.ytPlayer.getCurrentTime();
            if (!isNaN(ytTime) && ytTime >= 0) {
              this.state.currentTime = ytTime;
            }
          } catch {}
        } else if (this.audio && !isNaN(this.audio.currentTime)) {
          this.state.currentTime = this.audio.currentTime;
          if (!isNaN(this.audio.duration) && this.audio.duration > 0) {
            this.state.duration = this.audio.duration;
          }
        }
        if (this.intendedPlayState) {
          this.state.isPlaying = true;
          this.updateMediaSessionPosition();
          this.updateMediaSessionPlaybackState('playing');
          if (this.ytPlayer && typeof this.ytPlayer.playVideo === 'function') {
            try { this.ytPlayer.playVideo(); } catch {}
          }
        }
        this.notify();
      }
    });
  }

  public setLowPowerMode(enabled: boolean): void {
    const changed = this.lowPowerMode !== enabled;
    this.lowPowerMode = enabled;
    backgroundAudioManager.setLowPowerMode(enabled);
    if (changed) {
      this.startTimeTracker();
      this.notify();
    }
  }

  public getLowPowerMode(): boolean {
    return this.lowPowerMode;
  }

  /**
   * Time tracker for progress bar and position state sync.
   * In Low Power Mode, the background polling frequency is significantly reduced (1000ms foreground,
   * 2000ms when hidden in the background) to eliminate CPU wakeups and preserve battery.
   */
  private startTimeTracker(): void {
    if (this.timeUpdateInterval) clearInterval(this.timeUpdateInterval);

    const isHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    const intervalMs = this.lowPowerMode ? (isHidden ? 2000 : 1000) : 250;

    this.timeUpdateInterval = window.setInterval(() => {
      if (this.state.isPlaying) {
        if (this.isSeeking || (this.audio && this.audio.seeking)) {
          return;
        }

        let curTime = 0;
        let dur = 0;

        if (this.isYTActive && this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function') {
          try {
            curTime = this.ytPlayer.getCurrentTime() || 0;
            dur = this.ytPlayer.getDuration() || this.state.duration;
          } catch {}
        } else if (!isNaN(this.audio.currentTime)) {
          curTime = this.audio.currentTime;
          dur = this.audio.duration;
        }

        if (typeof curTime === 'number' && !isNaN(curTime) && curTime >= 0) {
          const deltaThreshold = this.lowPowerMode ? 0.3 : 0.05;
          const hasTimeProgressed = Math.abs(curTime - this.state.currentTime) > deltaThreshold;
          this.state.currentTime = curTime;
          if (dur && dur > 0 && dur !== this.state.duration) {
            this.state.duration = dur;
          }
          if (hasTimeProgressed) {
            this.updateMediaSessionPosition();
            this.notify();
          }

          // Proactively prewarm next track before current song ends.
          // In Low Power Mode, delay prewarming until 10s before track end and suppress extra suggestion polling
          const prewarmThreshold = this.lowPowerMode ? 10 : 30;
          if (dur && dur > 0 && curTime > 0 && dur - curTime <= prewarmThreshold) {
            this.preloadNextTrack();
            if (!this.lowPowerMode) {
              const upcoming = this.queueManager.getUpcomingTracks();
              if (upcoming.length < 2 && this.state.currentSong && !this.isFetchingSuggestions) {
                this.loadSuggestions(this.state.currentSong.id, false);
              }
            }
          }
        }
      }
    }, intervalMs);
  }

  /**
   * Attach native media events to the persistent <audio> element.
   */
  private setupAudioListeners(): void {
    const el = this.audio;

    el.addEventListener('loadstart', () => {
      if (!this.isYTActive) {
        this.state.isBuffering = true;
        this.notify();
      }
    });

    el.addEventListener('loadedmetadata', () => {
      if (!this.isYTActive && !isNaN(el.duration) && el.duration > 0) {
        this.state.duration = el.duration;
        this.updateMediaSessionPosition();
        this.updateMediaSessionHandlers();
        this.notify();
      }
    });

    el.addEventListener('canplay', () => {
      if (!this.isYTActive) {
        this.state.isBuffering = false;
        this.updateMediaSessionHandlers();
        this.notify();
      }
    });

    el.addEventListener('seeking', () => {
      this.isSeeking = true;
    });

    el.addEventListener('seeked', () => {
      this.isSeeking = false;
      if (this.seekDebounceTimer) {
        clearTimeout(this.seekDebounceTimer);
        this.seekDebounceTimer = null;
      }
      if (!this.isYTActive && !isNaN(el.currentTime)) {
        this.state.currentTime = el.currentTime;
        this.updateMediaSessionPosition();
        this.notify();
      }
    });

    el.addEventListener('timeupdate', () => {
      if (!this.isYTActive && !this.isSeeking && !el.seeking && !isNaN(el.currentTime)) {
        this.state.currentTime = el.currentTime;
        this.updateMediaSessionPosition();
        this.notify();
      }
    });

    el.addEventListener('durationchange', () => {
      if (!this.isYTActive && !isNaN(el.duration) && el.duration > 0) {
        this.state.duration = el.duration;
        this.updateMediaSessionPosition(true);
        this.notify();
      }
    });

    el.addEventListener('ratechange', () => {
      this.updateMediaSessionPosition(true);
    });

    el.addEventListener('play', () => {
      this.state.isPlaying = true;
      this.state.isBuffering = false;
      this.state.error = null;
      this.updateMediaSessionPlaybackState('playing');
      this.updateMediaSessionPosition(true);
      this.updateMediaSessionHandlers();
      this.notify();
    });

    el.addEventListener('playing', () => {
      this.state.isPlaying = true;
      this.state.isBuffering = false;
      this.state.error = null;
      this.updateMediaSessionPlaybackState('playing');
      this.updateMediaSessionPosition(true);
      this.updateMediaSessionHandlers();
      this.notify();
    });

    el.addEventListener('pause', () => {
      if (!this.intendedPlayState) {
        this.state.isPlaying = false;
        this.updateMediaSessionPlaybackState('paused');
        this.updateMediaSessionPosition(true);
        this.updateMediaSessionHandlers();
        this.notify();
      }
    });

    el.addEventListener('ended', () => {
      if (!this.isYTActive) {
        this.handleTrackEnded();
      }
    });

    el.addEventListener('error', () => {
      if (!this.isYTActive && this.state.currentSong) {
        console.warn('[AudioPlayer] Native audio stream error, falling back to YouTube iframe');
        const cleanId =
          extractYouTubeVideoId(this.state.currentSong.id) ||
          this.state.currentSong.id.replace(/^(yt_liked_|yt_top_|yt_sync_)/, '').trim();
        this.playViaYouTube(cleanId, this.state.currentTime, this.playbackSessionId);
      }
    });
  }

  // --- State Access & Subscriptions ---

  public getState(): PlaybackState {
    return {
      ...this.state,
      queue: this.queueManager.getQueue(),
      queueIndex: this.queueManager.getQueueIndex(),
      userQueue: this.queueManager.getUserQueue(),
      suggestionsQueue: this.queueManager.getAutoplayQueue(),
      shuffle: this.queueManager.getShuffle(),
      repeat: this.queueManager.getRepeat(),
    };
  }

  public subscribe(listener: (state: PlaybackState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const currentState = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(currentState);
      } catch (err) {
        console.error('Error in AudioPlayer listener:', err);
      }
    });

    const now = Date.now();
    const persistInterval = this.lowPowerMode ? 15000 : 3000;
    if (now - this.lastPersistTime > persistInterval) {
      this.lastPersistTime = now;
      this.persistSession();
    }
  }

  // --- Core Playback Execution ---

  /**
   * Starts playback of a song using the persistent HTML5 <audio> element
   * synchronized with the YouTube audio engine for guaranteed background playback.
   */
  private async startPlayback(song: Song, startSeconds: number = 0): Promise<void> {
    const currentSession = ++this.playbackSessionId;
    this.intendedPlayState = true;

    // Instant UI state update
    this.state.currentSong = song;
    const parsedDur = parseDurationInSeconds(song.duration);
    this.state.duration = parsedDur > 0 ? parsedDur : 240;
    this.state.currentTime = startSeconds;
    this.state.error = null;
    this.state.isBuffering = true;
    this.state.isPlaying = true;
    this.notify();

    // 1. Update OS Media Session (Lock screen title, artist, artwork)
    this.updateMediaSessionMetadata(song);
    this.updateMediaSessionPlaybackState('playing');
    this.updateMediaSessionHandlers();

    // 2. Start background audio anchor (WakeLock & AudioContext unlock)
    backgroundAudioManager.startPlaybackAnchor(song);

    // 3. Cache recently played in IndexedDB
    db.addRecentlyPlayed(song).catch(() => {});
    const upcomingTracks = this.queueManager.getUpcomingTracks();
    const nextSong = upcomingTracks.length > 0 ? upcomingTracks[0] : null;
    db.cacheCurrentAndNextTrack(song, nextSong, this.queueManager.getQueue(), this.queueManager.getQueueIndex()).catch(() => {});

    const cleanId = extractYouTubeVideoId(song.id) || song.id.replace(/^(yt_liked_|yt_top_|yt_sync_)/, '').trim();

    // 4. Native High-Fidelity Audio Stream Execution:
    // Streaming directly through the persistent <audio id="audioPlayer"> element guarantees
    // 100% unbreakable background & lock-screen playback on iOS WebKit and Android Chrome.
    const isDirectBlob = song.streamUrl && (song.streamUrl.startsWith('blob:') || song.streamUrl.startsWith('data:') || song.streamUrl.startsWith('https://aac.saavncdn.com/'));
    const cachedUrl = this.streamUrlCache.get(cleanId);
    
    // Choose ultra-low-latency direct CDN stream url if available, or robust direct server proxy
    const audioStreamUrl = isDirectBlob
      ? song.streamUrl!
      : (cachedUrl || `/api/song/${encodeURIComponent(cleanId)}/audio?title=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artist || '')}&album=${encodeURIComponent(song.album || '')}`);

    this.isYTActive = false;
    this.audio.volume = this.state.isMuted ? 0 : this.state.volume;
    this.audio.loop = false;
    if (this.audio.src !== audioStreamUrl && !this.audio.src.endsWith(audioStreamUrl)) {
      this.audio.src = audioStreamUrl;
    }
    if (startSeconds > 0) {
      try { this.audio.currentTime = startSeconds; } catch {}
    }

    if (this.ytPlayer && typeof this.ytPlayer.pauseVideo === 'function') {
      try { this.ytPlayer.pauseVideo(); } catch {}
    }

    // CRITICAL iOS SAFARI RULE:
    // Execute audio.play() IMMEDIATELY and SYNCHRONOUSLY within the user gesture
    // (such as nexttrack, previoustrack, or play initiated from iOS Control Center / Lock Screen).
    // Waiting for an async fetch will drop the transient user gesture and trigger NotAllowedError on iOS!
    try {
      const audioPlayPromise = this.audio.play();
      if (audioPlayPromise !== undefined) {
        audioPlayPromise
          .then(() => {
            if (this.playbackSessionId === currentSession && this.intendedPlayState) {
              this.state.isBuffering = false;
              this.state.isPlaying = true;
              this.state.error = null;
              this.updateMediaSessionPlaybackState('playing');
              this.updateMediaSessionPosition(true);
              this.notify();
            }
          })
          .catch((err) => {
            if (err?.name !== 'AbortError' && !err?.message?.includes('interrupted')) {
              console.warn('[AudioPlayer] Audio play error, falling back to YouTube:', err);
              if (this.playbackSessionId === currentSession && !this.isYTActive) {
                this.playViaYouTube(cleanId, startSeconds, currentSession);
              }
            }
          });
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError' && !err?.message?.includes('interrupted')) {
        if (this.playbackSessionId === currentSession && !this.isYTActive) {
          this.playViaYouTube(cleanId, startSeconds, currentSession);
        }
      }
    }

    // In parallel, if not already cached, resolve 320k Saavn CDN in background to update cache
    if (!cachedUrl && !isDirectBlob) {
      fetch(
        `/api/song/resolve?id=${encodeURIComponent(cleanId)}&title=${encodeURIComponent(
          song.title
        )}&artist=${encodeURIComponent(song.artist || '')}&album=${encodeURIComponent(song.album || '')}`
      )
        .then((res) => res.json())
        .then((data) => {
          if (data?.hasDirectCdn && data.streamUrl && data.streamUrl.startsWith('http')) {
            this.streamUrlCache.set(cleanId, data.streamUrl);
            song.streamUrl = data.streamUrl;
          }
        })
        .catch(() => {});
    }

    // 6. Prewarm next track on the server for instant gapless playback
    this.preloadNextTrack();

    // 7. Keep upcoming recommendations populated (defer in Low Power Mode to save radio wakeups)
    if (!this.lowPowerMode && upcomingTracks.length < 3) {
      this.loadSuggestions(song.id, false);
    } else if (this.lowPowerMode && upcomingTracks.length === 0) {
      this.loadSuggestions(song.id, false);
    }
  }

  /**
   * Fallback playback via YouTube Iframe if native audio stream is unavailable
   */
  private playViaYouTube(cleanId: string, startSeconds: number = 0, currentSession: number = 0): void {
    this.isYTActive = true;

    // Silence native audio element to prevent conflicting sounds or error popups
    try {
      this.audio.pause();
      if (this.audio.src !== SILENT_AUDIO_DATA_URI) {
        this.audio.src = SILENT_AUDIO_DATA_URI;
      }
      this.audio.loop = true;
      this.audio.volume = 0.001;
      this.audio.play().catch(() => {});
    } catch {}

    if (!this.isYTReady || !this.ytPlayer) {
      if (this.state.currentSong) {
        this.pendingSong = this.state.currentSong;
        this.pendingStartTime = startSeconds;
      }
      this.setupYouTubePlayer();
      return;
    }

    try {
      if (typeof this.ytPlayer.loadVideoById === 'function') {
        this.ytPlayer.loadVideoById({
          videoId: cleanId,
          startSeconds: startSeconds || 0,
        });
      } else if (typeof this.ytPlayer.cueVideoById === 'function') {
        this.ytPlayer.cueVideoById({
          videoId: cleanId,
          startSeconds: startSeconds || 0,
        });
      }

      if (typeof this.ytPlayer.playVideo === 'function') {
        this.ytPlayer.playVideo();
      }

      if (typeof this.ytPlayer.setVolume === 'function') {
        this.ytPlayer.setVolume(this.state.isMuted ? 0 : Math.round(this.state.volume * 100));
        if (!this.state.isMuted && typeof this.ytPlayer.unMute === 'function') {
          this.ytPlayer.unMute();
        }
      }

      if (this.playbackSessionId === currentSession && this.intendedPlayState) {
        this.state.isBuffering = false;
        this.state.isPlaying = true;
        this.state.error = null;
        this.updateMediaSessionPlaybackState('playing');
        this.notify();
      }
    } catch (err: any) {
      console.warn('[AudioPlayer] YouTube playback fallback notice:', err?.message || err);
    }
  }

  /**
   * Prewarms the next upcoming track on the backend and pre-buffers it for 0-latency playback.
   */
  public preloadNextTrack(): void {
    const upcoming = this.queueManager.getUpcomingTracks();
    const nextTrack = upcoming.length > 0 ? upcoming[0] : null;
    if (!nextTrack) return;

    const cleanId = nextTrack.id.replace(/^(yt_liked_|yt_top_|yt_sync_)/, '').trim();
    if (this.prewarmedSongId === cleanId && this.streamUrlCache.has(cleanId)) return;

    this.prewarmedSongId = cleanId;

    try {
      fetch(
        `/api/song/${encodeURIComponent(cleanId)}/prewarm?title=${encodeURIComponent(
          nextTrack.title || ''
        )}&artist=${encodeURIComponent(nextTrack.artist || '')}&album=${encodeURIComponent(nextTrack.album || '')}`
      )
        .then((res) => res.json())
        .then((data) => {
          if (data?.streamUrl && typeof data.streamUrl === 'string' && data.streamUrl.startsWith('http')) {
            this.streamUrlCache.set(cleanId, data.streamUrl);
            nextTrack.streamUrl = data.streamUrl;
            if (!isIOS()) {
              if (!this.preloaderAudio) {
                this.preloaderAudio = new Audio();
              }
              this.preloaderAudio.preload = 'auto';
              this.preloaderAudio.src = data.streamUrl;
            }
          }
        })
        .catch(() => {});
    } catch {}

    // Pre-resolve the 2nd upcoming track in background for seamless binge-listening (suppressed in Low Power Mode)
    if (!this.lowPowerMode && upcoming.length > 1) {
      const secondTrack = upcoming[1];
      const secondCleanId = secondTrack.id.replace(/^(yt_liked_|yt_top_|yt_sync_)/, '').trim();
      if (!this.streamUrlCache.has(secondCleanId)) {
        try {
          fetch(
            `/api/song/resolve?id=${encodeURIComponent(secondCleanId)}&title=${encodeURIComponent(
              secondTrack.title || ''
            )}&artist=${encodeURIComponent(secondTrack.artist || '')}&album=${encodeURIComponent(secondTrack.album || '')}`
          )
            .then((res) => res.json())
            .then((data) => {
              if (data?.streamUrl && typeof data.streamUrl === 'string' && data.streamUrl.startsWith('http')) {
                this.streamUrlCache.set(secondCleanId, data.streamUrl);
                secondTrack.streamUrl = data.streamUrl;
              }
            })
            .catch(() => {});
        } catch {}
      }
    }
  }

  public async playTrack(song: Song, contextQueue?: Song[]): Promise<void> {
    if (!song) return;

    // Immediately unlock audio context and wake lock on user touch/click
    backgroundAudioManager.unlockAudioContext().catch(() => {});
    backgroundAudioManager.requestWakeLock().catch(() => {});

    if (contextQueue && contextQueue.length > 0) {
      const idx = contextQueue.findIndex((s) => s.id === song.id);
      this.queueManager.setQueue(contextQueue, idx !== -1 ? idx : 0);
    } else {
      this.queueManager.setQueue([song], 0);
    }

    await this.startPlayback(song, 0);
  }

  public async playQueueIndex(index: number): Promise<void> {
    const song = this.queueManager.setQueueIndex(index);
    if (!song) return;

    await this.startPlayback(song, 0);
  }

  public async loadSuggestions(songId?: string, force: boolean = false): Promise<void> {
    const targetId = songId || this.state.currentSong?.id;
    if (!targetId || this.isFetchingSuggestions) return;

    this.isFetchingSuggestions = true;
    this.lastSuggestedSongId = targetId;
    this.state.isLoadingSuggestions = true;
    this.notify();

    try {
      const res = await fetch(`/api/queue/${targetId}?_t=${Date.now()}`);
      if (!res.ok) return;
      const data = await res.json();
      const suggestions: Song[] = data.queue || [];

      if (Array.isArray(suggestions) && suggestions.length > 0) {
        const filtered = suggestions.filter((s) => s.id !== targetId);

        if (force) {
          this.queueManager.setAutoplayQueue(filtered);
        } else {
          const upcoming = this.queueManager.getUpcomingTracks();
          if (upcoming.length === 0) {
            this.queueManager.setAutoplayQueue(filtered);
          } else {
            this.queueManager.appendSongs(filtered);
          }
        }
        this.preloadNextTrack();
      }
    } catch (err) {
      console.warn('[AudioPlayer] Failed to load suggestions:', err);
    } finally {
      this.isFetchingSuggestions = false;
      this.state.isLoadingSuggestions = false;
      this.notify();
    }
  }

  public async play(): Promise<void> {
    const song = this.state.currentSong || this.queueManager.getCurrentSong() || this.queueManager.getQueue()[0];
    if (!song) return;

    backgroundAudioManager.startPlaybackAnchor(song);
    this.intendedPlayState = true;

    if (!this.isYTActive && this.audio) {
      this.audio.volume = this.state.isMuted ? 0 : this.state.volume;
      try {
        await this.audio.play();
      } catch (err: any) {
        if (err?.name !== 'AbortError' && !err?.message?.includes('interrupted')) {
          const cleanId = extractYouTubeVideoId(song.id) || song.id.replace(/^(yt_liked_|yt_top_|yt_sync_)/, '').trim();
          this.playViaYouTube(cleanId, this.state.currentTime, this.playbackSessionId);
        }
      }
    } else if (this.isYTActive && this.ytPlayer && typeof this.ytPlayer.playVideo === 'function') {
      try {
        this.ytPlayer.playVideo();
      } catch (e) {
        console.warn('YT playVideo error:', e);
      }
    }

    this.state.isPlaying = true;
    this.state.isBuffering = false;
    this.updateMediaSessionMetadata(song);
    this.updateMediaSessionPlaybackState('playing');
    this.updateMediaSessionPosition(true);
    this.updateMediaSessionHandlers();
    this.notify();
  }

  public pause(callerDescription = 'User interaction / UI control'): void {
    this.playbackSessionId++;
    this.intendedPlayState = false;
    diagnostics.recordExplicitPause(callerDescription);
    backgroundAudioManager.stopPlaybackAnchor();

    if (this.ytPlayer && typeof this.ytPlayer.pauseVideo === 'function') {
      try {
        this.ytPlayer.pauseVideo();
      } catch {}
    }

    if (this.audio) {
      try {
        this.audio.pause();
      } catch {}
    }

    this.state.isPlaying = false;
    this.state.isBuffering = false;
    this.updateMediaSessionPlaybackState('paused');
    this.updateMediaSessionPosition(true);
    this.updateMediaSessionHandlers();
    this.notify();
  }

  public togglePlay(): void {
    if (this.state.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  public seek(seconds: number): void {
    const target = Math.max(0, Math.min(seconds, this.state.duration || seconds));
    this.isSeeking = true;
    this.state.currentTime = target;

    if (this.seekDebounceTimer) {
      clearTimeout(this.seekDebounceTimer);
    }
    this.seekDebounceTimer = setTimeout(() => {
      this.isSeeking = false;
    }, 1000);

    if (this.isYTActive && this.ytPlayer && typeof this.ytPlayer.seekTo === 'function') {
      try {
        this.ytPlayer.seekTo(target, true);
      } catch (e) {
        console.warn('YT seekTo error:', e);
      }
    }

    if (this.audio) {
      try {
        if (typeof (this.audio as any).fastSeek === 'function') {
          (this.audio as any).fastSeek(target);
        } else {
          this.audio.currentTime = target;
        }
      } catch {}
    }

    this.updateMediaSessionPosition(true);
    this.notify();
  }

  public seekTo(seconds: number): void {
    this.seek(seconds);
  }

  /**
   * Plays the next track in the queue/playlist.
   * Centralized method used by both in-app controls and MediaSession lock-screen controls.
   */
  public async playNextTrack(): Promise<void> {
    const nextSong = this.queueManager.next();
    if (nextSong) {
      await this.startPlayback(nextSong, 0);
    } else {
      if (this.state.currentSong) {
        await this.loadSuggestions(this.state.currentSong.id, false);
        const retryNext = this.queueManager.next();
        if (retryNext) {
          await this.startPlayback(retryNext, 0);
          return;
        }
      }
      // If there is no next track, safely do nothing
    }
  }

  /**
   * Plays the previous track from history.
   * Centralized method used by both in-app controls and MediaSession lock-screen controls.
   */
  public async playPreviousTrack(): Promise<void> {
    const prevSong = this.queueManager.previous();
    if (prevSong) {
      await this.startPlayback(prevSong, 0);
    } else {
      // If there is no previous track, safely do nothing
    }
  }

  public async next(): Promise<void> {
    return this.playNextTrack();
  }

  public async previous(): Promise<void> {
    return this.playPreviousTrack();
  }

  private handleTrackEnded(): void {
    if (this.queueManager.getRepeat() === 'one') {
      this.seek(0);
      this.play();
    } else {
      this.playNextTrack();
    }
  }

  // --- Volume & Quality Controls ---

  public setVolume(volume: number): void {
    const safeVol = Math.max(0, Math.min(volume, 1));
    this.state.volume = safeVol;
    this.audio.volume = this.state.isMuted ? 0 : safeVol;

    if (this.ytPlayer && this.isYTReady && typeof this.ytPlayer.setVolume === 'function') {
      try {
        this.ytPlayer.setVolume(this.state.isMuted ? 0 : Math.round(safeVol * 100));
      } catch {}
    }

    this.notify();
  }

  public toggleMute(): void {
    this.state.isMuted = !this.state.isMuted;
    this.audio.volume = this.state.isMuted ? 0 : this.state.volume;

    if (this.ytPlayer && this.isYTReady) {
      try {
        if (this.state.isMuted) {
          this.ytPlayer.mute();
        } else {
          this.ytPlayer.unMute();
          this.ytPlayer.setVolume(Math.round(this.state.volume * 100));
        }
      } catch {}
    }

    this.notify();
  }

  public setCrossfade(seconds: number): void {
    this.crossfadeDuration = Math.max(0, seconds);
  }

  public getCrossfade(): number {
    return this.crossfadeDuration;
  }

  public setAudioQuality(quality: 'normal' | 'high' | 'lossless' | 'hires'): void {
    this.currentQuality = quality;
    if (this.isYTActive && this.ytPlayer && this.isYTReady) {
      try {
        const qualityMap: Record<string, string> = {
          hires: 'highres',
          lossless: 'hd1440',
          high: 'hd720',
          normal: 'medium',
        };
        const targetQ = qualityMap[quality] || 'highres';
        if (typeof this.ytPlayer.setPlaybackQuality === 'function') {
          this.ytPlayer.setPlaybackQuality(targetQ);
        }
      } catch {}
    }
    this.notify();
  }

  public getAudioQuality(): 'normal' | 'high' | 'lossless' | 'hires' {
    return this.currentQuality;
  }

  // --- Queue Actions ---

  public toggleShuffle(): void {
    this.queueManager.toggleShuffle();
    this.notify();
  }

  public cycleRepeatMode(): void {
    this.queueManager.cycleRepeat();
    this.notify();
  }

  public setRepeat(mode: RepeatMode): void {
    this.queueManager.setRepeat(mode);
    this.notify();
  }

  public addToQueue(song: Song): void {
    this.queueManager.addToQueue(song);
    this.preloadNextTrack();
    this.notify();
  }

  public playNext(song: Song): void {
    this.queueManager.playNext(song);
    this.prewarmedSongId = null;
    this.preloadNextTrack();
    this.notify();
  }

  public reorderQueue(startIndex: number, endIndex: number): void {
    this.queueManager.reorderQueue(startIndex, endIndex);
    this.preloadNextTrack();
    this.notify();
  }

  public setUpcomingTracks(upcoming: Song[]): void {
    this.queueManager.setUpcomingTracks(upcoming);
    this.preloadNextTrack();
    this.notify();
  }

  public removeFromQueue(index: number): void {
    const newCurrent = this.queueManager.removeFromQueue(index);
    if (newCurrent && newCurrent.id !== this.state.currentSong?.id) {
      this.playTrack(newCurrent);
    } else {
      this.notify();
    }
  }

  public clearQueue(): void {
    this.queueManager.clearQueue();
    this.notify();
  }

  public clearUpcoming(): void {
    this.queueManager.clearUpcoming();
    this.notify();
  }

  public clearUserQueue(): void {
    this.queueManager.clearUserQueue();
    this.notify();
  }

  public updateSettings(settings: AppSettings): void {
    if (!settings) return;
    try {
      audioGraph.applySettings(settings);
    } catch {}
    if (typeof settings.crossfade === 'number') {
      this.crossfadeDuration = settings.crossfade;
    }
    if (settings.audioQuality) {
      this.currentQuality = settings.audioQuality;
    }
    if (typeof settings.lowPowerMode === 'boolean') {
      this.setLowPowerMode(settings.lowPowerMode);
    }
  }

  public clearAutoplayQueue(): void {
    this.queueManager.clearAutoplayQueue();
    this.notify();
  }

  // --- Media Session API (Decoded Spotify Web Implementation) ---

  /**
   * Registers media session action handlers when a track is loaded/ready.
   * Registers:
   * - 'previoustrack': calls playPreviousTrack()
   * - 'nexttrack': calls playNextTrack()
   * - 'play': resumes audio
   * - 'pause': pauses audio
   * - 'stop': stops audio
   * Strictly avoids registering 'seekbackward' and 'seekforward' so iOS Lock Screen
   * and Control Center prioritize PREVIOUS TRACK and NEXT TRACK controls instead of 10s skip buttons.
   */
  public updateMediaSessionHandlers(): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    const safeSetActionHandler = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Safe fallback for unsupported action handlers
      }
    };

    // 1. Core playback controls
    safeSetActionHandler('play', () => {
      this.intendedPlayState = true;
      backgroundAudioManager.startPlaybackAnchor(this.state.currentSong);
      this.play();
    });

    safeSetActionHandler('pause', () => {
      this.intendedPlayState = false;
      backgroundAudioManager.stopPlaybackAnchor();
      this.pause('MediaSession lockscreen action');
    });

    safeSetActionHandler('stop', () => {
      this.pause();
      this.seek(0);
      this.updateMediaSessionPlaybackState('none');
    });

    // 2. Previous Track & Next Track (Connected to existing queue/playlist logic)
    safeSetActionHandler('previoustrack', () => {
      this.playPreviousTrack();
    });

    safeSetActionHandler('nexttrack', () => {
      this.playNextTrack();
    });

    // 3. Register 'seekto' handler for iOS Lock Screen / Control Center progress bar scrubbing
    safeSetActionHandler('seekto', (details: any) => {
      const audio = this.audio;
      if (!audio || !Number.isFinite(audio.duration)) {
        if (details && typeof details.seekTime === 'number' && Number.isFinite(details.seekTime)) {
          this.seek(details.seekTime);
        }
        return;
      }

      if (details && typeof details.seekTime === 'number' && Number.isFinite(details.seekTime)) {
        if (details.fastSeek && 'fastSeek' in audio && typeof (audio as any).fastSeek === 'function') {
          try {
            (audio as any).fastSeek(details.seekTime);
          } catch {
            audio.currentTime = details.seekTime;
          }
        } else {
          audio.currentTime = details.seekTime;
        }
        this.state.currentTime = audio.currentTime;
        this.updateMediaSessionPosition(true);
        this.notify();
      }
    });

    // 4. Strictly remove / disable seekbackward and seekforward handlers so iOS Lock Screen and Control Center
    // do not prioritize or display 10-second rewind/forward buttons
    safeSetActionHandler('seekbackward', null);
    safeSetActionHandler('seekforward', null);
  }

  private setupMediaSession(): void {
    this.updateMediaSessionHandlers();
  }

  public updateMediaSessionMetadata(song: Song | null): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !song) return;

    try {
      const isYtId = song.id && song.id.length === 11 && !song.id.includes(' ');
      const rawArt =
        song.artwork ||
        song.artworkUrl ||
        (isYtId ? `https://i.ytimg.com/vi/${song.id}/hqdefault.jpg` : '/pwa-512x512.png');

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
          { src: `https://i.ytimg.com/vi/${song.id}/maxresdefault.jpg`, sizes: '1280x720', type: 'image/jpeg' },
          { src: `https://i.ytimg.com/vi/${song.id}/sddefault.jpg`, sizes: '640x480', type: 'image/jpeg' },
          { src: `https://i.ytimg.com/vi/${song.id}/hqdefault.jpg`, sizes: '480x360', type: 'image/jpeg' }
        );
      }

      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title || 'Unknown Track',
        artist: song.artist || (song as any).artists || 'Celestial Music',
        album: song.album || 'Celestial Music',
        artwork: artworkList,
      });

      this.updateMediaSessionPosition(true);
      this.updateMediaSessionHandlers();
    } catch (err) {
      console.warn('[AudioPlayer] Failed to set MediaSession metadata:', err);
    }
  }

  public updateMediaSessionPlaybackState(state: 'none' | 'paused' | 'playing'): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = state;
    } catch {}
  }

  private lastPositionUpdate = 0;

  public updateMediaSessionPosition(force = false): void {
    if (
      typeof navigator === 'undefined' ||
      !('mediaSession' in navigator) ||
      typeof navigator.mediaSession.setPositionState !== 'function'
    ) {
      return;
    }

    const now = Date.now();
    const throttleMs = this.lowPowerMode ? 4000 : 1000;
    // Throttle high-frequency position updates to prevent flooding WebKit IPC (longer in Low Power Mode)
    if (!force && now - this.lastPositionUpdate < throttleMs) {
      return;
    }
    this.lastPositionUpdate = now;

    try {
      const audio = this.audio;
      let dur = audio && Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : this.state.duration;
      let pos = audio && Number.isFinite(audio.currentTime) && audio.currentTime >= 0 ? audio.currentTime : this.state.currentTime;
      let rate = audio && Number.isFinite(audio.playbackRate) && audio.playbackRate > 0 ? audio.playbackRate : 1;

      if (this.isYTActive && this.ytPlayer) {
        if (typeof this.ytPlayer.getDuration === 'function') {
          const ytDur = this.ytPlayer.getDuration();
          if (Number.isFinite(ytDur) && ytDur > 0) dur = ytDur;
        }
        if (typeof this.ytPlayer.getCurrentTime === 'function') {
          const ytPos = this.ytPlayer.getCurrentTime();
          if (Number.isFinite(ytPos) && ytPos >= 0) pos = ytPos;
        }
        if (typeof this.ytPlayer.getPlaybackRate === 'function') {
          const ytRate = this.ytPlayer.getPlaybackRate();
          if (Number.isFinite(ytRate) && ytRate > 0) rate = ytRate;
        }
      }

      if (
        Number.isFinite(dur) &&
        dur > 0 &&
        Number.isFinite(pos) &&
        pos >= 0 &&
        Number.isFinite(rate) &&
        rate > 0
      ) {
        const clampedPos = Math.min(Math.max(0, pos), dur);
        navigator.mediaSession.setPositionState({
          duration: dur,
          playbackRate: rate,
          position: clampedPos,
        });
      }
    } catch {}
  }

  // --- Session Persistence ---

  private persistSession(): void {
    try {
      const payload = {
        currentSong: this.state.currentSong,
        currentTime: Math.round(this.state.currentTime),
        duration: Math.round(this.state.duration),
        volume: this.state.volume,
        isMuted: this.state.isMuted,
      };
      localStorage.setItem(STORAGE_STATE_KEY, JSON.stringify(payload));

      const upcomingTracks = this.queueManager.getUpcomingTracks();
      const nextSong = upcomingTracks.length > 0 ? upcomingTracks[0] : null;
      db.cacheCurrentAndNextTrack(
        this.state.currentSong,
        nextSong,
        this.queueManager.getQueue(),
        this.queueManager.getQueueIndex()
      ).catch(() => {});
    } catch {}
  }

  private async restoreSession(): Promise<void> {
    try {
      const saved = localStorage.getItem(STORAGE_STATE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.currentSong && !isDemoItem(parsed.currentSong)) {
          this.state.currentSong = parsed.currentSong;
          this.state.currentTime = parsed.currentTime || 0;
          this.state.duration = parsed.duration || parsed.currentSong.duration || 180;
          this.state.volume = typeof parsed.volume === 'number' ? parsed.volume : 0.85;
          this.state.isMuted = Boolean(parsed.isMuted);
          this.audio.volume = this.state.isMuted ? 0 : this.state.volume;
          this.updateMediaSessionMetadata(this.state.currentSong);
          this.updateMediaSessionPlaybackState('paused');
        } else if (parsed.currentSong && isDemoItem(parsed.currentSong)) {
          localStorage.removeItem(STORAGE_STATE_KEY);
        }
      }

      if (!this.state.currentSong) {
        const cached = await db.getCachedQueueTracks();
        if (cached.currentTrack && !isDemoItem(cached.currentTrack)) {
          this.state.currentSong = cached.currentTrack;
          this.state.duration = cached.currentTrack.duration || 180;
          if (cached.queue && cached.queue.length > 0) {
            this.queueManager.setQueue(cached.queue, cached.queueIndex >= 0 ? cached.queueIndex : 0);
          }
          this.updateMediaSessionMetadata(this.state.currentSong);
          this.updateMediaSessionPlaybackState('paused');
        }
      }

      if (!this.state.currentSong) {
        const queued = this.queueManager.getCurrentSong();
        if (queued && !isDemoItem(queued)) {
          this.state.currentSong = queued;
          this.state.duration = queued.duration || 180;
          this.updateMediaSessionMetadata(this.state.currentSong);
          this.updateMediaSessionPlaybackState('paused');
        }
      }
    } catch {}
  }
}

export const audioPlayer = new AudioPlayer();
