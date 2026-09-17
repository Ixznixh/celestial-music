/**
 * Utility functions for normalizing and formatting raw YouTube.js data
 */

export const COLOR_PALETTES = [
  { dominant: '#4f46e5', accent: '#ec4899' },
  { dominant: '#7c3aed', accent: '#06b6d4' },
  { dominant: '#059669', accent: '#3b82f6' },
  { dominant: '#e11d48', accent: '#fbbf24' },
  { dominant: '#d97706', accent: '#ef4444' },
  { dominant: '#0284c7', accent: '#34d399' },
  { dominant: '#8b5cf6', accent: '#f43f5e' },
  { dominant: '#0d9488', accent: '#f59e0b' },
  { dominant: '#6366f1', accent: '#10b981' },
];

export function getPalette(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % COLOR_PALETTES.length;
  return COLOR_PALETTES[idx];
}

export function parseDuration(duration: any): number {
  if (!duration) return 210;
  if (typeof duration === 'number') return duration;
  if (typeof duration.seconds === 'number') return duration.seconds;
  if (typeof duration.text === 'string') {
    const parts = duration.text.split(':').map((p: string) => parseInt(p, 10));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return parts[0] * 60 + parts[1];
    }
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
  }
  return 210;
}

export function getBestThumbnail(thumbnails: any, fallback: string = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80'): string {
  if (!thumbnails) return fallback;
  let url = '';
  if (Array.isArray(thumbnails) && thumbnails.length > 0) {
    const sorted = [...thumbnails].sort((a, b) => (b.width || 0) - (a.width || 0));
    url = sorted[0]?.url || '';
  } else if (typeof thumbnails === 'object' && thumbnails.url) {
    url = thumbnails.url;
  }
  if (!url) return fallback;
  if (url.startsWith('//')) url = `https:${url}`;

  // Upgrade Google/YouTube user content to high-resolution (800x800 crystal clear)
  if (url.includes('googleusercontent.com') || url.includes('ggpht.com')) {
    url = url.replace(/=w\d+-h\d+[^?&#]*/g, '=w800-h800-l90-rj');
    url = url.replace(/=s\d+[^?&#]*/g, '=s800-c-k-c0x00ffffff-no-rj');
  }

  // Remove downsampling sqp parameters from YouTube thumbnail URLs to ensure full quality
  if (url.includes('i.ytimg.com')) {
    url = url.replace(/[?&]sqp=[^&#]*/g, '').replace(/[?&]rs=[^&#]*/g, '');
    url = url.replace(/\?&/g, '?').replace(/[?&]$/, '');
  }

  return url;
}

export function getText(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val.text === 'string') return val.text;
  if (Array.isArray(val.runs)) {
    return val.runs.map((r: any) => r.text || '').join('');
  }
  return String(val);
}
