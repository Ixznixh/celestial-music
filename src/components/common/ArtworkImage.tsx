import React, { useState, useEffect, useMemo } from 'react';
import { Music } from 'lucide-react';

interface ArtworkImageProps {
  src?: string;
  alt: string;
  className?: string;
  aspectRatio?: 'square' | 'wide' | 'avatar';
  rounded?: string;
  fallbackVideoId?: string;
  size?: 'small' | 'medium' | 'large' | 'full';
}

/**
 * Dynamically adjusts artwork resolution based on placement (from high-density 240px up to 800px crystal clear)
 * ensuring sharp visuals on all Retina & mobile screens without blurry compression artifacts.
 */
export function upgradeArtworkUrl(url?: string, size: 'small' | 'medium' | 'large' | 'full' = 'medium'): string | undefined {
  if (!url) return url;
  let clean = url.startsWith('//') ? `https:${url}` : url;

  const dim = size === 'small' ? 320 : size === 'medium' ? 500 : 800;

  // Upgrade Google/YouTube user content to crystal clear resolution
  if (clean.includes('googleusercontent.com') || clean.includes('ggpht.com')) {
    clean = clean.replace(/=w\d+-h\d+[^?&#]*/g, `=w${dim}-h${dim}-l90-rj`);
    clean = clean.replace(/=s\d+[^?&#]*/g, `=s${dim}-c-k-c0x00ffffff-no-rj`);
  }

  // Remove aggressive downsampling parameters from YouTube thumbnails
  if (clean.includes('i.ytimg.com')) {
    clean = clean.replace(/[?&]sqp=[^&#]*/g, '').replace(/[?&]rs=[^&#]*/g, '');
    clean = clean.replace(/\?&/g, '?').replace(/[?&]$/, '');

    // Upgrade low-res thumbnail variants to crisp HD
    const match = clean.match(/\/vi(?:_webp)?\/([a-zA-Z0-9_-]{11})\//);
    if (match && match[1]) {
      const vidId = match[1];
      if (clean.includes('/default.jpg') || clean.includes('/mqdefault.jpg') || clean.includes('/hqdefault.jpg')) {
        clean = `https://i.ytimg.com/vi/${vidId}/maxresdefault.jpg`;
      }
    }
  }

  return clean;
}

export const ArtworkImage: React.FC<ArtworkImageProps> = ({
  src,
  alt,
  className = '',
  aspectRatio = 'square',
  rounded = 'rounded-xl',
  fallbackVideoId,
  size = 'medium',
}) => {
  // Upgraded source based on optimal requested size
  const optimizedSrc = useMemo(() => upgradeArtworkUrl(src, size as 'small' | 'medium' | 'large' | 'full'), [src, size]);

  // Stage 0: Direct maxres/HD src, Stage 1: sddefault (640x480), Stage 2: hqdefault (480x360), Stage 3: /api/image-proxy, Stage 4: placeholder
  const [stage, setStage] = useState<number>(0);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    setStage(0);
    setIsLoaded(false);
  }, [optimizedSrc]);

  // Extract video ID from URL or fallback prop
  const videoId = useMemo(() => {
    if (fallbackVideoId) return fallbackVideoId;
    if (!src && !optimizedSrc) return null;
    const candidate = src || optimizedSrc || '';
    const match = candidate.match(/(?:vi\/|v=|\/)([a-zA-Z0-9_-]{11})(?:\/|\.|\?|$)/);
    return match ? match[1] : null;
  }, [src, optimizedSrc, fallbackVideoId]);

  // Determine current image URL based on fallback stage
  const currentSrc = useMemo(() => {
    if (!optimizedSrc && !videoId) return null;

    if (stage === 0) {
      return optimizedSrc;
    }
    if (stage === 1 && videoId) {
      return `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`;
    }
    if (stage === 2 && videoId) {
      return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    }
    if (stage === 3 && optimizedSrc) {
      return `/api/image-proxy?url=${encodeURIComponent(optimizedSrc)}`;
    }
    return null;
  }, [optimizedSrc, stage, videoId]);

  const handleError = () => {
    if (stage === 0 && videoId) {
      // If maxres fails (e.g. 404 for 360p video), try sddefault (640x480)
      setStage(1);
    } else if (stage === 1 && videoId) {
      // Try hqdefault (480x360)
      setStage(2);
    } else if (stage < 3 && optimizedSrc) {
      // Try image proxy
      setStage(3);
    } else {
      // All stages failed -> show placeholder
      setStage(4);
    }
  };

  const aspectClass =
    aspectRatio === 'square'
      ? 'aspect-square'
      : aspectRatio === 'wide'
      ? 'aspect-16/9'
      : 'aspect-square rounded-full';

  const showPlaceholder = !currentSrc || stage === 4;

  return (
    <div
      className={`relative overflow-hidden bg-neutral-900 shadow-sm select-none ${aspectClass} ${
        aspectRatio === 'avatar' ? 'rounded-full' : rounded
      } ${className}`}
    >
      {/* Background musical note placeholder */}
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900 text-neutral-600 pointer-events-none">
        <Music className="h-2/5 w-2/5 opacity-40" />
      </div>

      {/* Actual image layer */}
      {currentSrc && !showPlaceholder && (
        <img
          key={`${currentSrc}-${stage}`}
          src={currentSrc}
          alt={alt}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={handleError}
          onLoad={() => setIsLoaded(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
            isLoaded ? 'opacity-100' : 'opacity-90'
          }`}
        />
      )}
    </div>
  );
};


