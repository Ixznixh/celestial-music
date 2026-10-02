import React, { useState } from 'react';
import { ListMusic, Play, Music } from 'lucide-react';
import { ArtworkImage } from './ArtworkImage';

interface PlaylistThumbnailProps {
  artworkUrl?: string;
  collageArtworks?: string[];
  trackCount?: number;
  title: string;
  className?: string;
  rounded?: string;
  onPlay?: () => void;
  showPlayButton?: boolean;
  showBadge?: boolean;
  size?: 'small' | 'medium' | 'large' | 'full';
}

export const PlaylistThumbnail: React.FC<PlaylistThumbnailProps> = ({
  artworkUrl,
  collageArtworks,
  trackCount,
  title,
  className = 'w-full aspect-square',
  rounded = 'rounded-xl',
  onPlay,
  showPlayButton = true,
  showBadge = true,
  size = 'medium',
}) => {
  const [imgError, setImgError] = useState(false);

  // Check if we have 4 distinct artworks for a YouTube 2x2 collage
  const hasCollage = collageArtworks && collageArtworks.length >= 4;

  return (
    <div
      className={`relative overflow-hidden group shadow-md transition-all duration-300 ${rounded} ${className} bg-neutral-900 border border-white/5 select-none`}
    >
      {/* Background/Art Content */}
      {hasCollage && !imgError ? (
        <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
          {collageArtworks.slice(0, 4).map((art, idx) => (
            <div key={idx} className="w-full h-full relative overflow-hidden bg-neutral-800">
              <img
                src={art}
                alt=""
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            </div>
          ))}
        </div>
      ) : artworkUrl && !imgError ? (
        <ArtworkImage
          src={artworkUrl}
          alt={title}
          size={size}
          rounded={rounded}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-neutral-800 via-neutral-850 to-neutral-900 text-neutral-400">
          <ListMusic className="w-10 h-10 stroke-[1.5] text-rose-500/80 mb-1" />
          <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider">Playlist</span>
        </div>
      )}

      {/* Subtle vignette / dark gradient overlay at bottom for YouTube aesthetic */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10 pointer-events-none opacity-80 group-hover:opacity-60 transition-opacity" />

      {/* Signature YouTube Playlist Badge Overlay (bottom-right / bottom bar) */}
      {showBadge && (trackCount !== undefined && trackCount > 0) && (
        <div className="absolute bottom-1.5 right-1.5 z-10 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-white/10 text-white shadow-lg pointer-events-none transition-transform duration-200 group-hover:scale-95">
          <ListMusic className="w-3 h-3 text-white/90 shrink-0" />
          <span className="text-[10px] font-bold tracking-tight text-white/95">
            {trackCount} {trackCount === 1 ? 'track' : 'tracks'}
          </span>
        </div>
      )}

      {/* Hover Play Button (YouTube Music / Spotify style) */}
      {showPlayButton && onPlay && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlay();
          }}
          aria-label={`Play ${title}`}
          className="absolute right-3 bottom-3 z-20 w-10 h-10 rounded-full bg-white text-black hover:bg-neutral-100 hover:scale-105 active:scale-95 flex items-center justify-center shadow-[0_4px_16px_rgba(0,0,0,0.6)] opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 cursor-pointer"
        >
          <Play className="w-5 h-5 fill-black text-black ml-0.5" />
        </button>
      )}
    </div>
  );
};
