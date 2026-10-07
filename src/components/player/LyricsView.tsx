import React, { useRef, useEffect, useState } from 'react';
import { LyricsLine } from '../../types';
import { Sparkles, Loader2, RotateCcw, Plus, Minus, ChevronDown, Sliders } from 'lucide-react';

interface LyricsViewProps {
  lines?: LyricsLine[];
  isSynced?: boolean;
  isLoading?: boolean;
  providerName?: string;
  providerId?: string;
  currentTime: number;
  isPlaying?: boolean;
  onSeek: (time: number) => void;
  onOpenProviderModal?: () => void;
  syncedLyrics?: boolean;
  blurUnfocusedLyrics?: boolean;
  lowPowerMode?: boolean;
}

export const LyricsView: React.FC<LyricsViewProps> = ({
  lines = [],
  isSynced = true,
  isLoading = false,
  providerName = 'LRCLIB (Auto)',
  providerId = 'auto',
  currentTime,
  isPlaying = false,
  onSeek,
  onOpenProviderModal,
  syncedLyrics = true,
  blurUnfocusedLyrics = false,
  lowPowerMode = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const [userIsScrolling, setUserIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<any>(null);
  const [syncOffset, setSyncOffset] = useState<number>(0); // Sync offset in seconds
  const [showSyncControl, setShowSyncControl] = useState(false);

  // High-frequency 60fps smooth interpolated time tracking
  const [smoothTime, setSmoothTime] = useState<number>(currentTime);
  const lastTimeRef = useRef<number>(currentTime);
  const lastPerfRef = useRef<number>(performance.now());
  const rafRef = useRef<number | null>(null);

  // Update anchor time whenever currentTime prop updates from player
  useEffect(() => {
    lastTimeRef.current = currentTime;
    lastPerfRef.current = performance.now();
    setSmoothTime(currentTime);
  }, [currentTime]);

  // Interpolate 60fps smooth time while playing, but halt completely in Low Power Mode to save battery
  useEffect(() => {
    if (!isPlaying || lowPowerMode) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const updateSmoothTime = () => {
      const now = performance.now();
      const deltaSec = (now - lastPerfRef.current) / 1000;
      const interpolated = lastTimeRef.current + deltaSec;
      setSmoothTime(interpolated);
      rafRef.current = requestAnimationFrame(updateSmoothTime);
    };

    rafRef.current = requestAnimationFrame(updateSmoothTime);
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying, lowPowerMode]);

  // Effective playback time with user-configured sync offset
  const effectiveTime = Math.max(0, (lowPowerMode ? currentTime : smoothTime) + syncOffset);

  // Find the active lyric line index
  let activeIndex = -1;
  if (lines.length > 0) {
    for (let i = 0; i < lines.length; i++) {
      if (effectiveTime >= lines[i].time) {
        activeIndex = i;
      } else {
        break;
      }
    }
  }

  // Handle user manual scrolling
  const handleScroll = () => {
    setUserIsScrolling(true);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      setUserIsScrolling(false);
    }, 3200);
  };

  // Smooth scroll active line to center
  useEffect(() => {
    if (userIsScrolling || activeIndex < 0) return;

    if (activeLineRef.current && containerRef.current) {
      const container = containerRef.current;
      const activeEl = activeLineRef.current;

      const containerHeight = container.clientHeight;
      const activeTop = activeEl.offsetTop;
      const activeHeight = activeEl.clientHeight;

      const targetScrollTop = activeTop - containerHeight / 2 + activeHeight / 2;

      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth',
      });
    }
  }, [activeIndex, userIsScrolling]);

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 text-neutral-400 select-none">
        <Loader2 className="w-8 h-8 mb-3 text-rose-500 animate-spin opacity-80" />
        <h4 className="font-medium text-sm text-neutral-300">Synchronizing lyrics...</h4>
        <p className="text-xs text-neutral-500 mt-1">Searching best lyrics provider</p>
      </div>
    );
  }

  // Empty state
  if (!lines || lines.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 text-neutral-400 select-none space-y-3">
        <Sparkles className="w-10 h-10 text-neutral-500 opacity-60" />
        <h4 className="font-semibold text-base text-neutral-300">Lyrics aren't available for this song.</h4>
        
        {onOpenProviderModal && (
          <button
            onClick={onOpenProviderModal}
            className="px-4 py-2 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold hover:bg-rose-500/30 transition cursor-pointer flex items-center gap-1.5"
          >
            <Sliders className="w-3.5 h-3.5" />
            Switch Lyrics Provider
          </button>
        )}
      </div>
    );
  }

  const isHeaderLine = (text: string) => {
    return /^\[(Verse|Chorus|Bridge|Intro|Outro|Hook|Refrain|Pre-Chorus|Tag)[^\]]*\]$/i.test(text) ||
      /^\((Verse|Chorus|Bridge|Intro|Outro|Hook|Refrain|Pre-Chorus|Tag)[^)]*\)$/i.test(text);
  };

  return (
    <div className="h-full flex flex-col relative select-none">
      {/* Top Sync & Provider Control Bar */}
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-white/10 bg-[#16161a] shrink-0 z-20">
        {/* Provider Selector Button */}
        <button
          onClick={onOpenProviderModal}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold text-white transition cursor-pointer max-w-[210px] truncate"
          title="Change Lyrics Provider"
        >
          <Sparkles className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span className="truncate">{providerName}</span>
          <ChevronDown className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
        </button>

        <div className="flex items-center gap-1.5">
          {syncOffset !== 0 && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
              {syncOffset > 0 ? `+${syncOffset.toFixed(1)}s` : `${syncOffset.toFixed(1)}s`}
            </span>
          )}

          <button
            onClick={() => setShowSyncControl(!showSyncControl)}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition border cursor-pointer ${
              showSyncControl || syncOffset !== 0
                ? 'bg-white text-black border-white'
                : 'bg-white/10 text-neutral-300 border-white/10 hover:bg-white/20'
            }`}
          >
            Sync Adjust
          </button>
        </div>
      </div>

      {/* Sync Control Toolbar Drawer */}
      {showSyncControl && (
        <div className="p-3 bg-neutral-900/95 border-b border-white/15 flex items-center justify-between gap-2 z-20 text-xs shadow-lg animate-in slide-in-from-top-2 duration-150">
          <span className="text-neutral-300 font-medium">Timing Sync Offset:</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSyncOffset((prev) => Math.max(-5, parseFloat((prev - 0.5).toFixed(1))))}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold cursor-pointer"
              title="-0.5s earlier"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-white w-12 text-center font-bold">
              {syncOffset > 0 ? `+${syncOffset.toFixed(1)}s` : `${syncOffset.toFixed(1)}s`}
            </span>
            <button
              onClick={() => setSyncOffset((prev) => Math.min(5, parseFloat((prev + 0.5).toFixed(1))))}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold cursor-pointer"
              title="+0.5s later"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setSyncOffset(0)}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-neutral-400 hover:text-white cursor-pointer ml-1"
              title="Reset offset"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Lyrics Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto no-scrollbar py-8 px-6 text-left select-none relative scroll-smooth flex flex-col"
      >
        <div className="space-y-6 flex-1 pt-4">
          {lines.map((line, idx) => {
            const isActive = idx === activeIndex;
            const isPast = idx < activeIndex;

            if (isHeaderLine(line.text)) {
              const headerTitle = line.text.replace(/[\[\]()]/g, '');
              return (
                <div key={`header-${idx}`} className="pt-4 pb-1">
                  <span className="inline-block text-[11px] uppercase tracking-widest font-extrabold text-rose-400 bg-rose-500/15 border border-rose-500/30 px-3 py-1 rounded-full shadow-sm">
                    {headerTitle}
                  </span>
                </div>
              );
            }

            // Calculate active line progress
            let lineProgress = 0;
            if (isActive) {
              const currentLineTime = line.time;
              const nextLineTime = lines[idx + 1] ? lines[idx + 1].time : currentLineTime + 4;
              const lineDur = Math.max(1, nextLineTime - currentLineTime);
              lineProgress = Math.min(1, Math.max(0, (effectiveTime - currentLineTime) / lineDur));
            }

            const isCurrentlyHighlighted = syncedLyrics && isActive;
            const isBlurred = blurUnfocusedLyrics && !isCurrentlyHighlighted;

            return (
              <div
                key={`${line.time}-${idx}`}
                ref={isCurrentlyHighlighted ? activeLineRef : null}
                onClick={() => {
                  if (typeof line.time === 'number') {
                    onSeek(line.time);
                  }
                }}
                className={`group cursor-pointer relative pl-5 transition-all duration-300 transform origin-left leading-relaxed ${
                  isBlurred ? 'filter blur-[1.5px] opacity-40 hover:blur-none hover:opacity-80' : ''
                } ${
                  isCurrentlyHighlighted
                    ? 'text-white text-2xl sm:text-3xl font-extrabold scale-[1.02] filter drop-shadow-[0_4px_25px_rgba(255,255,255,0.7)]'
                    : isPast
                    ? 'text-white/30 text-lg sm:text-xl font-semibold hover:text-white/60'
                    : 'text-white/55 text-lg sm:text-xl font-bold hover:text-white/85'
                }`}
              >
                {/* Active Indicator & Progress Bar */}
                {isCurrentlyHighlighted && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-full max-h-10 bg-white/20 rounded-full overflow-hidden shadow-[0_0_12px_rgba(255,255,255,0.4)]">
                    <div 
                      className="w-full bg-gradient-to-b from-rose-500 to-pink-500 transition-all duration-100"
                      style={{ height: `${Math.round(lineProgress * 100)}%` }}
                    />
                  </div>
                )}
                {line.text}
              </div>
            );
          })}
        </div>

        <div className="h-28 shrink-0" />
      </div>
    </div>
  );
};
