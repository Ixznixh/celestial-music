import React, { useRef } from 'react';
import { Song } from '../../types';
import { Play, Pause, SkipBack, SkipForward, X } from 'lucide-react';
import { motion, AnimatePresence, PanInfo } from 'motion/react';
import { ArtworkImage } from '../common/ArtworkImage';

interface MiniPlayerProps {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isOpen?: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrevious?: () => void;
  onOpenFullPlayer: () => void;
  onClose?: () => void;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({
  currentSong,
  isPlaying,
  currentTime,
  duration,
  isOpen = true,
  onTogglePlay,
  onNext,
  onPrevious,
  onOpenFullPlayer,
  onClose,
}) => {
  const isDraggingRef = useRef(false);
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const shouldShow = Boolean(currentSong && isOpen);

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(12);
      } catch {
        // ignore
      }
    }
  };

  const handleDragStart = () => {
    isDraggingRef.current = true;
  };

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const { offset, velocity } = info;
    const absX = Math.abs(offset.x);
    const absY = Math.abs(offset.y);

    // Prioritize swipe up to expand if upward motion is detected
    if (offset.y < -35 || velocity.y < -300) {
      triggerHaptic();
      onOpenFullPlayer();
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 50);
      return;
    }

    // Horizontal swipe for track navigation
    if (absX > 40 || Math.abs(velocity.x) > 300) {
      if (offset.x < 0 || velocity.x < -300) {
        // Swipe Left -> Next Track
        triggerHaptic();
        onNext();
      } else if (offset.x > 0 || velocity.x > 300) {
        // Swipe Right -> Previous Track
        triggerHaptic();
        if (onPrevious) {
          onPrevious();
        } else {
          onNext();
        }
      }
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 50);
      return;
    }

    // Reset dragging flag after slight delay so click doesn't misfire
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);
  };

  const handleClick = () => {
    if (!isDraggingRef.current) {
      onOpenFullPlayer();
    }
  };

  return (
    <AnimatePresence mode="wait">
      {shouldShow && currentSong && (
        <motion.aside 
          key="mini-player"
          initial={{ y: 55, opacity: 0, scale: 0.96, filter: 'blur(4px)' }}
          animate={{ y: 0, opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ y: 40, opacity: 0, scale: 0.96, filter: 'blur(4px)', transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] } }}
          transition={{ 
            type: 'spring', 
            damping: 28, 
            stiffness: 340, 
            mass: 0.7,
            opacity: { duration: 0.25, ease: 'easeOut' },
            filter: { duration: 0.22, ease: 'easeOut' }
          }}
          aria-label="Audio Mini Player"
          className="fixed z-50 inset-x-3 sm:inset-x-6 select-none pointer-events-none w-auto max-w-md sm:max-w-xl mx-auto bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:hidden"
        >
          <div className="pointer-events-auto">
            <motion.div 
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.35, bottom: 0.05 }}
              dragSnapToOrigin
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onClick={handleClick}
              whileTap={{ scale: 0.985 }}
              className="relative overflow-hidden rounded-2xl bg-[#1c1c1e]/94 hover:bg-[#222224] border border-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.8)] backdrop-blur-2xl transition-colors cursor-pointer"
              style={{ willChange: 'transform' }}
            >
              {/* Top micro drag handle pill */}
              <div className="w-8 h-0.5 rounded-full bg-white/25 mx-auto mt-1.5 -mb-1 shrink-0" />

              <div className="flex items-center justify-between p-2.5 px-3.5 sm:px-4 md:py-3 md:px-5">
                {/* Artwork + Title with smooth key animation */}
                <div className="flex items-center gap-3 md:gap-3.5 min-w-0 flex-1 pr-2">
                  <motion.div
                    key={`artwork-${currentSong.id}`}
                    initial={{ scale: 0.88, opacity: 0.7 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="shrink-0"
                  >
                    <ArtworkImage
                      src={currentSong.artworkUrl}
                      fallbackVideoId={currentSong.id}
                      alt={currentSong.title}
                      rounded="rounded-xl"
                      className="w-11 h-11 md:w-12 md:h-12 rounded-xl shadow-md border border-white/10 object-cover"
                      size="small"
                    />
                  </motion.div>

                  <div className="min-w-0 flex-1">
                    <motion.p 
                      key={`title-${currentSong.id}`}
                      initial={{ opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18 }}
                      className="text-sm md:text-base font-bold text-white truncate leading-tight"
                    >
                      {currentSong.title}
                    </motion.p>
                    <motion.p 
                      key={`artist-${currentSong.id}`}
                      initial={{ opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, delay: 0.03 }}
                      className="text-xs md:text-sm text-neutral-400 truncate mt-0.5 leading-tight font-medium"
                    >
                      {currentSong.artist}
                    </motion.p>
                  </div>
                </div>

                {/* Controls (stop propagation so dragging on buttons triggers actions instead) */}
                <div 
                  className="flex items-center gap-2 md:gap-3 shrink-0" 
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {onPrevious && (
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={onPrevious}
                      aria-label="Previous track"
                      className="p-1.5 md:p-2 rounded-full hover:bg-white/10 text-white transition flex items-center justify-center cursor-pointer"
                    >
                      <SkipBack className="w-5 h-5 md:w-6 md:h-6 fill-white text-white" />
                    </motion.button>
                  )}

                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={onTogglePlay}
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                    className="p-1.5 md:p-2 rounded-full hover:bg-white/10 text-white transition flex items-center justify-center cursor-pointer"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {isPlaying ? (
                        <motion.div key="pause" initial={{ scale: 0.6 }} animate={{ scale: 1 }}>
                          <Pause className="w-5 h-5 md:w-6 md:h-6 fill-white text-white" />
                        </motion.div>
                      ) : (
                        <motion.div key="play" initial={{ scale: 0.6 }} animate={{ scale: 1 }}>
                          <Play className="w-5 h-5 md:w-6 md:h-6 fill-white text-white ml-0.5" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>

                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={onNext}
                    aria-label="Next track"
                    className="p-1.5 md:p-2 rounded-full hover:bg-white/10 text-white transition flex items-center justify-center cursor-pointer"
                  >
                    <SkipForward className="w-5 h-5 md:w-6 md:h-6 fill-white text-white" />
                  </motion.button>

                  {onClose && (
                    <button
                      onClick={onClose}
                      aria-label="Close Mini Player"
                      className="p-1.5 md:p-2 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition ml-0.5 cursor-pointer"
                    >
                      <X className="w-4 h-4 md:w-5 md:h-5 stroke-[2]" />
                    </button>
                  )}
                </div>
              </div>

              {/* White Progress Bar Line */}
              <div className="w-full h-[3px] md:h-[4px] bg-white/10">
                <div 
                  className="h-full bg-white transition-[width] duration-150 shadow-[0_0_8px_rgba(255,255,255,0.85)]"
                  style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                />
              </div>
            </motion.div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
