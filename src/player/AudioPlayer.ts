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
  private prebufferedSegments = new Map<string, ArrayBuffer>();
  private preloaderAudio: HTMLAudioElement | null = null;
  private isTransitioning = false;

  public setPrebufferedSegment(songId: string, buffer: ArrayBuffer): void {
    if (!songId || !buffer) return;
    this.prebufferedSegments.set(songId, buffer);
    const clean = songId.replace(/^(yt_liked_|yt_top_|yt_sync_)/, '').trim();
    if (clean !== songId) {
      this.prebufferedSegments.set(clean, buffer);
    }
  }

  public getPrebufferedSegment(songId: string): ArrayBuffer | undefined {
    if (!songId) return undefined;
    const clean = songId.replace(/^(yt_liked_|yt_top_|yt_sync_)/, '').trim();
    return this.prebufferedSegments.get(songId) || this.prebufferedSegments.get(clean);
  }

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

    // 3. Setup Media Session API (Lock screen, Control Center, Android notification)
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
        el.style.bottom = '0px';
        el.style.right = '0px';
        el.style.width = '1px';
        el.style.height = '1px';
        el.style.opacity = '0.01';
        el.style.pointerEvents = 'none';
        el.style.zIndex = '-1';
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
    el.removeAttribute('crossorigin');
    el.setAttribute('playsinline', 'true');
    el.setAttribute('webkit-playsinline', 'true');
    el.setAttribute('x5-playsinline', 'true');

    return el;
  }

  /**
   * Setup YouTube Iframe Player
   */
  private setupYouTubePlayer(initialVideoId?: string): void {
    if (typeof window === 'undefined') return;

    const initContainer = () => {
      let container = document.getElementById('yt-player-target');
      if (!container) {
        container = document.createElement('div');
        container.id = 'yt-player-target';
        container.style.position = 'fixed';
        container.style.bottom = '0px';
        container.style.right = '0px';
        container.style.width = '1px';
        container.style.height = '1px';
        container.style.opacity = '0.01';
        container.style.pointerEvents = 'none';
        container.style.zIndex = '-1';
        document.body.appendChild(container);
      }
      this.instantiateYTPlayer(initialVideoId);
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
      }, 100);
      window.setTimeout(() => window.clearInterval(pollInterval), 15000);

      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.async = true;
        document.head.appendChild(tag);
      }
    }
  }

  private instantiateYTPlayer(initialVideoId?: string): void {
    if (typeof window === 'undefined' || !window.YT || !window.YT.Player) return;
    if (this.ytPlayer) return;

    const vidId = initialVideoId || (this.pendingSong ? extractYouTubeVideoId(this.pendingSong.id) : null) || (this.state.currentSong ? extractYouTubeVideoId(this.state.currentSong.id) : null);
    if (!vidId) return;

    try {
      this.ytPlayer = new window.YT.Player('yt-player-target', {
        height: '100%',
        width: '100%',
        videoId: vidId,
        playerVars: {
          autoplay: this.intendedPlayState ? 1 : 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          enablejsapi: 1,
          iv_load_policy: 3,
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
            if (!this.isYTActive) return;
            // YT.PlayerState: UNSTARTED (-1), ENDED (0), PLAYING (1), PAUSED (2), BUFFERING (3), CUED (5)
            const stateVal = event.data;
            if (stateVal === 1) {
              this.isYTReady = true;
              this.state.isPlaying = true;
              this.state.isBuffering = false;
              this.state.error = null;
              const dur = this.ytPlayer.getDuration();
              if (dur && dur > 0) {
                this.state.duration = dur;
              }
              const cur = this.ytPlayer.getCurrentTime();
              if (typeof cur === 'number' && !isNaN(cur) && cur >= 0) {
                this.state.currentTime = cur;
              }
              if (this.state.currentSong) {
                this.updateMediaSessionMetadata(this.state.currentSong);
              }
              this.setupMediaSession();
              this.updateMediaSessionPlaybackState('playing');
              this.notify();
            } else if (stateVal === 5 || stateVal === -1) {
              if (this.intendedPlayState && this.ytPlayer && typeof this.ytPlayer.playVideo === 'function') {
                try { this.ytPlayer.playVideo(); } catch {}
              }
            } else if (stateVal === 2) {
              if (this.intendedPlayState) {
                // When app is backgrounded or screen locked, maintain playing state and re-assert playVideo
                this.state.isPlaying = true;
                this.updateMediaSessionPlaybackState('playing');
                if (this.ytPlayer && typeof this.ytPlayer.playVideo === 'function') {
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
      if (document.visibilityState === 'hidden') {
        // Tab backgrounded or screen locked: maintain foreground media session lock
        if (this.intendedPlayState) {
          this.state.isPlaying = true;
          this.updateMediaSessionPlaybackState('playing');
          if (this.state.currentSong) {
            this.updateMediaSessionMetadata(this.state.currentSong);
          }
          this.updateMediaSessionPosition(true);

          // Ensure native audio element continues playing smoothly in background (for non-YouTube tracks)
          if (!this.isYTActive && this.audio && this.audio.paused) {
            this.audio.play().catch(() => {});
          }

          // Continue YouTube player playback when backgrounded
          if (this.isYTActive && this.ytPlayer && typeof this.ytPlayer.playVideo === 'function') {
            try { this.ytPlayer.playVideo(); } catch {}
          }
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

  /**
   * Time tracker for smooth progress bar and position state sync
   */
  private startTimeTracker(): void {
    if (this.timeUpdateInterval) clearInterval(this.timeUpdateInterval);

    this.timeUpdateInterval = window.setInterval(() => {
      if (this.state.isPlaying) {
        if (this.isSeeking) {
          return;
        }
        if (!this.isYTActive && this.audio && this.audio.seeking) {
          return;
        }

        let curTime = 0;
        let dur = 0;

        if (this.isYTActive && this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function') {
          try {
            curTime = this.ytPlayer.getCurrentTime() || 0;
            dur = this.ytPlayer.getDuration() || this.state.duration;
          } catch {}
        } else if (this.audio && !isNaN(this.audio.currentTime)) {
          curTime = this.audio.currentTime;
          dur = this.audio.duration;
        }

        if (typeof curTime === 'number' && !isNaN(curTime) && curTime >= 0) {
          const hasTimeProgressed = Math.abs(curTime - this.state.currentTime) > 0.02;
          const wasBuffering = this.state.isBuffering;
          this.state.currentTime = curTime;
          if (dur && dur > 0 && dur !== this.state.duration) {
            this.state.duration = dur;
          }
          if (curTime > 0 && wasBuffering) {
            this.state.isBuffering = false;
          }
          if (hasTimeProgressed || (curTime > 0 && wasBuffering)) {
            this.updateMediaSessionPosition();
            this.notify();
          }

          // Proactively prewarm next track before current song ends
          if (dur && dur > 0 && curTime > 0 && dur - curTime <= 30) {
            this.preloadNextTrack();
            const upcoming = this.queueManager.getUpcomingTracks();
            if (upcoming.length < 2 && this.state.currentSong && !this.isFetchingSuggestions) {
              this.loadSuggestions(this.state.currentSong.id, false);
            }
          }
        }
      }
    }, 200);
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
        this.notify();
      }
    });

    el.addEventListener('canplay', () => {
      if (!this.isYTActive) {
        this.state.isBuffering = false;
        this.notify();
      }
    });

    el.addEventListener('seeking', () => {
      if (!this.isYTActive) {
        this.isSeeking = true;
      }
    });

    el.addEventListener('seeked', () => {
      if (!this.isYTActive) {
        this.isSeeking = false;
        if (this.seekDebounceTimer) {
          clearTimeout(this.seekDebounceTimer);
          this.seekDebounceTimer = null;
        }
        if (!isNaN(el.currentTime)) {
          this.state.currentTime = el.currentTime;
          this.updateMediaSessionPosition();
          this.notify();
        }
      }
    });

    el.addEventListener('timeupdate', () => {
      if (!this.isYTActive && !this.isSeeking && !el.seeking && !isNaN(el.currentTime)) {
        this.state.currentTime = el.currentTime;
        this.updateMediaSessionPosition();
        this.notify();

        // Proactive background prewarm & seamless transition:
        // Even when minimized or locked, timeupdate continues firing in WebKit/Chromium
        if (el.duration > 0 && el.currentTime > 0) {
          const timeLeft = el.duration - el.currentTime;
          // Prewarm upcoming track 35 seconds before song ends
          if (timeLeft <= 35 && timeLeft > 0) {
            this.preloadNextTrack();
          }

          // Smooth instant transition:
          // In mobile browsers and desktop, triggering transition 0.35s before end ensures
          // the next song starts playing the exact instant the current song finishes smoothly!
          if (timeLeft <= 0.35 && timeLeft > 0.05 && this.intendedPlayState && !this.isTransitioning) {
            this.isTransitioning = true;
            this.handleTrackEnded();
            setTimeout(() => {
              this.isTransitioning = false;
            }, 1800);
          }
        }
      }
    });

    el.addEventListener('durationchange', () => {
      if (!this.isYTActive && !isNaN(el.duration) && el.duration > 0) {
        this.state.duration = el.duration;
        this.updateMediaSessionPosition();
        this.notify();
      }
    });

    el.addEventListener('play', () => {
      this.state.isPlaying = true;
      this.state.isBuffering = false;
      this.state.error = null;
      this.updateMediaSessionPlaybackState('playing');
      this.updateMediaSessionPosition(true);
      this.notify();
    });

    el.addEventListener('playing', () => {
      this.state.isPlaying = true;
      this.state.isBuffering = false;
      this.state.error = null;
      this.updateMediaSessionPlaybackState('playing');
      this.updateMediaSessionPosition(true);
      this.notify();
    });

    el.addEventListener('pause', () => {
      if (!this.intendedPlayState) {
        this.state.isPlaying = false;
        this.updateMediaSessionPlaybackState('paused');
        this.updateMediaSessionPosition(true);
        this.notify();
      }
    });

    el.addEventListener('ended', () => {
      if (!this.isYTActive && !this.isTransitioning) {
        this.isTransitioning = true;
        this.handleTrackEnded();
        setTimeout(() => {
          this.isTransitioning = false;
        }, 1800);
      }
    });

    el.addEventListener('error', () => {
      if (!this.isYTActive && this.state.currentSong) {
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
    if (now - this.lastPersistTime > 3000) {
      this.lastPersistTime = now;
      this.persistSession();
    }
  }

  // --- Core Playback Execution ---

  /**
   * MediaSource buffer approach for near-zero latency streaming:
   * Attaches a MediaSource buffer to the audio element and pre-feeds the initial
   * segment for instant audio start while streaming the remaining data.
   */
  private playWithMediaSourceBuffer(url: string, startSeconds: number, currentSession: number, songId?: string): boolean {
    if (
      isIOS() ||
      typeof window === 'undefined' ||
      typeof MediaSource === 'undefined' ||
      !MediaSource.isTypeSupported('audio/mp4; codecs="mp4a.40.2"')
    ) {
      return false;
    }

    try {
      const ms = new MediaSource();
      const objectUrl = URL.createObjectURL(ms);
      const abortController = new AbortController();

      ms.addEventListener('sourceopen', async () => {
        if (this.playbackSessionId !== currentSession) {
          try { URL.revokeObjectURL(objectUrl); } catch {}
          return;
        }

        try {
          const sb = ms.addSourceBuffer('audio/mp4; codecs="mp4a.40.2"');
          sb.mode = 'segments';

          // Check if the first 5-second chunk was already pre-buffered in memory
          let buf: ArrayBuffer | undefined = songId ? this.getPrebufferedSegment(songId) : undefined;

          if (!buf) {
            const res = await fetch(url, {
              headers: { Range: 'bytes=0-327679' },
              signal: abortController.signal,
            });

            if (!res.ok && res.status !== 206) {
              throw new Error(`MediaSource buffer response status ${res.status}`);
            }

            buf = await res.arrayBuffer();
          }

          if (this.playbackSessionId !== currentSession || !buf) return;

          sb.addEventListener('updateend', () => {
            if (this.playbackSessionId === currentSession && this.intendedPlayState && this.audio.paused) {
              this.audio.play().catch(() => {});
            }
          }, { once: true });

          sb.appendBuffer(buf);
        } catch {
          if (this.playbackSessionId === currentSession) {
            this.audio.src = url;
            this.audio.play().catch(() => {});
          }
        }
      }, { once: true });

      this.audio.src = objectUrl;
      const playPromise = this.audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }
      return true;
    } catch {
      return false;
    }
  }

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
    this.setupMediaSession();
    this.updateMediaSessionMetadata(song);
    this.updateMediaSessionPlaybackState('playing');

    // 2. Start background audio anchor (WakeLock & AudioContext unlock)
    backgroundAudioManager.startPlaybackAnchor(song);

    // 3. Cache recently played in IndexedDB
    db.addRecentlyPlayed(song).catch(() => {});
    const upcomingTracks = this.queueManager.getUpcomingTracks();
    const nextSong = upcomingTracks.length > 0 ? upcomingTracks[0] : null;
    db.cacheCurrentAndNextTrack(song, nextSong, this.queueManager.getQueue(), this.queueManager.getQueueIndex()).catch(() => {});

    const cleanId = extractYouTubeVideoId(song.id) || song.id.replace(/^(yt_liked_|yt_top_|yt_sync_)/, '').trim();

    // 4. High-Fidelity Audio Stream Execution:
    const isDirectBlob = song.streamUrl && (song.streamUrl.startsWith('blob:') || song.streamUrl.startsWith('data:'));

    if (isDirectBlob) {
      this.isYTActive = false;
      this.audio.src = song.streamUrl!;
      this.audio.volume = this.state.isMuted ? 0 : this.state.volume;
      this.audio.play().catch(() => {});
    } else {
      // Stream YouTube track directly via YouTube Player Engine
      this.playViaYouTube(cleanId, startSeconds, currentSession);
    }

    // In parallel, if not already cached, pre-resolve direct YouTube stream in background
    if (!this.streamUrlCache.has(cleanId) && !song.streamUrl?.startsWith('blob:')) {
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

    // 7. Keep upcoming recommendations populated
    if (upcomingTracks.length < 3) {
      this.loadSuggestions(song.id, false);
    }
  }

  /**
   * Fallback playback via YouTube Iframe if native audio stream is unavailable
   */
  private playViaYouTube(cleanId: string, startSeconds: number = 0, currentSession: number = 0): void {
    this.isYTActive = true;

    // Pause native audio to avoid audio session collision and "Not Playing" state
    try {
      this.audio.pause();
    } catch {}

    const canDirectlyLoad = this.ytPlayer && (typeof this.ytPlayer.loadVideoById === 'function' || typeof this.ytPlayer.cueVideoById === 'function');

    if (!canDirectlyLoad) {
      if (this.state.currentSong) {
        this.pendingSong = this.state.currentSong;
        this.pendingStartTime = startSeconds;
      }
      this.setupYouTubePlayer(cleanId);
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
            // Pre-fetch initial audio segment via local proxy for Service Worker StaleWhileRevalidate caching
            const proxySegmentUrl = `/api/song/${encodeURIComponent(cleanId)}/audio?title=${encodeURIComponent(nextTrack.title || '')}&artist=${encodeURIComponent(nextTrack.artist || '')}`;
            try {
              fetch(proxySegmentUrl, {
                headers: { Range: 'bytes=0-327679' },
              }).catch(() => {});
            } catch {}

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

    // Pre-resolve the 2nd upcoming track in background for seamless binge-listening
    if (upcoming.length > 1) {
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
                try {
                  fetch(data.streamUrl, {
                    headers: { Range: 'bytes=0-524287' },
                  }).catch(() => {});
                } catch {}
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

    // If tapping the currently loaded song, resume from the paused position instead of restarting from 0
    if (this.state.currentSong && this.state.currentSong.id === song.id) {
      if (!this.state.isPlaying) {
        return this.play();
      }
      return;
    }

    if (contextQueue && contextQueue.length > 0) {
      const idx = contextQueue.findIndex((s) => s.id === song.id);
      this.queueManager.setQueue(contextQueue, idx !== -1 ? idx : 0);
    } else {
      this.queueManager.setQueue([song], 0);
      this.loadSuggestions(song.id, true);
    }

    await this.startPlayback(song, 0);
  }

  public async playQueueIndex(index: number): Promise<void> {
    if (this.queueManager.getQueueIndex() === index && this.state.currentSong) {
      if (!this.state.isPlaying) {
        return this.play();
      }
      return;
    }

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

    const resumeSeconds = this.state.currentTime || 0;

    if (!this.isYTActive && this.audio) {
      this.audio.volume = this.state.isMuted ? 0 : this.state.volume;
      if (resumeSeconds > 0 && Math.abs(this.audio.currentTime - resumeSeconds) > 0.5) {
        try { this.audio.currentTime = resumeSeconds; } catch {}
      }
      try {
        await this.audio.play();
      } catch (err: any) {
        if (err?.name !== 'AbortError' && !err?.message?.includes('interrupted')) {
          const cleanId = extractYouTubeVideoId(song.id) || song.id.replace(/^(yt_liked_|yt_top_|yt_sync_)/, '').trim();
          this.playViaYouTube(cleanId, resumeSeconds, this.playbackSessionId);
        }
      }
    } else if (this.isYTActive) {
      if (this.ytPlayer && typeof this.ytPlayer.playVideo === 'function') {
        try {
          if (resumeSeconds > 0 && typeof this.ytPlayer.getCurrentTime === 'function') {
            const ytTime = this.ytPlayer.getCurrentTime() || 0;
            if (Math.abs(ytTime - resumeSeconds) > 0.5 && typeof this.ytPlayer.seekTo === 'function') {
              this.ytPlayer.seekTo(resumeSeconds, true);
            }
          }
          this.ytPlayer.playVideo();
        } catch (e) {
          console.warn('YT playVideo error:', e);
        }
      } else {
        const cleanId = extractYouTubeVideoId(song.id) || song.id.replace(/^(yt_liked_|yt_top_|yt_sync_)/, '').trim();
        this.playViaYouTube(cleanId, resumeSeconds, this.playbackSessionId);
      }
    }

    this.state.isPlaying = true;
    this.state.isBuffering = false;
    this.updateMediaSessionMetadata(song);
    this.updateMediaSessionPlaybackState('playing');
    this.updateMediaSessionPosition(true);
    this.notify();
  }

  public pause(callerDescription = 'User interaction / UI control'): void {
    this.playbackSessionId++;
    this.intendedPlayState = false;
    diagnostics.recordExplicitPause(callerDescription);
    backgroundAudioManager.stopPlaybackAnchor();

    let pausedTime = this.state.currentTime;

    if (this.isYTActive && this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function') {
      try {
        const t = this.ytPlayer.getCurrentTime();
        if (typeof t === 'number' && !isNaN(t) && t > 0) {
          pausedTime = t;
        }
      } catch {}
    } else if (this.audio && !isNaN(this.audio.currentTime) && this.audio.currentTime > 0) {
      pausedTime = this.audio.currentTime;
    }

    this.state.currentTime = pausedTime;

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
    this.notify();
    this.persistSession();
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
    }, 350);

    if (this.isYTActive) {
      if (this.ytPlayer && typeof this.ytPlayer.seekTo === 'function') {
        try {
          this.ytPlayer.seekTo(target, true);
        } catch (e) {
          console.warn('YT seekTo error:', e);
        }
      }
    } else if (this.audio) {
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

  public seekBackward(seconds = 10): void {
    const target = Math.max(0, this.state.currentTime - seconds);
    this.seek(target);
  }

  public seekForward(seconds = 10): void {
    const dur = this.state.duration > 0 ? this.state.duration : Infinity;
    const target = Math.min(dur, this.state.currentTime + seconds);
    this.seek(target);
  }

  public async next(): Promise<void> {
    let nextSong = this.queueManager.next();
    if (!nextSong) {
      const q = this.queueManager.getQueue();
      if (q.length > 1) {
        this.queueManager.setQueueIndex(0);
        nextSong = this.queueManager.getCurrentSong();
      }
    }

    if (!nextSong && this.state.currentSong) {
      const fallbackTracks: Song[] = [
        { id: '1F3hm6MfR1k', title: 'Hukum - Thalaivar Alappara', artist: 'Anirudh Ravichander', artistId: 'anirudh', album: 'Jailer', albumId: 'jailer', duration: 207, streamUrl: '/api/song/1F3hm6MfR1k/audio', artworkUrl: 'https://i.ytimg.com/vi/1F3hm6MfR1k/hqdefault.jpg' },
        { id: 'szvt1vD0Uug', title: 'Naa Ready', artist: 'Anirudh Ravichander, Thalapathy Vijay', artistId: 'anirudh', album: 'Leo', albumId: 'leo', duration: 248, streamUrl: '/api/song/szvt1vD0Uug/audio', artworkUrl: 'https://i.ytimg.com/vi/szvt1vD0Uug/hqdefault.jpg' },
        { id: 'VT0wF8a_o28', title: 'Katchi Sera', artist: 'Sai Abhyankkar', artistId: 'sai-abhyankkar', album: 'Katchi Sera', albumId: 'katchi-sera', duration: 184, streamUrl: '/api/song/VT0wF8a_o28/audio', artworkUrl: 'https://i.ytimg.com/vi/VT0wF8a_o28/hqdefault.jpg' },
        { id: 'i_rL53tH900', title: 'Aasa Kooda', artist: 'Sai Abhyankkar, Sai Smriti', artistId: 'sai-abhyankkar', album: 'Think Indie', albumId: 'think-indie', duration: 212, streamUrl: '/api/song/i_rL53tH900/audio', artworkUrl: 'https://i.ytimg.com/vi/i_rL53tH900/hqdefault.jpg' },
        { id: 's0lZk9t81z4', title: 'En Iniya Thanimaye', artist: 'Sid Sriram, D. Imman', artistId: 'sid-sriram', album: 'Teddy', albumId: 'teddy', duration: 246, streamUrl: '/api/song/s0lZk9t81z4/audio', artworkUrl: 'https://i.ytimg.com/vi/s0lZk9t81z4/hqdefault.jpg' },
        { id: 'KUN5Uf9mObQ', title: 'Arabic Kuthu', artist: 'Anirudh Ravichander, Jonita Gandhi', artistId: 'anirudh', album: 'Beast', albumId: 'beast', duration: 280, streamUrl: '/api/song/KUN5Uf9mObQ/audio', artworkUrl: 'https://i.ytimg.com/vi/KUN5Uf9mObQ/hqdefault.jpg' }
      ];
      const eligible = fallbackTracks.filter(t => t.id !== this.state.currentSong?.id);
      if (eligible.length > 0) {
        nextSong = eligible[Math.floor(Math.random() * eligible.length)];
        this.queueManager.addToQueue(nextSong);
      }
    }

    if (nextSong) {
      await this.startPlayback(nextSong, 0);
    } else {
      if (this.state.currentSong) {
        this.loadSuggestions(this.state.currentSong.id, false);
      }
      this.seek(0);
      this.play();
    }
  }

  public async previous(): Promise<void> {
    let prevSong: Song | null = null;
    if (this.state.currentTime <= 3) {
      prevSong = this.queueManager.previous();
    }

    if (!prevSong && this.state.currentTime <= 3) {
      const q = this.queueManager.getQueue();
      if (q.length > 1) {
        this.queueManager.setQueueIndex(q.length - 1);
        prevSong = this.queueManager.getCurrentSong();
      }
    }

    if (prevSong) {
      await this.startPlayback(prevSong, 0);
    } else {
      this.seek(0);
      this.play();
    }
  }

  private handleTrackEnded(): void {
    if (this.queueManager.getRepeat() === 'one') {
      this.seek(0);
      this.play();
    } else {
      this.next();
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
  }

  public clearAutoplayQueue(): void {
    this.queueManager.clearAutoplayQueue();
    this.notify();
  }

  // --- Media Session API (Decoded Spotify Web Implementation) ---

  private setupMediaSession(): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    const safeSetActionHandler = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Some actions might not be supported in every browser
      }
    };

    safeSetActionHandler('play', () => {
      this.intendedPlayState = true;
      this.play();
    });

    safeSetActionHandler('pause', () => {
      this.intendedPlayState = false;
      this.pause('MediaSession OS pause');
    });

    safeSetActionHandler('stop', () => {
      this.pause();
      this.seek(0);
      this.updateMediaSessionPlaybackState('none');
    });

    safeSetActionHandler('previoustrack', () => {
      this.previous();
    });

    safeSetActionHandler('nexttrack', () => {
      this.next();
    });

    safeSetActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined && !isNaN(details.seekTime)) {
        this.seek(details.seekTime);
      }
    });

    // Unset seekbackward and seekforward on MediaSession so iOS Control Center & Lock Screen
    // display the standard music forward (Next Track |>>) and backward (Previous Track <<|) buttons
    // instead of podcast circular 10s jump icons!
    safeSetActionHandler('seekbackward', null);
    safeSetActionHandler('seekforward', null);
  }

  public updateMediaSessionMetadata(song: Song | null): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !song) return;

    try {
      const isYtId = song.id && song.id.length === 11 && !song.id.includes(' ');
      let rawArt =
        song.artworkUrl ||
        song.artwork ||
        (isYtId ? `https://i.ytimg.com/vi/${song.id}/hqdefault.jpg` : '/pwa-512x512.png');

      // Ensure HTTPS protocol
      if (rawArt.startsWith('http://')) {
        rawArt = rawArt.replace(/^http:\/\//, 'https://');
      }

      // Convert relative paths to fully-qualified absolute HTTPS URLs
      let primaryArt = rawArt;
      if (typeof window !== 'undefined' && !rawArt.startsWith('https://')) {
        try {
          primaryArt = new URL(rawArt, window.location.origin).href;
        } catch {}
      }

      const mimeType = primaryArt.endsWith('.png') ? 'image/png' : 'image/jpeg';

      // Provide bulletproof artwork list.
      // CRITICAL iOS WebKit rule: Never include maxresdefault.jpg because it returns 404
      // for most YouTube tracks, causing iOS Lock Screen to fail image loading and hide the artwork!
      // hqdefault.jpg (480x360) is guaranteed to exist 100% of the time.
      const artworkList: MediaImage[] = [
        { src: primaryArt, sizes: '512x512', type: mimeType },
        { src: primaryArt, sizes: '384x384', type: mimeType },
        { src: primaryArt, sizes: '256x256', type: mimeType },
        { src: primaryArt, sizes: '192x192', type: mimeType },
        { src: primaryArt, sizes: '128x128', type: mimeType },
        { src: primaryArt, sizes: '96x96', type: mimeType },
      ];

      if (isYtId) {
        artworkList.push(
          { src: `https://i.ytimg.com/vi/${song.id}/hqdefault.jpg`, sizes: '480x360', type: 'image/jpeg' },
          { src: `https://i.ytimg.com/vi/${song.id}/mqdefault.jpg`, sizes: '320x180', type: 'image/jpeg' },
          { src: `https://i.ytimg.com/vi/${song.id}/default.jpg`, sizes: '120x90', type: 'image/jpeg' }
        );
      }

      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title || 'Unknown Track',
        artist: song.artist || (song as any).artists || 'Celestial Music',
        album: song.album || 'Celestial Music',
        artwork: artworkList,
      });

      this.updateMediaSessionPlaybackState(this.state.isPlaying ? 'playing' : 'paused');
      this.updateMediaSessionPosition(true);
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
    // Throttle high-frequency position updates to prevent flooding WebKit IPC
    if (!force && now - this.lastPositionUpdate < 3000) {
      return;
    }
    this.lastPositionUpdate = now;

    try {
      const dur = this.state.duration;
      const cur = this.state.currentTime;
      if (
        typeof dur === 'number' &&
        isFinite(dur) &&
        dur > 0 &&
        typeof cur === 'number' &&
        isFinite(cur) &&
        cur >= 0
      ) {
        // Critical: playbackRate MUST be 0 when paused per W3C and iOS WebKit spec!
        navigator.mediaSession.setPositionState({
          duration: Math.max(1, dur),
          playbackRate: this.state.isPlaying ? 1.0 : 0,
          position: Math.min(Math.max(0, cur), dur),
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

      if (this.state.currentSong) {
        this.notify();
      }
    } catch {}
  }
}

export const audioPlayer = new AudioPlayer();
