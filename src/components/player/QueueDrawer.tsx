import React, { useEffect } from 'react';
import { Song } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { QueueView } from './QueueView';

export interface QueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  queue: Song[];
  queueIndex: number;
  currentSong: Song | null;
  userQueue?: Song[];
  suggestionsQueue?: Song[];
  isLoadingSuggestions?: boolean;
  onSelectTrack: (song: Song, index: number) => void;
  onRemoveTrack: (index: number) => void;
  onReorder: (from: number, to: number) => void;
  onClearQueue: () => void;
  onClearUpcoming?: () => void;
  onClearUserQueue?: () => void;
  onClearAutoplayQueue?: () => void;
  onLoadMoreSuggestions?: () => void;
}

export const QueueDrawer: React.FC<QueueDrawerProps> = ({
  isOpen,
  onClose,
  queue,
  queueIndex,
  currentSong,
  userQueue = [],
  suggestionsQueue = [],
  isLoadingSuggestions = false,
  onSelectTrack,
  onRemoveTrack,
  onReorder,
  onClearQueue,
  onClearUpcoming,
  onClearUserQueue,
  onClearAutoplayQueue,
  onLoadMoreSuggestions,
}) => {
  // ESC key listener to close drawer
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center select-none">
          {/* Backdrop overlay with blur */}
          <motion.div
            key="queue-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-md cursor-pointer"
            onClick={onClose}
          />

          {/* Drawer Sheet */}
          <motion.div
            key="queue-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className="relative z-10 w-full max-w-lg h-[85vh] max-h-[750px] rounded-t-[28px] bg-[#0e0e12] border-t border-white/10 flex flex-col text-white pb-safe shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab Handle */}
            <div className="w-full flex items-center justify-center pt-3 pb-1 cursor-pointer" onClick={onClose}>
              <div className="w-10 h-1 rounded-full bg-neutral-600 hover:bg-neutral-400 transition" />
            </div>

            {/* Queue Content */}
            <QueueView
              queue={queue}
              queueIndex={queueIndex}
              currentSong={currentSong}
              userQueue={userQueue}
              suggestionsQueue={suggestionsQueue}
              isLoadingSuggestions={isLoadingSuggestions}
              onSelectTrack={onSelectTrack}
              onRemoveTrack={onRemoveTrack}
              onReorder={onReorder}
              onClearQueue={onClearQueue}
              onClearUpcoming={onClearUpcoming}
              onClearUserQueue={onClearUserQueue}
              onClearAutoplayQueue={onClearAutoplayQueue}
              onLoadMoreSuggestions={onLoadMoreSuggestions}
              onClose={onClose}
              className="flex-1 min-h-0"
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
