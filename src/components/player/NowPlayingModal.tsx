import React, { useState, useEffect } from 'react';
import { Song, RepeatMode, LyricsLine, AppSettings } from '../../types';
import { providerManager } from '../../services/providerManager';
import { 
  ChevronDown, 
  Heart, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Shuffle, 
  Repeat, 
  Repeat1, 
  Volume1, 
  Volume2, 
  VolumeX, 
  ListMusic, 
  Mic2,
  Share2,
  Disc,
  Sparkles,
  Sliders,
  Activity,
  Info
} from 'lucide-react';
import { motion, AnimatePresence, PanInfo } from 'motion/react';
import { ArtworkImage } from '../common/ArtworkImage';
import { QueueView } from './QueueView';

type PlayerTab = 'artwork' | 'lyrics' | 'queue';
import { LyricsView } from './LyricsView';
import { formatTime, formatRemainingTime } from '../../utils/formatters';
import { useDominantColor } from '../../hooks/useDominantColor';
import { FluidSlider } from '../common/FluidSlider';
import { EqualizerModal } from '../settings/EqualizerModal';
import { StatsForNerdsModal } from './StatsForNerdsModal';

const Rewind10Icon: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <text x="12" y="15.5" fontSize="7.5" fontWeight="800" fill="currentColor" stroke="none" textAnchor="middle" fontFamily="system-ui, -apple-system, sans-serif">10</text>
  </svg>
);

const Forward10Icon: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <text x="12" y="15.5" fontSize="7.5" fontWeight="800" fill="currentColor" stroke="none" textAnchor="middle" fontFamily="system-ui, -apple-system, sans-serif">10</text>
  </svg>
);

interface NowPlayingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  queue: Song[];
  queueIndex: number;
  userQueue?: Song[];
  suggestionsQueue?: Song[];
  isFavorite: boolean;
  settings?: AppSettings;
  onUpdateSettings?: (settings: Partial<AppSettings>) => void;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onSeekBackward?: () => void;
  onSeekForward?: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSetVolume: (volume: number) => void;
  onToggleMute: () => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onToggleFavorite: (song: Song) => void;
  onSelectTrack: (song: Song, index: number) => void;
  onRemoveFromQueue: (index: number) => void;
  onReorderQueue: (from: number, to: number) => void;
  onSetUpcomingTracks?: (upcoming: Song[]) => void;
  onClearQueue: () => void;
  onClearUpcoming?: () => void;
  onClearUserQueue?: () => void;
  onClearAutoplayQueue?: () => void;
  onLoadMoreSuggestions?: () => void;
  onPlayQueueIndex?: (index: number) => void;
  isLoadingSuggestions?: boolean;
  onNavigateToAlbum?: (albumId: string) => void;
  onNavigateToArtist?: (artistId: string) => void;
}

export const NowPlayingModal: React.FC<NowPlayingModalProps> = ({
  isOpen,
  onClose,
  currentSong,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  shuffle,
  repeat,
  queue,
  queueIndex,
  userQueue,
  suggestionsQueue,
  isFavorite,
  settings,
  onUpdateSettings,
  onTogglePlay,
  onSeek,
  onSeekBackward,
  onSeekForward,
  onNext,
  onPrevious,
  onSetVolume,
  onToggleMute,
  onToggleShuffle,
  onCycleRepeat,
  onToggleFavorite,
  onSelectTrack,
  onRemoveFromQueue,
  onReorderQueue,
  onSetUpcomingTracks,
  onClearQueue,
  onClearUpcoming,
  onClearUserQueue,
  onClearAutoplayQueue,
  onLoadMoreSuggestions,
  onPlayQueueIndex,
  isLoadingSuggestions,
  onNavigateToAlbum,
  onNavigateToArtist,
}) => {
  const [activeTab, setActiveTab] = useState<PlayerTab>('artwork');
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);
  const [fetchedLyrics, setFetchedLyrics] = useState<LyricsLine[] | undefined>(undefined);
  const [isLyricsSynced, setIsLyricsSynced] = useState(true);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  const [isAudioQualityOpen, setIsAudioQualityOpen] = useState(false);
  const [isEqualizerOpen, setIsEqualizerOpen] = useState(false);

  const handleSeekBackward = onSeekBackward || (() => onSeek(Math.max(0, currentTime - 10)));
  const handleSeekForward = onSeekForward || (() => onSeek(Math.min(duration || Infinity, currentTime + 10)));
  const [isLyricsProviderOpen, setIsLyricsProviderOpen] = useState(false);
  const [activeProviderId, setActiveProviderId] = useState('auto');
  const [providerName, setProviderName] = useState('LRCLIB (Auto)');
  const [showStatsForNerds, setShowStatsForNerds] = useState(settings.showStatsForNerds || false);

  // Safety auto-recovery: ensure isScrubbing never permanently locks the progress bar
  useEffect(() => {
    if (isScrubbing) {
      const timer = setTimeout(() => {
        setIsScrubbing(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isScrubbing, scrubValue]);

  // Fetch real synchronized lyrics from backend multi-provider engine when user views lyrics
  const fetchLyricsForCurrentSong = (providerId = activeProviderId) => {
    if (!currentSong) return;
    setIsLoadingLyrics(true);

    const url = `/api/lyrics/${encodeURIComponent(currentSong.id)}?title=${encodeURIComponent(
      currentSong.title
    )}&artist=${encodeURIComponent(currentSong.artist || '')}&duration=${
      currentSong.duration || 210
    }&provider=${encodeURIComponent(providerId)}`;

    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.lines)) {
          setFetchedLyrics(data.lines);
          setIsLyricsSynced(data.isSynced ?? true);
          setProviderName(data.providerName || 'LRCLIB (Auto)');
        } else {
          setFetchedLyrics([]);
          setIsLyricsSynced(false);
        }
      })
      .catch(() => {
        setFetchedLyrics([]);
        setIsLyricsSynced(false);
      })
      .finally(() => {
        setIsLoadingLyrics(false);
      });
  };

  useEffect(() => {
    if (activeTab === 'lyrics' && currentSong) {
      fetchLyricsForCurrentSong(activeProviderId);
    }
  }, [activeTab, currentSong?.id, activeProviderId]);

  // Handle ESC key to dismiss queue or player
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeTab !== 'artwork') {
          setActiveTab('artwork');
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeTab, onClose]);

  if (!currentSong) return null;

  const displayTime = isScrubbing ? scrubValue : currentTime;
  const progressPercent = duration > 0 ? (displayTime / duration) * 100 : 0;
  
  // Dynamically extract dominant colors from current song artwork
  const palette = useDominantColor(
    currentSong?.artworkUrl,
    currentSong?.dominantColor || '#fa233c',
    '#818cf8'
  );
  const dominantColor = palette.primary;
  const secondaryColor = palette.secondary;

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(12);
      } catch {
        // ignore
      }
    }
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setScrubValue(Number(e.target.value));
  };

  const handleSeekStart = () => {
    setIsScrubbing(true);
  };

  const handleSeekEnd = () => {
    setIsScrubbing(false);
    onSeek(scrubValue);
  };

  const toggleTab = (tab: 'lyrics' | 'queue') => {
    setActiveTab((prev) => (prev === tab ? 'artwork' : tab));
  };

  const handleArtworkDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const { offset, velocity } = info;
    const absX = Math.abs(offset.x);
    const absY = Math.abs(offset.y);

    // If vertical downward swipe is dominant -> Close modal
    if (offset.y > 60 || velocity.y > 350) {
      triggerHaptic();
      onClose();
      return;
    }

    // Horizontal swipe -> Change tracks
    if (absX > 40 || Math.abs(velocity.x) > 250) {
      if (offset.x < 0 || velocity.x < -250) {
        // Swipe Left -> Next Track
        triggerHaptic();
        onNext();
      } else if (offset.x > 0 || velocity.x > 250) {
        // Swipe Right -> Previous Track
        triggerHaptic();
        onPrevious();
      }
    }
  };

  return (
    <>
      {/* Dimmed backdrop layer without blur for 120fps fluidity */}
      <motion.div
        key="now-playing-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={onClose}
        className="fixed inset-0 z-40"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          background: `radial-gradient(circle at 50% 30%, rgba(${palette.glowRgb}, 0.22) 0%, rgba(0, 0, 0, 0.9) 100%)`,
        }}
      />

      <motion.div 
        key="now-playing-modal"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 350, mass: 0.7 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        dragSnapToOrigin
        onDragEnd={(_, info) => {
          // Responsive swipe-down threshold with haptic confirmation
          if (info.offset.y > 70 || info.velocity.y > 350) {
            triggerHaptic();
            onClose();
          }
        }}
        style={{ willChange: 'transform' }}
        className="fixed inset-0 z-50 flex flex-col justify-between bg-[#000000] text-white overflow-hidden select-none h-[100dvh] max-h-[100dvh] pt-[max(env(safe-area-inset-top),8px)] pb-[max(env(safe-area-inset-bottom),12px)] shadow-[0_-20px_60px_rgba(0,0,0,0.9)]"
      >
        {/* Top Drag Indicator Area with Apple-Style Handle Pill */}
        <div 
          className="w-full flex items-center justify-center pt-2 pb-1 shrink-0 cursor-grab active:cursor-grabbing touch-none z-10"
          onClick={() => {
            triggerHaptic();
            onClose();
          }}
        >
          <motion.div 
            whileHover={{ scaleX: 1.2, backgroundColor: 'rgba(255,255,255,0.5)' }}
            whileTap={{ scaleX: 1.3, backgroundColor: 'rgba(255,255,255,0.7)' }}
            className="w-10 h-1.5 rounded-full bg-white/35 transition-colors shadow-sm" 
          />
        </div>

      {/* Dynamic Artwork-Tinted Fluid Glass Background */}
      <div 
        className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0" 
        style={{ contain: 'strict' }}
      >
        {/* Deep dark canvas foundation */}
        <div className="absolute inset-0 bg-[#000000]" />
      </div>

      {/* Top bar with dismiss chevron, centered context title, and share button */}
      <header className="relative z-10 px-4 sm:px-6 pt-1.5 pb-1 flex items-center justify-between min-h-[44px] shrink-0">
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={() => {
            if (activeTab !== 'artwork') {
              setActiveTab('artwork');
            } else {
              onClose();
            }
          }}
          aria-label="Minimize player"
          className="p-2 -ml-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition cursor-pointer z-10"
        >
          <ChevronDown className="w-6 h-6 stroke-[2.5]" />
        </motion.button>

        {/* Mathematically Centered Context Title */}
        {!settings.hideSongStatus && (
          <div className="absolute inset-x-14 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center pointer-events-none text-center px-1">
            <span className="text-[10px] sm:text-[11px] font-semibold text-neutral-400 uppercase tracking-widest block leading-tight">
              {activeTab === 'queue' ? 'Queue' : activeTab === 'lyrics' ? 'Lyrics' : 'Playing from'}
            </span>
            <span className="text-xs sm:text-[13px] font-semibold text-neutral-200 truncate max-w-[220px] sm:max-w-[280px] block leading-tight mt-0.5">
              {activeTab === 'queue' ? 'Up Next & Suggestions' : activeTab === 'lyrics' ? currentSong.title : (currentSong.album || currentSong.artist || 'Celestial Music')}
            </span>
          </div>
        )}

        <div className="flex items-center gap-1 z-10">
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => setIsEqualizerOpen(true)}
            aria-label="Equalizer"
            title="Equalizer"
            className={`p-2 rounded-full transition cursor-pointer ${
              settings.equalizerEnabled ? 'text-white bg-white/20' : 'text-neutral-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Sliders className="w-4.5 h-4.5" />
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => setShowStatsForNerds(!showStatsForNerds)}
            aria-label="Stats for Nerds"
            title="Stats for Nerds"
            className={`p-2 rounded-full transition cursor-pointer ${
              showStatsForNerds ? 'text-emerald-400 bg-emerald-500/20' : 'text-neutral-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Activity className="w-4.5 h-4.5" />
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: currentSong.title,
                  text: `Listening to ${currentSong.title} by ${currentSong.artist} on Celestial Music`,
                  url: window.location.href,
                }).catch(() => {});
              }
            }}
            aria-label="Share track"
            className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <Share2 className="w-4.5 h-4.5" />
          </motion.button>
        </div>
      </header>

      {/* Main Content: Artwork, Lyrics, or Queue View */}
      <main className="relative z-10 flex-1 flex flex-col justify-center px-4 sm:px-8 min-h-0 py-1 sm:py-2 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {activeTab === 'lyrics' ? (
            <motion.div 
              key="modal-lyrics-view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="w-full flex-1 h-full min-h-0 rounded-3xl overflow-hidden bg-[#131316] border border-white/10 shadow-2xl relative flex flex-col"
            >
              <LyricsView
                lines={currentSong.lyrics || fetchedLyrics}
                isSynced={isLyricsSynced}
                isLoading={isLoadingLyrics}
                providerName={providerName}
                providerId={activeProviderId}
                currentTime={displayTime}
                isPlaying={isPlaying}
                onSeek={onSeek}
                onOpenProviderModal={() => setIsLyricsProviderOpen(true)}
                syncedLyrics={settings.syncedLyrics ?? true}
                blurUnfocusedLyrics={settings.blurUnfocusedLyrics ?? false}
              />
            </motion.div>
          ) : activeTab === 'queue' ? (
            <motion.div
              key="modal-queue-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              transition={{ duration: 0.2 }}
              className="w-full flex-1 h-full min-h-0 rounded-3xl overflow-hidden bg-[#131316] border border-white/10 shadow-2xl flex flex-col"
            >
              <QueueView
                queue={queue}
                queueIndex={queueIndex}
                currentSong={currentSong}
                userQueue={userQueue}
                suggestionsQueue={suggestionsQueue}
                isLoadingSuggestions={isLoadingSuggestions}
                onSelectTrack={(song, idx) => {
                  if (onPlayQueueIndex) {
                    onPlayQueueIndex(idx);
                  } else {
                    onSelectTrack(song, idx);
                  }
                }}
                onRemoveTrack={onRemoveFromQueue}
                onReorder={onReorderQueue}
                onSetUpcomingTracks={onSetUpcomingTracks}
                onClearQueue={onClearQueue}
                onClearUpcoming={onClearUpcoming}
                onClearUserQueue={onClearUserQueue}
                onClearAutoplayQueue={onClearAutoplayQueue}
                onLoadMoreSuggestions={onLoadMoreSuggestions}
                onClose={() => setActiveTab('artwork')}
              />
            </motion.div>
          ) : (
            <motion.div 
              key="modal-artwork-view"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center justify-center my-auto py-1 sm:py-2 touch-none"
            >
              <motion.div 
                drag
                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                dragElastic={{ top: 0.1, bottom: 0.45, left: 0.35, right: 0.35 }}
                onDragEnd={handleArtworkDragEnd}
                whileTap={{ scale: 0.98 }}
                animate={{
                  scale: isPlaying ? 1 : 0.92,
                  boxShadow: isPlaying 
                    ? `0 24px 60px -10px rgba(${palette.glowRgb}, 0.5), 0 12px 30px -8px rgba(0,0,0,0.85)` 
                    : `0 10px 30px -8px rgba(${palette.glowRgb}, 0.25), 0 6px 18px -6px rgba(0,0,0,0.5)`
                }}
                transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                className="w-full max-w-[min(72vw,300px,34vh)] aspect-square rounded-3xl overflow-hidden cursor-grab active:cursor-grabbing relative"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={`artwork-${currentSong.id}`}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={{ duration: 0.22 }}
                    className="w-full h-full"
                  >
                    <ArtworkImage
                      src={currentSong.artworkUrl}
                      fallbackVideoId={currentSong.id}
                      alt={currentSong.title}
                      rounded="rounded-3xl"
                      className="w-full h-full border border-white/10 ring-1 ring-white/5 object-cover"
                      size="full"
                    />
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Controls Area - Auto-scaled for all phone heights */}
      <footer className="relative z-10 px-5 sm:px-8 pb-2 sm:pb-4 flex flex-col space-y-3 sm:space-y-4 md:space-y-5 max-w-lg mx-auto w-full shrink-0">
        {/* Centered Track Title & Artist Info with Balanced Heart Action */}
        <div className="flex items-center justify-between gap-2">
          {/* Left spacer for optical center balance */}
          <div className="w-9 sm:w-11 shrink-0" />

          {/* Centered Song Title & Artist info */}
          <div className="min-w-0 flex-1 text-center">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`track-info-${currentSong.id}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
              >
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-white truncate px-1">
                  {currentSong.title}
                </h2>
                <div className="flex items-center justify-center gap-1.5 mt-0.5 px-1">
                  <button
                    onClick={() => {
                      onClose();
                      onNavigateToArtist?.(currentSong.artistId);
                    }}
                    className="text-xs sm:text-sm text-neutral-300 hover:text-white transition font-medium truncate cursor-pointer"
                  >
                    {currentSong.artist}
                  </button>
                  {currentSong.album && (
                    <>
                      <span className="text-neutral-500 text-xs">•</span>
                      <button
                        onClick={() => {
                          onClose();
                          onNavigateToAlbum?.(currentSong.albumId);
                        }}
                        className="text-xs text-neutral-400 hover:text-neutral-200 transition truncate cursor-pointer max-w-[120px] sm:max-w-[160px]"
                      >
                        {currentSong.album}
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Action button: Heart Favorite */}
          <div className="shrink-0 flex items-center justify-end">
            <motion.button
              whileTap={{ scale: 0.75 }}
              animate={isFavorite ? { scale: [1, 1.35, 0.9, 1] } : { scale: 1 }}
              transition={{ duration: 0.35 }}
              onClick={() => onToggleFavorite(currentSong)}
              aria-label={isFavorite ? 'Remove favorite' : 'Add favorite'}
              className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition cursor-pointer"
            >
              <Heart 
                className={`w-5 h-5 sm:w-6 sm:h-6 transition-colors ${
                  isFavorite ? 'fill-white text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'text-neutral-400 hover:text-white'
                }`} 
              />
            </motion.button>
          </div>
        </div>

            {/* Scrub Scrubber Bar with Precision Touch Isolation */}
            <div 
              className="space-y-1" 
              onClick={(e) => e.stopPropagation()} 
              onPointerDown={(e) => e.stopPropagation()}
            >
              <FluidSlider
                value={displayTime}
                min={0}
                max={duration || 100}
                step={0.5}
                onChange={(val) => {
                  setIsScrubbing(true);
                  setScrubValue(val);
                }}
                onChangeEnd={(finalVal) => {
                  setIsScrubbing(false);
                  onSeek(finalVal);
                }}
                ariaLabel="Track progress scrubber"
                size="md"
              />
              <div className="flex justify-between text-[11px] font-medium text-neutral-400 tabular-nums px-0.5">
                <span>{formatTime(displayTime)}</span>
                <span>{formatRemainingTime(displayTime, duration)}</span>
              </div>
            </div>

            {/* Primary Playback Controls */}
            <div className="flex items-center justify-between px-3 sm:px-6 max-w-sm mx-auto w-full">
              {/* Shuffle button */}
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={onToggleShuffle}
                aria-label="Shuffle"
                className={`p-2 rounded-full transition ${
                  shuffle ? 'text-white bg-white/15 border border-white/30 shadow-[0_0_12px_rgba(255,255,255,0.35)]' : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Shuffle className="w-5 h-5 stroke-[2.2]" />
              </motion.button>

              {/* Previous button */}
              <motion.button
                whileTap={{ scale: 0.82 }}
                onClick={onPrevious}
                aria-label="Previous track"
                className="p-2 sm:p-2.5 rounded-full text-white hover:bg-white/10 transition"
              >
                <SkipBack className="w-7 h-7 sm:w-8 sm:h-8 fill-current" />
              </motion.button>

              {/* Play / Pause button with spring pop and high contrast white accent glow */}
              <motion.button
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.88 }}
                onClick={onTogglePlay}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white text-black flex items-center justify-center relative transition-shadow duration-300 shadow-[0_0_24px_rgba(255,255,255,0.65),0_0_8px_rgba(255,255,255,0.45)]"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isPlaying ? (
                    <motion.div
                      key="pause-icon"
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.6, opacity: 0 }}
                      transition={{ duration: 0.12 }}
                    >
                      <Pause className="w-6 h-6 sm:w-7 sm:h-7 fill-current" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="play-icon"
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.6, opacity: 0 }}
                      transition={{ duration: 0.12 }}
                    >
                      <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-current ml-0.5 sm:ml-1" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>

              {/* Next button */}
              <motion.button
                whileTap={{ scale: 0.82 }}
                onClick={onNext}
                aria-label="Next track"
                className="p-2 sm:p-2.5 rounded-full text-white hover:bg-white/10 transition"
              >
                <SkipForward className="w-7 h-7 sm:w-8 sm:h-8 fill-current" />
              </motion.button>

              {/* Repeat mode button */}
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={onCycleRepeat}
                aria-label={`Repeat mode: ${repeat}`}
                className={`p-2 rounded-full transition ${
                  repeat !== 'off' ? 'text-white bg-white/15 border border-white/30 shadow-[0_0_12px_rgba(255,255,255,0.35)]' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {repeat === 'one' ? (
                  <Repeat1 className="w-5 h-5 stroke-[2.4]" />
                ) : (
                  <Repeat className="w-5 h-5 stroke-[2.2]" />
                )}
              </motion.button>
            </div>

            {/* Volume Slider */}
            {!settings.hideVolumeBar && (
              <div 
                className="flex items-center gap-3 px-3 py-1 w-full select-none"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <motion.button 
                  whileTap={{ scale: 0.85 }}
                  onClick={onToggleMute}
                  aria-label={isMuted ? "Unmute" : "Mute"}
                  className="shrink-0 p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition flex items-center justify-center cursor-pointer"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4 text-white" />
                  ) : (
                    <Volume1 className="w-4 h-4" />
                  )}
                </motion.button>

                <div className="relative flex-1 min-w-0 flex items-center">
                  <FluidSlider
                    value={isMuted ? 0 : volume}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(val) => {
                      if (isMuted) onToggleMute();
                      onSetVolume(val);
                    }}
                    onChangeEnd={(val) => {
                      if (isMuted) onToggleMute();
                      onSetVolume(val);
                    }}
                    ariaLabel="Volume slider"
                    size="sm"
                  />
                </div>

                <motion.button 
                  whileTap={{ scale: 0.85 }}
                  onClick={() => {
                    if (isMuted) onToggleMute();
                    onSetVolume(1);
                  }}
                  aria-label="Set maximum volume"
                  className="shrink-0 p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition flex items-center justify-center cursor-pointer"
                >
                  <Volume2 className="w-4 h-4" />
                </motion.button>
              </div>
            )}

            {/* Footer Sub-actions: Lyrics, Audio Source, Queue */}
            <div className="flex items-center justify-around pt-2 border-t border-white/5">
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => toggleTab('lyrics')}
                aria-label="Toggle lyrics"
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
                  activeTab === 'lyrics' ? 'bg-white text-black shadow-md' : 'text-neutral-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <Mic2 className="w-4 h-4" />
                <span>Lyrics</span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => {
                  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                    try { navigator.vibrate(10); } catch {}
                  }
                  setIsAudioQualityOpen(true);
                }}
                aria-label="Open Audio Quality and Lossless Format Settings"
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/30 transition-all cursor-pointer shadow-[0_0_10px_rgba(255,255,255,0.18)] active:scale-95"
              >
                <Disc className="w-3.5 h-3.5 text-white animate-spin" style={{ animationDuration: isPlaying ? '3s' : '8s' }} />
                <span>
                  {settings.audioQuality === 'hires' ? 'Hi-Res • 24-bit' : settings.audioQuality === 'high' ? 'High • 320k' : settings.audioQuality === 'normal' ? 'Standard • 160k' : 'Lossless • 24-bit'}
                </span>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => toggleTab('queue')}
                aria-label="Toggle Queue"
                className={`relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
                  activeTab === 'queue' ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.4)]' : 'text-neutral-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <ListMusic className="w-4 h-4" />
                <span>Queue</span>
              </motion.button>
            </div>
          </footer>
        </motion.div>

        <EqualizerModal
          isOpen={isEqualizerOpen}
          onClose={() => setIsEqualizerOpen(false)}
          settings={settings}
          onUpdateSettings={onUpdateSettings}
        />

        <StatsForNerdsModal
          isOpen={showStatsForNerds}
          onClose={() => setShowStatsForNerds(false)}
          currentSong={currentSong}
          playbackState={{
            isPlaying,
            currentTime,
            duration,
            volume,
            isMuted,
            isBuffering: false,
            isLoadingSuggestions: false,
            queue,
            queueIndex: 0,
            userQueue: [],
            suggestionsQueue: [],
            shuffle,
            repeat,
            error: null,
            currentSong,
          }}
        />
    </>
  );
};
