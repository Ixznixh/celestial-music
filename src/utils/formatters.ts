/**
 * Utility formatters and visual color helpers
 */

export function parseDurationInSeconds(val: any): number {
  if (!val) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val.seconds === 'number') return val.seconds;
  if (typeof val === 'string') {
    const parts = val.split(':').map((p) => parseInt(p, 10));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return parts[0] * 60 + parts[1];
    }
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) return parsed;
  }
  return 0;
}

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function formatRemainingTime(current: number, total: number): string {
  const remaining = Math.max(0, total - current);
  return `-${formatTime(remaining)}`;
}

export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds <= 0) return '0 min';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours} hr ${mins} min`;
  }
  return `${mins} min`;
}

export function formatPlayCount(num?: number): string {
  if (!num) return '0 plays';
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M plays`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(0)}K plays`;
  }
  return `${num} plays`;
}

export function formatListeners(num?: number): string {
  if (!num) return '0 monthly listeners';
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M monthly listeners`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(0)}K monthly listeners`;
  }
  return `${num} monthly listeners`;
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return 'Good morning';
  } else if (hour >= 12 && hour < 17) {
    return 'Good afternoon';
  } else {
    return 'Good evening';
  }
}

/**
 * Validates and extracts a canonical 11-character YouTube video ID
 * from raw IDs, URLs (youtube.com, youtu.be, embed), or search results.
 */
export function extractYouTubeVideoId(input: string | undefined | null): string | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  // Canonical 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  // Standard URLs: youtu.be/ID, youtube.com/watch?v=ID, youtube.com/embed/ID, music.youtube.com/watch?v=ID
  const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([a-zA-Z0-9_-]{11})/);
  if (match && match[1]) {
    return match[1];
  }
  return null;
}
