/**
 * PlaybackDiagnostics
 * Development-only diagnostic and monitoring engine for mobile background audio verification.
 */

export interface VisibilityLog {
  timestamp: string;
  state: DocumentVisibilityState;
}

export interface ExplicitPauseLog {
  timestamp: string;
  caller: string;
}

export interface DiagnosticSnapshot {
  audioSource: string;
  readyState: number;
  readyStateLabel: string;
  networkState: number;
  networkStateLabel: string;
  paused: boolean;
  currentTime: number;
  duration: number;
  mediaSessionAvailable: boolean;
  mediaSessionState: string;
  lastError: string | null;
  visibilityHistory: VisibilityLog[];
  explicitPauseHistory: ExplicitPauseLog[];
}

const READY_STATE_LABELS: Record<number, string> = {
  0: 'HAVE_NOTHING (0)',
  1: 'HAVE_METADATA (1)',
  2: 'HAVE_CURRENT_DATA (2)',
  3: 'HAVE_FUTURE_DATA (3)',
  4: 'HAVE_ENOUGH_DATA (4)',
};

const NETWORK_STATE_LABELS: Record<number, string> = {
  0: 'NETWORK_EMPTY (0)',
  1: 'NETWORK_IDLE (1)',
  2: 'NETWORK_LOADING (2)',
  3: 'NETWORK_NO_SOURCE (3)',
};

class PlaybackDiagnosticsEngine {
  private audioElement: HTMLAudioElement | null = null;
  private lastError: string | null = null;
  private visibilityHistory: VisibilityLog[] = [];
  private explicitPauseHistory: ExplicitPauseLog[] = [];
  private listeners: Set<(snapshot: DiagnosticSnapshot) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        const entry: VisibilityLog = {
          timestamp: new Date().toLocaleTimeString(),
          state: document.visibilityState,
        };
        this.visibilityHistory.unshift(entry);
        if (this.visibilityHistory.length > 20) {
          this.visibilityHistory.pop();
        }
        this.notify();
      });
    }
  }

  public registerAudioElement(audio: HTMLAudioElement): void {
    this.audioElement = audio;

    const events = [
      'loadstart', 'loadedmetadata', 'canplay', 'playing', 
      'waiting', 'pause', 'timeupdate', 'error', 'emptied'
    ];

    events.forEach(evt => {
      audio.addEventListener(evt, () => {
        if (evt === 'error' && audio.error) {
          this.lastError = `Code ${audio.error.code}: ${audio.error.message || 'Media Error'}`;
        }
        this.notify();
      });
    });
  }

  public recordExplicitPause(caller: string): void {
    const entry: ExplicitPauseLog = {
      timestamp: new Date().toLocaleTimeString(),
      caller,
    };
    this.explicitPauseHistory.unshift(entry);
    if (this.explicitPauseHistory.length > 20) {
      this.explicitPauseHistory.pop();
    }
    this.notify();
  }

  public setLastError(err: string | null): void {
    this.lastError = err;
    this.notify();
  }

  public clearLogs(): void {
    this.visibilityHistory = [];
    this.explicitPauseHistory = [];
    this.lastError = null;
    this.notify();
  }

  public getSnapshot(): DiagnosticSnapshot {
    const audio = this.audioElement;
    const mediaSessionAvailable = typeof navigator !== 'undefined' && 'mediaSession' in navigator;
    const mediaSessionState = mediaSessionAvailable ? (navigator.mediaSession?.playbackState || 'none') : 'unsupported';

    return {
      audioSource: audio ? (audio.currentSrc || audio.src || 'No src loaded') : 'No audio element',
      readyState: audio ? audio.readyState : 0,
      readyStateLabel: audio ? (READY_STATE_LABELS[audio.readyState] || `Unknown (${audio.readyState})`) : 'N/A',
      networkState: audio ? audio.networkState : 0,
      networkStateLabel: audio ? (NETWORK_STATE_LABELS[audio.networkState] || `Unknown (${audio.networkState})`) : 'N/A',
      paused: audio ? audio.paused : true,
      currentTime: audio ? Math.round(audio.currentTime * 10) / 10 : 0,
      duration: audio && !isNaN(audio.duration) ? Math.round(audio.duration * 10) / 10 : 0,
      mediaSessionAvailable,
      mediaSessionState,
      lastError: this.lastError,
      visibilityHistory: [...this.visibilityHistory],
      explicitPauseHistory: [...this.explicitPauseHistory],
    };
  }

  public subscribe(listener: (snapshot: DiagnosticSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach(l => {
      try { l(snapshot); } catch {}
    });
  }
}

export const diagnostics = new PlaybackDiagnosticsEngine();
