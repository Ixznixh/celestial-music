import React, { useState } from 'react';
import { Song, RepeatMode } from '../../types';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  Volume1,
  VolumeX,
  Heart,
  ListMusic,
  Mic2,
  Maximize2,
} from 'lucide-react';
import { ArtworkImage } from '../common/ArtworkImage';
import { formatTime } from '../../utils/formatters';

interface DesktopPlayerBarProps {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  isFavorite: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onNext: () => void;
  onPrevious: () => void;
  onSetVolume: (vol: number) => void;
  onToggleMute: () => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onToggleFavorite: () => void;
  onOpenFullPlayer: () => void;
  onOpenQueue?: () => void;
  onOpenLyrics?: () => void;
  queueLength?: number;
}

export const DesktopPlayerBar: React.FC<DesktopPlayerBarProps> = ({
  currentSong,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  shuffle,
  repeat,
  isFavorite,
  onTogglePlay,
  onSeek,
  onNext,
  onPrevious,
  onSetVolume,
  onToggleMute,
  onToggleShuffle,
  onCycleRepeat,
  onToggleFavorite,
  onOpenFullPlayer,
  onOpenQueue,
  onOpenLyrics,
  queueLength = 0,
}) => {
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekVal, setSeekVal] = useState(0);

  if (!currentSong) return null;

  const displayTime = isSeeking ? seekVal : currentTime;
  const progressPercent = duration > 0 ? (displayTime / duration) * 100 : 0;
  const effectiveVol = isMuted ? 0 : volume;

  const renderVolumeIcon = () => {
    if (isMuted || effectiveVol === 0) {
      return <VolumeX className="w-4 h-4 text-neutral-400 hover:text-white" />;
    }
    if (effectiveVol < 0.5) {
      return <Volume1 className="w-4 h-4 text-neutral-300 hover:text-white" />;
    }
    return <Volume2 className="w-4 h-4 text-neutral-300 hover:text-white" />;
  };

  return (
    <footer
      aria-label="Desktop Player Controls"
      className="hidden md:flex fixed bottom-0 inset-x-0 h-20 bg-[#121214]/95 backdrop-blur-2xl border-t border-white/10 z-40 px-3 md:px-5 lg:px-8 select-none shadow-[0_-8px_32px_rgba(0,0,0,0.6)]"
    >
      <div className="w-full max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Track Details */}
        <div className="flex items-center gap-3.5 min-w-0 w-1/4 max-w-xs">
          <div
            onClick={onOpenFullPlayer}
            className="group relative w-12 h-12 rounded-lg overflow-hidden shrink-0 cursor-pointer shadow-md bg-neutral-800 border border-white/10"
          >
            <ArtworkImage
              src={currentSong.artworkUrl}
              fallbackVideoId={currentSong.id}
              alt={currentSong.title}
              rounded="rounded-lg"
              className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-200"
              size="small"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Maximize2 className="w-4 h-4 text-white" />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <h4
              onClick={onOpenFullPlayer}
              className="text-sm font-semibold text-white truncate cursor-pointer hover:underline leading-tight"
            >
              {currentSong.title}
            </h4>
            <p className="text-xs text-neutral-400 truncate mt-0.5 font-normal">
              {currentSong.artist}
            </p>
          </div>

          <button
            onClick={onToggleFavorite}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            className={`p-1.5 rounded-full hover:bg-white/10 transition shrink-0 cursor-pointer ${
              isFavorite ? 'text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.8)]' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-white' : ''}`} />
          </button>
        </div>

        {/* Center: Playback Controls + Scrub Bar */}
        <div className="flex flex-col items-center justify-center flex-1 max-w-xl px-2">
          {/* Controls Row */}
          <div className="flex items-center gap-4 mb-1">
            {/* Shuffle */}
            <button
              onClick={onToggleShuffle}
              aria-label={shuffle ? 'Disable shuffle' : 'Enable shuffle'}
              className={`p-1.5 rounded-full hover:bg-white/10 transition relative ${
                shuffle ? 'text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.8)]' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Shuffle className="w-4 h-4" />
              {shuffle && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,1)]" />
              )}
            </button>

            {/* Previous */}
            <button
              onClick={onPrevious}
              aria-label="Previous track"
              className="p-1.5 rounded-full hover:bg-white/10 text-neutral-300 hover:text-white transition active:scale-95"
            >
              <SkipBack className="w-5 h-5 fill-current" />
            </button>

            {/* Play/Pause Button */}
            <button
              onClick={onTogglePlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="w-9 h-9 rounded-full bg-white hover:bg-neutral-200 text-black flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.5)] hover:shadow-[0_0_22px_rgba(255,255,255,0.75)] transition active:scale-95"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            {/* Next */}
            <button
              onClick={onNext}
              aria-label="Next track"
              className="p-1.5 rounded-full hover:bg-white/10 text-neutral-300 hover:text-white transition active:scale-95"
            >
              <SkipForward className="w-5 h-5 fill-current" />
            </button>

            {/* Repeat */}
            <button
              onClick={onCycleRepeat}
              aria-label={`Repeat mode: ${repeat}`}
              className={`p-1.5 rounded-full hover:bg-white/10 transition relative ${
                repeat !== 'off' ? 'text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.8)]' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {repeat === 'one' ? (
                <Repeat1 className="w-4 h-4" />
              ) : (
                <Repeat className="w-4 h-4" />
              )}
              {repeat !== 'off' && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,1)]" />
              )}
            </button>
          </div>

          {/* Scrub Bar Row */}
          <div className="w-full flex items-center gap-2.5">
            <span className="text-[11px] font-mono text-neutral-400 w-10 text-right select-none">
              {formatTime(displayTime)}
            </span>

            <div className="relative flex-1 flex items-center group cursor-pointer h-4">
              {/* Background Track */}
              <div className="w-full h-1 group-hover:h-1.5 bg-white/20 rounded-full overflow-hidden transition-all relative">
                {/* Progress Fill */}
                <div
                  className="h-full bg-white group-hover:bg-white group-hover:shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Slider Thumb */}
              <div
                className="absolute w-3 h-3 rounded-full bg-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1/2 pointer-events-none"
                style={{ left: `${progressPercent}%` }}
              />

              {/* Native Range Input */}
              <input
                type="range"
                min="0"
                max={duration || 1}
                step="1"
                value={displayTime}
                onMouseDown={() => setIsSeeking(true)}
                onTouchStart={() => setIsSeeking(true)}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setSeekVal(val);
                }}
                onMouseUp={() => {
                  setIsSeeking(false);
                  onSeek(seekVal);
                }}
                onTouchEnd={() => {
                  setIsSeeking(false);
                  onSeek(seekVal);
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                aria-label="Seek timeline"
              />
            </div>

            <span className="text-[11px] font-mono text-neutral-400 w-10 text-left select-none">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Right: Extra Utilities & Volume Slider */}
        <div className="flex items-center justify-end gap-3 min-w-0 w-1/4 max-w-xs">
          {/* Lyrics Button */}
          {onOpenLyrics && (
            <button
              onClick={onOpenLyrics}
              aria-label="View lyrics"
              title="Lyrics"
              className="p-1.5 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition hidden lg:flex"
            >
              <Mic2 className="w-4 h-4" />
            </button>
          )}

          {/* Queue Button */}
          {onOpenQueue && (
            <button
              onClick={onOpenQueue}
              aria-label="Open queue"
              title="Playing Queue"
              className="p-1.5 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition relative"
            >
              <ListMusic className="w-4 h-4" />
              {queueLength > 0 && (
                <span className="absolute -top-1 -right-1 px-1 min-w-3.5 h-3.5 rounded-full bg-white text-[9px] font-bold text-black flex items-center justify-center leading-none">
                  {queueLength > 99 ? '99+' : queueLength}
                </span>
              )}
            </button>
          )}

          {/* Volume Control */}
          <div className="flex items-center gap-2 group">
            <button
              onClick={onToggleMute}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              className="p-1.5 rounded-full hover:bg-white/10 transition"
            >
              {renderVolumeIcon()}
            </button>

            <div className="relative w-20 lg:w-24 h-4 flex items-center cursor-pointer">
              <div className="w-full h-1 group-hover:h-1.5 bg-white/20 rounded-full overflow-hidden transition-all">
                <div
                  className="h-full bg-white group-hover:bg-white rounded-full transition-all"
                  style={{ width: `${effectiveVol * 100}%` }}
                />
              </div>

              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={effectiveVol}
                onChange={(e) => onSetVolume(parseFloat(e.target.value))}
                aria-label="Volume slider"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          </div>

          {/* Maximize / Full Player */}
          <button
            onClick={onOpenFullPlayer}
            aria-label="Open full screen player"
            title="Expand player"
            className="p-1.5 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition ml-1"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </footer>
  );
};
