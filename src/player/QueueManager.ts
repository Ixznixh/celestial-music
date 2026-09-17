/**
 * QueueManager
 * Spotify-style playback queue architecture:
 * - Current Song (Active)
 * - Next In Queue (User-queued tracks via "Add to Queue" or "Play Next")
 * - Context Queue (Remaining tracks if playing an album or playlist)
 * - Autoplay / Suggestions Queue (Dynamic recommendations generated automatically per song)
 * - History (Previously played tracks)
 */

import { Song, RepeatMode } from '../types';

const STORAGE_QUEUE_KEY = 'luma_player_queue_v2';
const STORAGE_USER_QUEUE_KEY = 'luma_player_user_queue';
const STORAGE_AUTOPLAY_KEY = 'luma_player_autoplay_queue';
const STORAGE_HISTORY_KEY = 'luma_player_history';
const STORAGE_CURRENT_KEY = 'luma_player_current_song';
const STORAGE_SHUFFLE_KEY = 'luma_player_shuffle';
const STORAGE_REPEAT_KEY = 'luma_player_repeat';

function normalizeTitle(title: string): string[] {
  if (!title) return [];
  return title
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\b(official|video|audio|lyric|lyrics|full|song|remix|lofi|hd|4k|mv|remastered|version|visualizer)\b/gi, '')
    .replace(/[^a-z0-9\s]/gi, '')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

function isSimilarTitle(titleA: string, titleB: string): boolean {
  if (!titleA || !titleB) return false;
  if (titleA.toLowerCase().trim() === titleB.toLowerCase().trim()) return true;
  const tokensA = normalizeTitle(titleA);
  const tokensB = normalizeTitle(titleB);
  if (tokensA.length === 0 || tokensB.length === 0) return false;
  if (tokensA.join(' ') === tokensB.join(' ')) return true;
  const setA = new Set(tokensA);
  let overlap = 0;
  for (const t of tokensB) {
    if (setA.has(t)) overlap++;
  }
  return (overlap / tokensA.length >= 0.5) || (overlap / tokensB.length >= 0.5);
}

export class QueueManager {
  private currentSong: Song | null = null;
  private userQueue: Song[] = [];
  private contextQueue: Song[] = [];
  private autoplayQueue: Song[] = [];
  private history: Song[] = [];
  private shuffle: boolean = false;
  private repeat: RepeatMode = 'off';

  constructor() {
    this.restoreFromStorage();
  }

  /**
   * Unified queue representation for UI & legacy consumers:
   * [ ...history, currentSong, ...userQueue, ...contextQueue, ...autoplayQueue ]
   */
  public getQueue(): Song[] {
    const list: Song[] = [];
    list.push(...this.history);
    if (this.currentSong) {
      list.push(this.currentSong);
    }
    list.push(...this.userQueue);
    list.push(...this.contextQueue);
    list.push(...this.autoplayQueue);
    return list;
  }

  public getQueueIndex(): number {
    if (!this.currentSong && this.history.length === 0) return -1;
    return this.history.length;
  }

  public getCurrentSong(): Song | null {
    return this.currentSong;
  }

  public getUserQueue(): Song[] {
    return [...this.userQueue];
  }

  public getContextQueue(): Song[] {
    return [...this.contextQueue];
  }

  public getAutoplayQueue(): Song[] {
    return [...this.autoplayQueue];
  }

  public getHistory(): Song[] {
    return [...this.history];
  }

  public getUpcomingTracks(): Song[] {
    return [...this.userQueue, ...this.contextQueue, ...this.autoplayQueue];
  }

  public getShuffle(): boolean {
    return this.shuffle;
  }

  public getRepeat(): RepeatMode {
    return this.repeat;
  }

  /**
   * Start a new queue context (e.g. user clicked a playlist, album, or single song)
   */
  public setQueue(songs: Song[], startIndex: number = 0): Song | null {
    if (!songs || songs.length === 0) {
      this.clearAll();
      return null;
    }

    const safeIndex = Math.max(0, Math.min(startIndex, songs.length - 1));
    this.currentSong = songs[safeIndex];
    this.history = songs.slice(0, safeIndex);
    
    // Remaining tracks in context filtered for similarity
    const rawRemaining = songs.slice(safeIndex + 1);
    const filteredRemaining: Song[] = [];
    const seenTitles: string[] = [this.currentSong.title].filter(Boolean);
    const seenIds = new Set<string>([this.currentSong.id]);

    for (const item of rawRemaining) {
      if (!item || !item.id || seenIds.has(item.id)) continue;
      if (!item.title) continue;

      if (isSimilarTitle(item.title, this.currentSong.title)) continue;
      if (seenTitles.some((t) => isSimilarTitle(item.title, t))) continue;

      seenIds.add(item.id);
      seenTitles.push(item.title);
      filteredRemaining.push(item);
    }

    if (this.shuffle && filteredRemaining.length > 0) {
      this.contextQueue = this.shuffleArray(filteredRemaining);
    } else {
      this.contextQueue = filteredRemaining;
    }

    this.userQueue = [];
    this.autoplayQueue = [];
    this.persistToStorage();
    return this.currentSong;
  }

  public setQueueIndex(index: number): Song | null {
    const unified = this.getQueue();
    if (index < 0 || index >= unified.length) return null;

    const target = unified[index];
    if (this.currentSong && this.currentSong.id === target.id) {
      return this.currentSong;
    }

    this.history = unified.slice(0, index);
    this.currentSong = target;
    this.contextQueue = unified.slice(index + 1);
    this.userQueue = [];
    this.autoplayQueue = [];

    this.persistToStorage();
    return this.currentSong;
  }

  /**
   * Set dynamic suggestions for the currently playing song
   */
  public setAutoplayQueue(songs: Song[]): void {
    if (!songs || songs.length === 0) {
      this.autoplayQueue = [];
      this.persistToStorage();
      return;
    }

    const excludeIds = new Set<string>();
    const existingTitles: string[] = [];
    
    if (this.currentSong) {
      excludeIds.add(this.currentSong.id);
      if (this.currentSong.title) existingTitles.push(this.currentSong.title);
    }
    this.history.forEach((s) => {
      excludeIds.add(s.id);
      if (s.title) existingTitles.push(s.title);
    });
    this.userQueue.forEach((s) => {
      excludeIds.add(s.id);
      if (s.title) existingTitles.push(s.title);
    });
    this.contextQueue.forEach((s) => {
      excludeIds.add(s.id);
      if (s.title) existingTitles.push(s.title);
    });

    const accepted: Song[] = [];
    for (const song of songs) {
      if (excludeIds.has(song.id)) continue;
      if (!song.title) continue;

      // Filter out songs with titles similar to current song or existing queue tracks
      const isSimilar = existingTitles.some((t) => isSimilarTitle(song.title, t));
      if (isSimilar) continue;

      accepted.push(song);
      existingTitles.push(song.title);
    }

    this.autoplayQueue = accepted;
    this.persistToStorage();
  }

  public appendSongs(songs: Song[]): void {
    if (!songs || songs.length === 0) return;
    const existingIds = new Set(this.getQueue().map((s) => s.id));
    const existingTitles = this.getQueue().map((s) => s.title).filter(Boolean);

    const newSongs: Song[] = [];
    for (const song of songs) {
      if (existingIds.has(song.id)) continue;
      if (!song.title) continue;

      const isSimilar = existingTitles.some((t) => isSimilarTitle(song.title, t));
      if (isSimilar) continue;

      newSongs.push(song);
      existingIds.add(song.id);
      existingTitles.push(song.title);
    }

    if (newSongs.length === 0) return;
    this.autoplayQueue.push(...newSongs);
    this.persistToStorage();
  }

  /**
   * Spotify User Queue: User explicitly chose "Play Next"
   */
  public playNext(song: Song): void {
    // Remove if already in queue to avoid duplicates
    this.userQueue = this.userQueue.filter((s) => s.id !== song.id);
    this.contextQueue = this.contextQueue.filter((s) => s.id !== song.id);
    this.autoplayQueue = this.autoplayQueue.filter((s) => s.id !== song.id);

    this.userQueue.unshift(song);
    this.persistToStorage();
  }

  /**
   * Spotify User Queue: User explicitly chose "Add to Queue"
   */
  public addToQueue(song: Song): void {
    this.userQueue = this.userQueue.filter((s) => s.id !== song.id);
    this.contextQueue = this.contextQueue.filter((s) => s.id !== song.id);
    this.autoplayQueue = this.autoplayQueue.filter((s) => s.id !== song.id);

    this.userQueue.push(song);
    if (!this.currentSong) {
      this.currentSong = this.userQueue.shift() || null;
    }
    this.persistToStorage();
  }

  /**
   * Next track in queue:
   * 1. Priority: User Queue (explicitly added songs)
   * 2. Context Queue (album / playlist)
   * 3. Autoplay Queue (dynamic suggestions matching current song)
   */
  public next(): Song | null {
    if (this.repeat === 'one' && this.currentSong) {
      return this.currentSong;
    }

    let nextSong: Song | null = null;
    if (this.userQueue.length > 0) {
      nextSong = this.userQueue.shift()!;
    } else if (this.contextQueue.length > 0) {
      nextSong = this.contextQueue.shift()!;
    } else if (this.autoplayQueue.length > 0) {
      nextSong = this.autoplayQueue.shift()!;
    }

    if (nextSong) {
      if (this.currentSong) {
        this.history.push(this.currentSong);
        if (this.history.length > 50) this.history.shift();
      }
      this.currentSong = nextSong;
      this.persistToStorage();
      return this.currentSong;
    }

    if (this.repeat === 'all' && this.history.length > 0) {
      const all = [...this.history, ...(this.currentSong ? [this.currentSong] : [])];
      return this.setQueue(all, 0);
    }

    return null;
  }

  /**
   * Previous track from history
   */
  public previous(): Song | null {
    if (this.history.length > 0) {
      const prev = this.history.pop()!;
      if (this.currentSong) {
        this.userQueue.unshift(this.currentSong);
      }
      this.currentSong = prev;
      this.persistToStorage();
      return this.currentSong;
    }
    return this.currentSong;
  }

  public removeFromQueue(index: number): Song | null {
    const queue = this.getQueue();
    if (index < 0 || index >= queue.length) return null;

    const target = queue[index];

    // Check if target is currentSong
    if (this.currentSong && this.currentSong.id === target.id) {
      return this.next();
    }

    // Check history
    this.history = this.history.filter((s) => s.id !== target.id);
    // Check userQueue
    this.userQueue = this.userQueue.filter((s) => s.id !== target.id);
    // Check contextQueue
    this.contextQueue = this.contextQueue.filter((s) => s.id !== target.id);
    // Check autoplayQueue
    this.autoplayQueue = this.autoplayQueue.filter((s) => s.id !== target.id);

    this.persistToStorage();
    return this.currentSong;
  }

  public reorderQueue(startIndex: number, endIndex: number): void {
    const upcoming = this.getUpcomingTracks();
    const safeCurrentIndex = this.getQueueIndex();
    const upFrom = startIndex - (safeCurrentIndex + 1);
    const upTo = endIndex - (safeCurrentIndex + 1);

    if (upFrom >= 0 && upFrom < upcoming.length && upTo >= 0 && upTo < upcoming.length) {
      const [moved] = upcoming.splice(upFrom, 1);
      upcoming.splice(upTo, 0, moved);

      // Rebuild upcoming into userQueue and autoplayQueue
      this.userQueue = upcoming;
      this.contextQueue = [];
      this.autoplayQueue = [];
      this.persistToStorage();
    }
  }

  public clearQueue(): void {
    this.userQueue = [];
    this.contextQueue = [];
    this.autoplayQueue = [];
    this.history = [];
    this.persistToStorage();
  }

  public clearUpcoming(): void {
    this.userQueue = [];
    this.contextQueue = [];
    this.autoplayQueue = [];
    this.persistToStorage();
  }

  public clearUserQueue(): void {
    this.userQueue = [];
    this.persistToStorage();
  }

  public clearAutoplayQueue(): void {
    this.autoplayQueue = [];
    this.persistToStorage();
  }

  public toggleShuffle(): boolean {
    this.shuffle = !this.shuffle;
    if (this.contextQueue.length > 1) {
      this.contextQueue = this.shuffle
        ? this.shuffleArray(this.contextQueue)
        : [...this.contextQueue];
    }
    this.persistToStorage();
    return this.shuffle;
  }

  public cycleRepeat(): RepeatMode {
    const modes: RepeatMode[] = ['off', 'all', 'one'];
    const nextIdx = (modes.indexOf(this.repeat) + 1) % modes.length;
    this.repeat = modes[nextIdx];
    this.persistToStorage();
    return this.repeat;
  }

  public setRepeat(mode: RepeatMode): void {
    this.repeat = mode;
    this.persistToStorage();
  }

  public clearAll(): void {
    this.currentSong = null;
    this.userQueue = [];
    this.contextQueue = [];
    this.autoplayQueue = [];
    this.history = [];
    this.persistToStorage();
  }

  // --- Persistence ---

  private persistToStorage(): void {
    try {
      if (this.currentSong) {
        localStorage.setItem(STORAGE_CURRENT_KEY, JSON.stringify(this.currentSong));
      } else {
        localStorage.removeItem(STORAGE_CURRENT_KEY);
      }
      localStorage.setItem(STORAGE_USER_QUEUE_KEY, JSON.stringify(this.userQueue.slice(0, 50)));
      localStorage.setItem(STORAGE_AUTOPLAY_KEY, JSON.stringify(this.autoplayQueue.slice(0, 50)));
      localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(this.history.slice(-30)));
      localStorage.setItem(STORAGE_SHUFFLE_KEY, String(this.shuffle));
      localStorage.setItem(STORAGE_REPEAT_KEY, this.repeat);
    } catch {
      // Storage quota or private browsing mode
    }
  }

  private restoreFromStorage(): void {
    try {
      const savedCurrent = localStorage.getItem(STORAGE_CURRENT_KEY);
      const savedUser = localStorage.getItem(STORAGE_USER_QUEUE_KEY);
      const savedAutoplay = localStorage.getItem(STORAGE_AUTOPLAY_KEY);
      const savedHistory = localStorage.getItem(STORAGE_HISTORY_KEY);
      const savedShuffle = localStorage.getItem(STORAGE_SHUFFLE_KEY);
      const savedRepeat = localStorage.getItem(STORAGE_REPEAT_KEY);

      if (savedCurrent) {
        this.currentSong = JSON.parse(savedCurrent);
      }
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (Array.isArray(parsed)) this.userQueue = parsed;
      }
      if (savedAutoplay) {
        const parsed = JSON.parse(savedAutoplay);
        if (Array.isArray(parsed)) this.autoplayQueue = parsed;
      }
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed)) this.history = parsed;
      }
      if (savedShuffle) this.shuffle = savedShuffle === 'true';
      if (savedRepeat && ['off', 'all', 'one'].includes(savedRepeat)) {
        this.repeat = savedRepeat as RepeatMode;
      }

      // Legacy fallback
      if (!this.currentSong) {
        const legacyQueue = localStorage.getItem('luma_player_queue');
        const legacyIdx = localStorage.getItem('luma_player_queue_index');
        if (legacyQueue) {
          const parsed = JSON.parse(legacyQueue);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const idx = legacyIdx ? Math.max(0, parseInt(legacyIdx, 10)) : 0;
            this.setQueue(parsed, idx);
          }
        }
      }
    } catch {
      // Fallback clean state
    }
  }

  private shuffleArray<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
