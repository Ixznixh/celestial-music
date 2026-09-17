import React, { useRef, useEffect, useState } from 'react';
import { LyricsLine } from '../../types';
import { Sparkles, Loader2, Music2 } from 'lucide-react';

interface LyricsViewProps {
  lines?: LyricsLine[];
  isSynced?: boolean;
  isLoading?: boolean;
  currentTime: number;
  onSeek: (time: number) => void;
}

export const LyricsView: React.FC<LyricsViewProps> = ({
  lines = [],
  isSynced = true,
  isLoading = false,
  currentTime,
  onSeek,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const [userIsScrolling, setUserIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<any>(null);

  // Find the currently active lyric line index based on song currentTime
  let activeIndex = -1;
  if (lines.length > 0) {
    for (let i = 0; i < lines.length; i++) {
      if (currentTime >= lines[i].time) {
        activeIndex = i;
      } else {
        break;
      }
    }
  }

  // Handle manual user scrolling so auto-scroll doesn't fight the user
  const handleScroll = () => {
    setUserIsScrolling(true);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      setUserIsScrolling(false);
    }, 2800);
  };

  // Auto-scroll to active line smoothly unless user is actively scrolling
  useEffect(() => {
    if (userIsScrolling) return;

    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex, userIsScrolling]);

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 text-neutral-400 select-none">
        <Loader2 className="w-8 h-8 mb-3 text-rose-500 animate-spin opacity-80" />
        <h4 className="font-medium text-sm text-neutral-300">Synchronizing lyrics...</h4>
      </div>
    );
  }

  // Empty state
  if (!lines || lines.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 text-neutral-400 select-none">
        <Sparkles className="w-10 h-10 mb-3 text-neutral-500 opacity-60" />
        <h4 className="font-semibold text-base text-neutral-300">Lyrics aren't available for this song.</h4>
        <p className="text-xs text-neutral-500 mt-1 max-w-xs">
          Immerse yourself in the melody and acoustic atmosphere.
        </p>
      </div>
    );
  }

  const isHeaderLine = (text: string) => {
    return /^\[(Verse|Chorus|Bridge|Intro|Outro|Hook|Refrain|Pre-Chorus|Tag)[^\]]*\]$/i.test(text) ||
      /^\((Verse|Chorus|Bridge|Intro|Outro|Hook|Refrain|Pre-Chorus|Tag)[^)]*\)$/i.test(text);
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="h-full overflow-y-auto no-scrollbar py-6 px-6 text-left select-none relative scroll-smooth flex flex-col"
    >
      <div className="space-y-6 flex-1 pt-2">
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

          return (
            <div
              key={`${line.time}-${idx}`}
              ref={isActive ? activeLineRef : null}
              onClick={() => {
                if (typeof line.time === 'number') {
                  onSeek(line.time);
                }
              }}
              className={`group cursor-pointer relative pl-4 transition-all duration-300 transform origin-left leading-relaxed ${
                isActive
                  ? 'text-white text-2xl sm:text-3xl font-extrabold scale-[1.02] filter drop-shadow-[0_4px_25px_rgba(255,255,255,0.65)]'
                  : isPast
                  ? 'text-white/35 text-lg sm:text-xl font-semibold hover:text-white/70'
                  : 'text-white/55 text-lg sm:text-xl font-bold hover:text-white/85'
              }`}
            >
              {/* Left Glowing Active Indicator Line */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-full max-h-8 bg-gradient-to-b from-rose-500 to-pink-500 rounded-full shadow-[0_0_12px_rgba(244,63,94,0.9)]" />
              )}
              {line.text}
            </div>
          );
        })}
      </div>

      <div className="h-24 shrink-0" />
    </div>
  );
};


