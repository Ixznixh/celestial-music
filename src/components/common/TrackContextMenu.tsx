import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Song } from '../../types';
import { 
  Heart, 
  ListPlus, 
  PlaySquare, 
  FolderPlus, 
  Disc, 
  User, 
  X
} from 'lucide-react';
import { ArtworkImage } from './ArtworkImage';

interface TrackContextMenuProps {
  song: Song;
  isOpen: boolean;
  isFav: boolean;
  onClose: () => void;
  onToggleFavorite: (song: Song) => void;
  onPlayNext: (song: Song) => void;
  onAddToQueue: (song: Song) => void;
  onAddToPlaylist: (song: Song) => void;
  onNavigateToAlbum?: (albumId: string) => void;
  onNavigateToArtist?: (artistId: string) => void;
}

export const TrackContextMenu: React.FC<TrackContextMenuProps> = ({
  song,
  isOpen,
  isFav,
  onClose,
  onToggleFavorite,
  onPlayNext,
  onAddToQueue,
  onAddToPlaylist,
  onNavigateToAlbum,
  onNavigateToArtist,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 touch-none"
        onClick={onClose}
      >
        {/* Dimmed backdrop layer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 bg-black/75 backdrop-blur-sm"
        />

        {/* Modal / Bottom Sheet */}
        <motion.div 
          initial={{ y: '100%', opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0.05, bottom: 0.6 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 80 || info.velocity.y > 400) {
              onClose();
            }
          }}
          className="relative z-10 w-full max-w-md rounded-t-[28px] sm:rounded-[28px] bg-[#1a1a1e] border border-white/10 p-5 shadow-2xl text-white pb-safe overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top handle drag pill */}
          <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-3 sm:hidden" />

          {/* Track header inside menu */}
          <div className="flex items-center gap-3.5 pb-4 border-b border-white/10">
            <ArtworkImage 
              src={song.artworkUrl} 
              fallbackVideoId={song.id}
              alt={song.title} 
              rounded="rounded-xl"
              className="w-13 h-13 rounded-xl shadow-md shrink-0 object-cover border border-white/10" 
              size="small"
            />
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-sm truncate text-white tracking-tight">{song.title}</h4>
              <p className="text-xs text-neutral-400 truncate mt-0.5 font-medium">
                {song.artist} {song.album ? `— ${song.album}` : '— Single'}
              </p>
            </div>
            <button 
              onClick={onClose}
              aria-label="Close menu"
              className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 active:scale-95 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Action items */}
          <div className="py-2 divide-y divide-white/5 text-sm">
            <div className="py-1">
              <button
                onClick={() => {
                  onToggleFavorite(song);
                  onClose();
                }}
                className="w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl hover:bg-white/10 active:bg-white/15 text-left transition cursor-pointer"
              >
                <Heart className={`w-5 h-5 ${isFav ? 'fill-white text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'text-neutral-300'}`} />
                <span className={isFav ? 'text-white font-semibold' : 'text-neutral-200 font-medium'}>
                  {isFav ? 'Remove from Favorites' : 'Add to Favorites'}
                </span>
              </button>
            </div>

            <div className="py-1">
              <button
                onClick={() => {
                  onPlayNext(song);
                  onClose();
                }}
                className="w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl hover:bg-white/10 active:bg-white/15 text-left transition text-neutral-200 font-medium cursor-pointer"
              >
                <PlaySquare className="w-5 h-5 text-neutral-300" />
                <span>Play Next</span>
              </button>

              <button
                onClick={() => {
                  onAddToQueue(song);
                  onClose();
                }}
                className="w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl hover:bg-white/10 active:bg-white/15 text-left transition text-neutral-200 font-medium cursor-pointer"
              >
                <ListPlus className="w-5 h-5 text-neutral-300" />
                <span>Add to Playing Queue</span>
              </button>
            </div>

            <div className="py-1">
              <button
                onClick={() => {
                  onAddToPlaylist(song);
                  onClose();
                }}
                className="w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl hover:bg-white/10 active:bg-white/15 text-left transition text-neutral-200 font-medium cursor-pointer"
              >
                <FolderPlus className="w-5 h-5 text-neutral-300" />
                <span>Add to Playlist…</span>
              </button>
            </div>

            <div className="py-1">
              {onNavigateToAlbum && (
                <button
                  onClick={() => {
                    onNavigateToAlbum(song.albumId || song.album || '');
                    onClose();
                  }}
                  className="w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl hover:bg-white/10 active:bg-white/15 text-left transition text-neutral-200 font-medium cursor-pointer"
                >
                  <Disc className="w-5 h-5 text-neutral-300" />
                  <span>Go to Album</span>
                </button>
              )}

              {onNavigateToArtist && (
                <button
                  onClick={() => {
                    onNavigateToArtist(song.artistId || song.artist || '');
                    onClose();
                  }}
                  className="w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl hover:bg-white/10 active:bg-white/15 text-left transition text-neutral-200 font-medium cursor-pointer"
                >
                  <User className="w-5 h-5 text-neutral-300" />
                  <span>Go to Artist</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
