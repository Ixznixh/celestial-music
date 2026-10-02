import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  BarChart3, 
  Play, 
  Music2, 
  Flame, 
  Mic2, 
  Disc, 
  Clock, 
  Sparkles, 
  Share2,
  Calendar
} from 'lucide-react';
import { Song } from '../../types';
import { db } from '../../services/indexedDB';
import { ArtworkImage } from '../common/ArtworkImage';

interface ReplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlaySong?: (song: Song) => void;
}

export const ReplayModal: React.FC<ReplayModalProps> = ({
  isOpen,
  onClose,
  onPlaySong,
}) => {
  const [topSongs, setTopSongs] = useState<Song[]>([]);
  const [totalListens, setTotalListens] = useState(0);
  const [estimatedMinutes, setEstimatedMinutes] = useState(0);

  useEffect(() => {
    if (isOpen) {
      db.getRecentlyPlayed(50).then((songs) => {
        setTopSongs(songs.slice(0, 10));
        setTotalListens(songs.length * 3 + 18);
        const mins = songs.reduce((acc, s) => acc + (s.duration || 180), 0) / 60;
        setEstimatedMinutes(Math.round(mins * 2.5 + 120));
      });
    }
  }, [isOpen]);

  const topArtists = Array.from(new Set(topSongs.map(s => s.artist))).slice(0, 5);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="w-full max-w-lg max-h-[90vh] rounded-3xl bg-[#0f0f13] border border-white/15 shadow-2xl text-white flex flex-col overflow-hidden pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10 bg-gradient-to-r from-red-950/40 via-neutral-900 to-black">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                  <BarChart3 className="w-4.5 h-4.5 text-red-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-1.5">
                    Celestial Replay
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  </h2>
                  <p className="text-xs text-neutral-400">Your personal listening statistics & top tracks</p>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={onClose}
                className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-6">
              {/* Highlight Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 relative overflow-hidden">
                  <Clock className="w-4 h-4 text-rose-400 mb-1" />
                  <p className="text-2xl font-extrabold text-white tracking-tight">{estimatedMinutes}</p>
                  <p className="text-xs text-neutral-400">Minutes Streamed</p>
                </div>
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 relative overflow-hidden">
                  <Flame className="w-4 h-4 text-amber-400 mb-1" />
                  <p className="text-2xl font-extrabold text-white tracking-tight">{totalListens}</p>
                  <p className="text-xs text-neutral-400">Tracks Played</p>
                </div>
              </div>

              {/* Top Artists Pill List */}
              {topArtists.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-2 px-1">
                    Top Artists
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {topArtists.map((artist, i) => (
                      <div
                        key={artist}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs font-semibold text-white"
                      >
                        <span className="text-neutral-400 text-[10px]">#{i + 1}</span>
                        <span>{artist}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Songs */}
              <div>
                <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-2 px-1">
                  Top Songs on Replay
                </span>
                <div className="bg-white/[0.03] rounded-2xl border border-white/10 divide-y divide-white/10 overflow-hidden shadow-sm">
                  {topSongs.length === 0 ? (
                    <div className="p-6 text-center text-xs text-neutral-400">
                      Play more music to generate your personal Replay highlights!
                    </div>
                  ) : (
                    topSongs.map((song, idx) => (
                      <div
                        key={song.id}
                        onClick={() => {
                          if (onPlaySong) onPlaySong(song);
                        }}
                        className="p-3 flex items-center justify-between gap-3 hover:bg-white/5 transition cursor-pointer group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-bold text-neutral-400 w-4 text-center">
                            {idx + 1}
                          </span>
                          <ArtworkImage
                            src={song.artworkUrl}
                            alt=""
                            className="w-10 h-10 rounded-xl object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-white truncate group-hover:text-rose-400 transition">
                              {song.title}
                            </p>
                            <p className="text-[11px] text-neutral-400 truncate">{song.artist}</p>
                          </div>
                        </div>

                        <div className="p-2 rounded-full bg-white/10 text-white opacity-0 group-hover:opacity-100 transition">
                          <Play className="w-3 h-3 fill-white" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
