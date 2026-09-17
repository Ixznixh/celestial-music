/**
 * AudioPlayer Centralized Real Music Playback Engine
 * 
 * Central singleton controlling YouTube Music / YouTube audio playback
 * with seamless Media Session API integration, queue orchestration,
 * lyrics synchronization, and zero mock fallbacks.
 */

import { Song, PlaybackState, RepeatMode } from '../types';
import { QueueManager } from './QueueManager';
import { db, isDemoItem } from '../services/indexedDB';
import { extractYouTubeVideoId, parseDurationInSeconds } from '../utils/formatters';
import { diagnostics } from './PlaybackDiagnostics';
import { backgroundAudioManager } from './BackgroundAudioManager';

const STORAGE_STATE_KEY = 'luma_player_playback_state';

// Global declaration for YouTube Iframe API
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

interface PlaybackCandidate {
  videoId: string;
  title?: string;
  artist?: string;
  duration?: number;
  artworkUrl?: string;
}

export class AudioPlayer {
  private audio: HTMLAudioElement;
  private queueManager: QueueManager;
  private listeners: Set<(state: PlaybackState) => void> = new Set();

  // YouTube Player backend
  private ytPlayer: any = null;
  private isYTReady = false;
  private isYTActive = false;
  private timeUpdateInterval: number | null = null;
  private pendingSong: Song | null = null;
  private pendingStartTime: number = 0;
  private isFetchingSuggestions = false;
  private lastSuggestedSongId: string | null = null;
  private crossfadeDuration: number = 0;
  private currentQuality: 'normal' | 'high' | 'lossless' | 'hires' = 'lossless';
  private playbackSessionId = 0;
  private intendedPlayState = false;
  private playbackWatchdog: any = null;
  private ytReadyWatchdog: any = null;

  // Centralized YouTube Candidate & Fallback Engine
  private readonly MAX_CANDIDATES = 5;
  private candidates: PlaybackCandidate[] = [];
  private currentCandidateIndex = 0;
  private attemptedCandidateVideoIds = new Set<string>();
  private activeCandidateVideoId: string | null = null;
  private isWaitingForCandidates = false;
  private candidateWaitTimeout: any = null;
  private isDirectAudioFallbackAttempted = false;

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
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.setAttribute('playsinline', 'true');
    this.audio.setAttribute('webkit-playsinline', 'true');
    this.audio.setAttribute('x5-playsinline', 'true');
    this.queueManager = new QueueManager();

    this.ensureAudioMounted();
    diagnostics.registerAudioElement(this.audio);
    this.setupAudioListeners();
    this.setupYouTubePlayer();
    this.setupMediaSession();
    this.restoreSession();
    this.startTimeTracker();
  }

  /**
   * Keep the persistent HTMLAudioElement firmly mounted in the DOM.
   * This guarantees it is never garbage-collected or dropped during
   * navigation, route transitions, or backgrounding on mobile WebKit/Blink.
   */
  private ensureAudioMounted(): void {
    if (typeof document === 'undefined') return;

    const mount = () => {
      if (document.body && !document.body.contains(this.audio)) {
        this.audio.id = 'celestial-persistent-audio';
        this.audio.style.position = 'fixed';
        this.audio.style.top = '-9999px';
        this.audio.style.left = '-9999px';
        this.audio.style.width = '1px';
        this.audio.style.height = '1px';
        this.audio.style.opacity = '0.001';
        this.audio.style.pointerEvents = 'none';
        document.body.appendChild(this.audio);
      }
    };

    if (document.body) {
      mount();
    } else {
      window.addEventListener('DOMContentLoaded', mount, { once: true });
    }
  }

  // --- YouTube Iframe Player Integration ---

  private setupYouTubePlayer(): void {
    if (typeof window === 'undefined') return;

    // Ensure hidden container exists in DOM (rendered in viewport at 200x200px opacity 0.001 to prevent iOS WebKit background video suspension)
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
        container.style.opacity = '0.001';
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
      // Load YouTube Iframe API script and poll until ready
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
      window.setTimeout(() => window.clearInterval(pollInterval), 12000);

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
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          enablejsapi: 1,
          origin: typeof window !== 'undefined' ? window.location.origin : undefined,
          widget_referrer: typeof window !== 'undefined' ? window.location.href : undefined,
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
              this.startPlayback(song, startSec);
            }
          },
          onStateChange: (event: any) => {
            if (!this.isYTActive) return;
            // YT.PlayerState: UNSTARTED (-1), ENDED (0), PLAYING (1), PAUSED (2), BUFFERING (3), CUED (5)
            const stateVal = event.data;
            if (stateVal === 1) {
              // Video is genuinely playing! Cancel candidate watchdog
              if (this.playbackWatchdog) {
                clearTimeout(this.playbackWatchdog);
                this.playbackWatchdog = null;
              }
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
              // Video is CUED or UNSTARTED: if user intended to play, trigger playVideo immediately
              if (this.intendedPlayState && this.ytPlayer && typeof this.ytPlayer.playVideo === 'function') {
                try {
                  this.ytPlayer.playVideo();
                } catch {}
              }
            } else if (stateVal === 2) {
              // Paused: check if user explicitly requested pause or if OS auto-paused hidden iframe
              if (this.intendedPlayState) {
                if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
                  // Mobile OS suspended iframe video due to backgrounding!
                  // Seamlessly switch to native HTML5 audio stream fallback which continues playing in background
                  const currentSong = this.state.currentSong;
                  if (currentSong) {
                    this.isYTActive = false;
                    try { if (this.ytPlayer && typeof this.ytPlayer.pauseVideo === 'function') this.ytPlayer.pauseVideo(); } catch {}
                    const audioUrl = `/api/song/${encodeURIComponent(currentSong.id)}/audio`;
                    this.audio.src = audioUrl;
                    if (this.state.currentTime > 0) {
                      try { this.audio.currentTime = this.state.currentTime; } catch {}
                    }
                    this.audio.play().catch(() => {});
                  }
                } else if (this.ytPlayer && typeof this.ytPlayer.playVideo === 'function') {
                  try {
                    this.ytPlayer.playVideo();
                  } catch {}
                }
              } else {
                this.state.isPlaying = false;
                this.updateMediaSessionPlaybackState('paused');
                this.notify();
              }
            } else if (stateVal === 3) {
              // Buffering
              this.state.isBuffering = true;
              this.notify();
            } else if (stateVal === 0) {
              // Ended - Only trigger natural queue progression if the track actually played
              const isGenuineEnd =
                this.state.isPlaying &&
                this.state.currentTime >= 6 &&
                (this.state.duration > 0 ? this.state.currentTime >= this.state.duration - 4 : true);

              if (isGenuineEnd) {
                this.handleTrackEnded();
              } else {
                console.info(
                  `[YouTube] Spurious ended event (state 0) ignored for candidate ${this.activeCandidateVideoId} at ${this.state.currentTime}s. Trying next candidate...`
                );
                this.advanceToNextCandidate(this.playbackSessionId, 'Premature state 0');
              }
            }
          },
          onError: (err: any) => {
            if (!this.isYTActive) return;
            const errCode = err?.data || err;
            console.info(
              `[YouTube] Candidate failed\nvideoId: ${this.activeCandidateVideoId}\nerror: ${errCode}\ntrying next candidate...`
            );
            // Handle error codes (150, 101, 100, 2, 5, etc.): advance sequentially to next candidate
            this.advanceToNextCandidate(this.playbackSessionId, `Error ${errCode}`);
          },
        },
      });
    } catch {
      // Handled gracefully
    }
  }

  private lastPersistTime = 0;

  private startTimeTracker(): void {
    if (this.timeUpdateInterval) clearInterval(this.timeUpdateInterval);

    this.timeUpdateInterval = window.setInterval(() => {
      if (this.isYTActive && this.isYTReady && this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function') {
        try {
          // Check player state in case onStateChange missed
          if (typeof this.ytPlayer.getPlayerState === 'function') {
            const playerState = this.ytPlayer.getPlayerState();
            if (playerState === 1 && !this.state.isPlaying) {
              this.state.isPlaying = true;
              this.state.isBuffering = false;
            } else if (playerState === 2 && this.state.isPlaying && !this.intendedPlayState) {
              this.state.isPlaying = false;
            }
          }

          const curTime = this.ytPlayer.getCurrentTime();
          const dur = this.ytPlayer.getDuration();

          if (typeof curTime === 'number' && !isNaN(curTime) && curTime >= 0) {
            const hasTimeProgressed = Math.abs(curTime - this.state.currentTime) > 0.05;
            this.state.currentTime = curTime;

            if (dur && dur > 0 && dur !== this.state.duration) {
              this.state.duration = dur;
            }

            if (hasTimeProgressed) {
              this.updateMediaSessionPosition();
              this.notify();
            }

            // Proactively pre-fetch upcoming tracks before current song ends to guarantee smooth transition
            if (dur && dur > 0 && curTime > 0 && dur - curTime <= 15) {
              const upcoming = this.queueManager.getUpcomingTracks();
              if (upcoming.length < 2 && this.state.currentSong && !this.isFetchingSuggestions) {
                this.loadSuggestions(this.state.currentSong.id, false);
              }
            }
          }
        } catch {
          // YT Player not yet responding
        }
      } else if (!this.isYTActive && this.state.isPlaying && !isNaN(this.audio.currentTime)) {
        const curTime = this.audio.currentTime;
        const dur = this.audio.duration;
        if (typeof curTime === 'number' && !isNaN(curTime) && curTime >= 0) {
          const hasTimeProgressed = Math.abs(curTime - this.state.currentTime) > 0.05;
          this.state.currentTime = curTime;
          if (dur && dur > 0 && dur !== this.state.duration) {
            this.state.duration = dur;
          }
          if (hasTimeProgressed) {
            this.updateMediaSessionPosition();
            this.notify();
          }
        }
      }
    }, 250);
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

    // Throttled persistence (save every 3 seconds instead of every 250ms tick)
    const now = Date.now();
    if (now - this.lastPersistTime > 3000) {
      this.lastPersistTime = now;
      this.persistSession();
    }
  }

  // --- HTMLAudioElement Event Setup ---

  private setupAudioListeners(): void {
    this.audio.addEventListener('timeupdate', () => {
      if (!this.isYTActive && !isNaN(this.audio.currentTime)) {
        this.state.currentTime = this.audio.currentTime;
        this.updateMediaSessionPosition();
        this.notify();
      }
    });

    this.audio.addEventListener('durationchange', () => {
      if (!this.isYTActive && !isNaN(this.audio.duration) && this.audio.duration > 0) {
        this.state.duration = this.audio.duration;
        this.notify();
      }
    });

    this.audio.addEventListener('play', () => {
      if (!this.isYTActive) {
        this.state.isPlaying = true;
        this.state.isBuffering = false;
        this.state.error = null;
        this.updateMediaSessionPlaybackState('playing');
        this.notify();
      }
    });

    this.audio.addEventListener('pause', () => {
      if (!this.isYTActive) {
        this.state.isPlaying = false;
        this.updateMediaSessionPlaybackState('paused');
        this.notify();
      }
    });

    this.audio.addEventListener('waiting', () => {
      if (!this.isYTActive) {
        this.state.isBuffering = true;
        this.notify();
      }
    });

    this.audio.addEventListener('playing', () => {
      if (!this.isYTActive) {
        this.state.isBuffering = false;
        this.notify();
      }
    });

    this.audio.addEventListener('ended', () => {
      if (!this.isYTActive) {
        this.handleTrackEnded();
      }
    });

    this.audio.addEventListener('error', () => {
      if (!this.isYTActive) {
        if (!this.audio.src || this.audio.error?.code === 1) {
          return;
        }
        if (this.isDirectAudioFallbackAttempted) {
          this.state.isBuffering = false;
          this.state.isPlaying = false;
          this.state.error = "This track can't be played";
          this.updateMediaSessionPlaybackState('paused');
          this.notify();
          return;
        }
        this.handleAllCandidatesFailed(this.playbackSessionId);
      }
    });
  }

  // --- Centralized Candidate Fetching & Resilient Playback Orchestration ---

  /**
   * Fetches candidate video IDs from backend in parallel with candidate attempt 0.
   */
  private async fetchCandidatesForSession(session: number, song: Song): Promise<void> {
    try {
      const res = await fetch(
        `/api/song/${encodeURIComponent(song.id)}/candidates?title=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artist || '')}&_t=${Date.now()}`
      );
      if (res.ok && session === this.playbackSessionId) {
        const data = await res.json();
        const serverCandidates: PlaybackCandidate[] = data.candidates || [];
        for (const sc of serverCandidates) {
          const cleanId = extractYouTubeVideoId(sc.videoId);
          if (cleanId && !this.candidates.some((c) => c.videoId === cleanId)) {
            this.candidates.push({
              videoId: cleanId,
              title: sc.title || song.title,
              artist: sc.artist || song.artist,
              duration: sc.duration || song.duration,
              artworkUrl: sc.artworkUrl || song.artworkUrl,
            });
          }
        }
        if (this.isWaitingForCandidates && session === this.playbackSessionId) {
          this.isWaitingForCandidates = false;
          this.attemptCandidate(session, 0);
        }
      }
    } catch (err) {
      console.warn('[YouTube] Fetch candidates network notice:', err);
    }
  }

  /**
   * Sequentially attempts the next candidate in the candidate list.
   */
  private attemptCandidate(session: number, startSeconds: number): void {
    if (session !== this.playbackSessionId || !this.intendedPlayState) {
      return;
    }

    if (this.playbackWatchdog) {
      clearTimeout(this.playbackWatchdog);
      this.playbackWatchdog = null;
    }

    // Check candidate limits
    if (this.currentCandidateIndex >= this.MAX_CANDIDATES) {
      this.handleAllCandidatesFailed(session);
      return;
    }

    // If candidateIndex is beyond current list, wait briefly for candidate fetch
    if (this.currentCandidateIndex >= this.candidates.length) {
      this.isWaitingForCandidates = true;
      if (this.candidateWaitTimeout) {
        clearTimeout(this.candidateWaitTimeout);
      }
      this.candidateWaitTimeout = setTimeout(() => {
        this.candidateWaitTimeout = null;
        if (session === this.playbackSessionId && this.isWaitingForCandidates) {
          this.isWaitingForCandidates = false;
          if (this.currentCandidateIndex >= this.candidates.length) {
            this.handleAllCandidatesFailed(session);
          } else {
            this.attemptCandidate(session, startSeconds);
          }
        }
      }, 2000);
      return;
    }

    const candidate = this.candidates[this.currentCandidateIndex];
    const cleanId = extractYouTubeVideoId(candidate?.videoId);

    if (!cleanId || this.attemptedCandidateVideoIds.has(cleanId)) {
      this.currentCandidateIndex++;
      this.attemptCandidate(session, startSeconds);
      return;
    }

    this.attemptedCandidateVideoIds.add(cleanId);
    this.activeCandidateVideoId = cleanId;

    if (!this.isYTReady || !this.ytPlayer) {
      this.pendingSong = this.state.currentSong;
      this.pendingStartTime = startSeconds;

      this.ytReadyWatchdog = setTimeout(() => {
        if (session === this.playbackSessionId && !this.isYTReady) {
          console.info(`[YouTube] Player readiness timeout for candidate ${cleanId}. Trying next candidate...`);
          this.advanceToNextCandidate(session, 'Readiness timeout');
        }
      }, 3000);
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

      // 3.2-second watchdog timer: If YouTube player fails to play or gets stuck buffering, move to next candidate
      this.playbackWatchdog = setTimeout(() => {
        if (session === this.playbackSessionId && this.intendedPlayState) {
          const ytState =
            this.ytPlayer && typeof this.ytPlayer.getPlayerState === 'function'
              ? this.ytPlayer.getPlayerState()
              : -1;
          if (ytState !== 1) {
            console.info(
              `[YouTube] Candidate failed\nvideoId: ${cleanId}\nerror: 150 (playback timeout state: ${ytState})\ntrying next candidate...`
            );
            this.advanceToNextCandidate(session, 'Watchdog timeout');
          }
        }
      }, 3200);
    } catch (err: any) {
      console.info(`[YouTube] Candidate invocation error for ${cleanId}:`, err?.message || err);
      this.advanceToNextCandidate(session, 'Invocation error');
    }
  }

  /**
   * Advances sequentially to the next candidate video ID without disrupting the UI.
   */
  private advanceToNextCandidate(session: number, _reason: string): void {
    if (session !== this.playbackSessionId || !this.intendedPlayState || !this.isYTActive) {
      return;
    }

    if (this.playbackWatchdog) {
      clearTimeout(this.playbackWatchdog);
      this.playbackWatchdog = null;
    }

    this.currentCandidateIndex++;
    this.attemptCandidate(session, 0);
  }

  /**
   * Called when all candidate attempts have failed.
   * Instead of giving up immediately, attempts direct HTMLAudioElement playback
   * via the server-side audio proxy stream (/api/song/:id/audio) which provides
   * full HTTP 206 Partial Content byte ranges and native background playback on mobile Safari/Blink.
   */
  private async handleAllCandidatesFailed(session: number): Promise<void> {
    if (session !== this.playbackSessionId) return;

    if (this.playbackWatchdog) {
      clearTimeout(this.playbackWatchdog);
      this.playbackWatchdog = null;
    }
    if (this.candidateWaitTimeout) {
      clearTimeout(this.candidateWaitTimeout);
      this.candidateWaitTimeout = null;
    }
    this.isWaitingForCandidates = false;

    if (!this.isDirectAudioFallbackAttempted) {
      this.isDirectAudioFallbackAttempted = true;
      const currentSong = this.state.currentSong;
      if (currentSong) {
        console.log(`[AudioPlayer] Attempting direct audio proxy stream fallback for track ${currentSong.id}...`);
        try {
          this.isYTActive = false;
          if (this.ytPlayer && typeof this.ytPlayer.pauseVideo === 'function') {
            try { this.ytPlayer.pauseVideo(); } catch {}
          }
          const audioUrl = `/api/song/${encodeURIComponent(currentSong.id)}/audio`;
          this.audio.volume = this.state.isMuted ? 0 : this.state.volume;
          if (this.audio.src !== audioUrl) {
            this.audio.src = audioUrl;
          }
          if (this.state.currentTime > 0) {
            try { this.audio.currentTime = this.state.currentTime; } catch {}
          }
          await this.audio.play();

          if (this.playbackSessionId === session && this.intendedPlayState) {
            this.updateMediaSessionMetadata(currentSong);
            this.updateMediaSessionPlaybackState('playing');
            this.state.isBuffering = false;
            this.state.isPlaying = true;
            this.state.error = null;
            this.notify();
            return;
          }
        } catch (fallbackErr: any) {
          const isAbort =
            fallbackErr?.name === 'AbortError' ||
            (typeof fallbackErr?.message === 'string' &&
              (fallbackErr.message.includes('interrupted') ||
                fallbackErr.message.includes('pause') ||
                fallbackErr.message.includes('abort')));
          if (!isAbort) {
            console.info('[AudioPlayer] Audio proxy fallback notice:', fallbackErr?.message || fallbackErr);
          }
        }
      }
    }

    if (this.playbackSessionId === session && this.intendedPlayState) {
      this.state.isBuffering = false;
      this.state.isPlaying = false;
      this.state.error = "This track can't be played";
      this.updateMediaSessionPlaybackState('paused');
      this.notify();
    }
  }

  // --- Core Playback Controls ---

  private async startPlayback(song: Song, startSeconds: number = 0): Promise<void> {
    if (this.playbackWatchdog) {
      clearTimeout(this.playbackWatchdog);
      this.playbackWatchdog = null;
    }
    if (this.ytReadyWatchdog) {
      clearTimeout(this.ytReadyWatchdog);
      this.ytReadyWatchdog = null;
    }

    const currentSession = ++this.playbackSessionId;
    this.intendedPlayState = true;
    this.candidates = [];
    this.currentCandidateIndex = 0;
    this.attemptedCandidateVideoIds.clear();
    this.activeCandidateVideoId = null;
    this.isWaitingForCandidates = false;
    if (this.candidateWaitTimeout) {
      clearTimeout(this.candidateWaitTimeout);
      this.candidateWaitTimeout = null;
    }
    this.isDirectAudioFallbackAttempted = false;

    // Instant UI state update
    this.state.currentSong = song;
    const parsedDur = parseDurationInSeconds(song.duration);
    this.state.duration = parsedDur > 0 ? parsedDur : 240;
    this.state.currentTime = startSeconds;
    this.state.error = null;
    this.state.isBuffering = true;
    this.state.isPlaying = true;
    this.notify();

    // Immediate MediaSession metadata & background session anchor
    this.updateMediaSessionMetadata(song);
    this.updateMediaSessionPlaybackState('playing');
    backgroundAudioManager.startPlaybackAnchor(song);

    // Non-blocking background persistence & caching
    db.addRecentlyPlayed(song).catch(() => {});
    const upcomingTracks = this.queueManager.getUpcomingTracks();
    const nextSong = upcomingTracks.length > 0 ? upcomingTracks[0] : null;
    db.cacheCurrentAndNextTrack(song, nextSong, this.queueManager.getQueue(), this.queueManager.getQueueIndex()).catch(() => {});

    // Fast-path: Check for local downloaded blob
    const isLocalBlob = song.streamUrl && (song.streamUrl.startsWith('blob:') || song.streamUrl.startsWith('data:'));
    if (isLocalBlob) {
      this.isYTActive = false;
      if (this.ytPlayer && typeof this.ytPlayer.pauseVideo === 'function') {
        try { this.ytPlayer.pauseVideo(); } catch {}
      }
      try {
        this.audio.volume = this.state.isMuted ? 0 : this.state.volume;
        this.audio.src = song.streamUrl!;
        if (startSeconds > 0) {
          try { this.audio.currentTime = startSeconds; } catch {}
        }
        await this.audio.play();
        if (this.playbackSessionId === currentSession && this.intendedPlayState) {
          this.state.isBuffering = false;
          this.state.isPlaying = true;
          this.notify();
        }
      } catch {}
      return;
    }

    // High-Speed Direct YouTube Iframe Player Stream (<150ms playback)
    const initialId = extractYouTubeVideoId(song.id);
    if (initialId) {
      this.isYTActive = true;
      try {
        this.audio.pause();
        this.audio.removeAttribute('src');
      } catch {}

      this.candidates.push({
        videoId: initialId,
        title: song.title,
        artist: song.artist,
        duration: parsedDur,
        artworkUrl: song.artworkUrl || song.artwork,
      });

      // Attempt candidate immediately in client browser
      this.attemptCandidate(currentSession, startSeconds);

      // Fetch additional candidates in background for fallback
      this.fetchCandidatesForSession(currentSession, song);
    } else {
      // Fallback for custom non-YouTube IDs
      this.isYTActive = false;
      const audioUrl = `/api/song/${encodeURIComponent(song.id)}/audio`;
      try {
        this.audio.volume = this.state.isMuted ? 0 : this.state.volume;
        this.audio.src = audioUrl;
        if (startSeconds > 0) {
          try { this.audio.currentTime = startSeconds; } catch {}
        }
        await this.audio.play();
        if (this.playbackSessionId === currentSession && this.intendedPlayState) {
          this.state.isBuffering = false;
          this.state.isPlaying = true;
          this.notify();
        }
      } catch (audioErr: any) {
        console.info('[AudioPlayer] Native audio stream fallback:', audioErr?.message || audioErr);
      }
    }

    // Background pre-fetch suggestions so upcoming queue stays populated
    const upcoming = this.queueManager.getUpcomingTracks();
    if (upcoming.length < 3) {
      this.loadSuggestions(song.id, false);
    }
  }

  /**
   * Verified test stream for iPhone Safari background audio validation
   */
  public async playTestStream(): Promise<void> {
    const testSong: Song = {
      id: 'celestial-test-stream',
      title: 'iOS Background Verification Track',
      artist: 'Celestial Audio Engine',
      artistId: 'celestial-engine',
      album: 'System Verification',
      albumId: 'system-verification',
      duration: 240,
      artwork: '/apple-touch-icon.png',
      artworkUrl: '/apple-touch-icon.png',
      streamUrl: '/api/song/celestial-test-stream/audio',
      provider: 'youtube',
    };
    await this.startPlayback(testSong, 0);
  }

  public async playTrack(song: Song, contextQueue?: Song[]): Promise<void> {
    if (!song) return;

    // Immediately unlock audio context and background engine inside user tap gesture
    backgroundAudioManager.unlockAudioContext().catch(() => {});
    backgroundAudioManager.requestWakeLock().catch(() => {});

    if (contextQueue && contextQueue.length > 0) {
      const idx = contextQueue.findIndex((s) => s.id === song.id);
      this.queueManager.setQueue(contextQueue, idx !== -1 ? idx : 0);
    } else {
      // Playing a single song begins a clean playback context
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
        // Filter out current playing song
        const filtered = suggestions.filter((s) => s.id !== targetId);
        
        if (force) {
          // Explicit manual refresh
          this.queueManager.setAutoplayQueue(filtered);
        } else {
          // Automatic: only set if upcoming is empty, otherwise append to end
          const upcoming = this.queueManager.getUpcomingTracks();
          if (upcoming.length === 0) {
            this.queueManager.setAutoplayQueue(filtered);
          } else {
            this.queueManager.appendSongs(filtered);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load suggested songs:', err);
    } finally {
      this.isFetchingSuggestions = false;
      this.state.isLoadingSuggestions = false;
      this.notify();
    }
  }

  public async play(): Promise<void> {
    const song = this.state.currentSong || this.queueManager.getCurrentSong() || this.queueManager.getQueue()[0];
    if (!song) return;

    // Start background audio session carrier anchor
    backgroundAudioManager.startPlaybackAnchor(song);

    // If song is not loaded into the active engine (e.g. app launch or restored session), start playback!
    if (!this.activeCandidateVideoId && !this.audio.src) {
      await this.startPlayback(song, this.state.currentTime > 0 ? this.state.currentTime : 0);
      return;
    }

    const currentSession = ++this.playbackSessionId;
    this.intendedPlayState = true;

    try {
      if (this.isYTActive && this.ytPlayer && typeof this.ytPlayer.playVideo === 'function') {
        this.ytPlayer.playVideo();
        if (this.playbackSessionId !== currentSession || !this.intendedPlayState) {
          try { this.ytPlayer.pauseVideo(); } catch {}
          return;
        }
      } else if (!this.audio.src) {
        await this.startPlayback(song, this.state.currentTime);
      } else {
        await this.audio.play();
        if (this.playbackSessionId !== currentSession || !this.intendedPlayState) {
          try { this.audio.pause(); } catch {}
          return;
        }
        this.state.isPlaying = true;
        this.state.isBuffering = false;
        this.updateMediaSessionPlaybackState('playing');
        this.notify();
      }
    } catch (err: any) {
      const isAbortError = err?.name === 'AbortError' ||
        (typeof err?.message === 'string' && (
          err.message.includes('interrupted') ||
          err.message.includes('pause') ||
          err.message.includes('abort')
        ));
      if (isAbortError || this.playbackSessionId !== currentSession || !this.intendedPlayState) {
        return;
      }
      if (err?.name === 'NotAllowedError') {
        this.state.isPlaying = false;
        this.state.isBuffering = false;
        this.notify();
        return;
      }
      console.warn('Audio play error:', err.message || err);
      diagnostics.setLastError(err.message || String(err));
      await this.startPlayback(song, this.state.currentTime);
    }
  }

  public pause(callerDescription = 'User interaction / UI control'): void {
    this.playbackSessionId++;
    this.intendedPlayState = false;
    if (this.candidateWaitTimeout) {
      clearTimeout(this.candidateWaitTimeout);
      this.candidateWaitTimeout = null;
    }
    diagnostics.recordExplicitPause(callerDescription);
    backgroundAudioManager.stopPlaybackAnchor();
    if (this.ytPlayer && typeof this.ytPlayer.pauseVideo === 'function') {
      try {
        this.ytPlayer.pauseVideo();
      } catch (e) {
        console.warn('YT pauseVideo error:', e);
      }
    }
    try {
      this.audio.pause();
    } catch {}
    this.state.isPlaying = false;
    this.state.isBuffering = false;
    this.updateMediaSessionPlaybackState('paused');
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
    this.state.currentTime = target;

    if (this.isYTActive && this.ytPlayer && typeof this.ytPlayer.seekTo === 'function') {
      try {
        this.ytPlayer.seekTo(target, true);
      } catch (e) {
        console.warn('YTPlayer seek error:', e);
      }
    } else {
      try {
        this.audio.currentTime = target;
      } catch (e) {
        console.warn('HTMLAudioElement seek error:', e);
      }
    }

    this.updateMediaSessionPosition();
    this.notify();
  }

  public async next(): Promise<void> {
    const nextSong = this.queueManager.next();
    if (nextSong) {
      await this.startPlayback(nextSong, 0);
    } else {
      // When the queue is finished, fetch fresh recommendations based on the current song
      if (this.state.currentSong) {
        await this.loadSuggestions(this.state.currentSong.id, false);
        const retryNext = this.queueManager.next();
        if (retryNext) {
          await this.startPlayback(retryNext, 0);
          return;
        }
      }
      this.pause();
      this.seek(0);
    }
  }

  public async previous(): Promise<void> {
    if (this.state.currentTime > 3) {
      this.seek(0);
      return;
    }

    const prevSong = this.queueManager.previous();
    if (prevSong) {
      await this.startPlayback(prevSong, 0);
    } else {
      this.seek(0);
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

  // --- Volume & Audio Settings ---

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
      } catch (e) {
        console.warn('Set playback quality notice:', e);
      }
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
    this.notify();
  }

  public playNext(song: Song): void {
    this.queueManager.playNext(song);
    this.notify();
  }

  public reorderQueue(startIndex: number, endIndex: number): void {
    this.queueManager.reorderQueue(startIndex, endIndex);
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

  public clearAutoplayQueue(): void {
    this.queueManager.clearAutoplayQueue();
    this.notify();
  }

  // --- Media Session API ---

  private setupMediaSession(): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    const safeSetActionHandler = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Some browsers do not support every action handler
      }
    };

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

    safeSetActionHandler('previoustrack', () => {
      this.previous();
    });

    safeSetActionHandler('nexttrack', () => {
      this.next();
    });

    safeSetActionHandler('seekbackward', (details) => {
      const offset = details.seekOffset || 10;
      this.seek(Math.max(0, this.state.currentTime - offset));
    });

    safeSetActionHandler('seekforward', (details) => {
      const offset = details.seekOffset || 10;
      const target = this.state.duration > 0
        ? Math.min(this.state.duration, this.state.currentTime + offset)
        : this.state.currentTime + offset;
      this.seek(target);
    });

    safeSetActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined && !isNaN(details.seekTime)) {
        this.seek(details.seekTime);
      }
    });
  }

  public updateMediaSessionMetadata(song: Song | null): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !song) return;

    try {
      const isYtId = song.id && song.id.length === 11 && !song.id.includes(' ');
      const rawArt = song.artwork || song.artworkUrl || (isYtId ? `https://i.ytimg.com/vi/${song.id}/hqdefault.jpg` : '/pwa-512x512.png');
      
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
        artist: song.artist || (song as any).artists || 'Tamil Hits',
        album: song.album || 'Celestial Music',
        artwork: artworkList,
      });

      this.updateMediaSessionPosition();
    } catch (err) {
      console.warn('Failed to set MediaSession metadata:', err);
    }
  }

  public updateMediaSessionPlaybackState(state: 'none' | 'paused' | 'playing'): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = state;
    } catch {}
  }

  public updateMediaSessionPosition(): void {
    if (
      typeof navigator === 'undefined' ||
      !('mediaSession' in navigator) ||
      typeof navigator.mediaSession.setPositionState !== 'function'
    ) {
      return;
    }
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
        navigator.mediaSession.setPositionState({
          duration: Math.max(1, dur),
          playbackRate: 1,
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
    } catch {}
  }
}

export const audioPlayer = new AudioPlayer();
