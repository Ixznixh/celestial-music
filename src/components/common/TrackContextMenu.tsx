import React from 'react';
import { Song } from '../../types';
import { 
  Heart, 
  ListPlus, 
  PlaySquare, 
  FolderPlus, 
  Disc, 
  User, 
  X,
  ArrowDownCircle,
  CheckCircle2,
  Loader2,
  Trash2
} from 'lucide-react';
import { ArtworkImage } from './ArtworkImage';
import { useDownloads } from '../../hooks/useDownloads';

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
  const { isDownloaded, isDownloading, getProgress, downloadSong, removeDownload } = useDownloads();

  if (!isOpen) return null;

  const downloaded = isDownloaded(song.id);
  const downloading = isDownloading(song.id);
  const progress = getProgress(song.id);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-neutral-900 border border-neutral-800 p-5 shadow-2xl text-white pb-safe overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Track header inside menu */}
        <div className="flex items-center gap-3.5 pb-4 border-b border-neutral-800/80">
          <ArtworkImage 
            src={song.artworkUrl} 
            alt={song.title} 
            className="w-13 h-13 rounded-xl shadow-md shrink-0" 
            size="small"
          />
          <div className="min-w-0 flex-1">
            <h4 className="font-semibold text-sm truncate text-white">{song.title}</h4>
            <p className="text-xs text-neutral-400 truncate mt-0.5">{song.artist} — {song.album}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action items */}
        <div className="py-2 divide-y divide-neutral-800/40 text-sm">
          <div className="py-1">
            <button
              onClick={() => {
                onToggleFavorite(song);
                onClose();
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-neutral-800 active:bg-neutral-800 text-left transition"
            >
              <Heart className={`w-5 h-5 ${isFav ? 'fill-rose-500 text-rose-500' : 'text-neutral-400'}`} />
              <span className={isFav ? 'text-rose-400 font-medium' : 'text-neutral-200'}>
                {isFav ? 'Remove from Favorites' : 'Add to Favorites'}
              </span>
            </button>

            {/* Offline Download Action (Spotify Style) */}
            <button
              onClick={async () => {
                if (downloaded) {
                  await removeDownload(song.id);
                } else if (!downloading) {
                  await downloadSong(song);
                }
              }}
              disabled={downloading}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-neutral-800 active:bg-neutral-800 text-left transition mt-0.5"
            >
              <div className="flex items-center gap-3">
                {downloading ? (
                  <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
                ) : downloaded ? (
                  <CheckCircle2 className="w-5 h-5 fill-emerald-500 text-neutral-900" />
                ) : (
                  <ArrowDownCircle className="w-5 h-5 text-neutral-400" />
                )}
                <span className={downloaded ? 'text-emerald-400 font-medium' : 'text-neutral-200'}>
                  {downloading
                    ? `Downloading (${progress}%)`
                    : downloaded
                    ? 'Downloaded for Offline'
                    : 'Download for Offline'}
                </span>
              </div>
              {downloaded && (
                <span className="text-[11px] text-neutral-400 hover:text-rose-400">
                  Remove
                </span>
              )}
            </button>
          </div>

          <div className="py-1">
            <button
              onClick={() => {
                onPlayNext(song);
                onClose();
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-neutral-800 active:bg-neutral-800 text-left transition text-neutral-200"
            >
              <PlaySquare className="w-5 h-5 text-neutral-400" />
              <span>Play Next</span>
            </button>

            <button
              onClick={() => {
                onAddToQueue(song);
                onClose();
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-neutral-800 active:bg-neutral-800 text-left transition text-neutral-200"
            >
              <ListPlus className="w-5 h-5 text-neutral-400" />
              <span>Add to Playing Queue</span>
            </button>
          </div>

          <div className="py-1">
            <button
              onClick={() => {
                onAddToPlaylist(song);
                onClose();
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-neutral-800 active:bg-neutral-800 text-left transition text-neutral-200"
            >
              <FolderPlus className="w-5 h-5 text-neutral-400" />
              <span>Add to Playlist…</span>
            </button>
          </div>

          <div className="py-1">
            {onNavigateToAlbum && (
              <button
                onClick={() => {
                  onNavigateToAlbum(song.albumId);
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-neutral-800 active:bg-neutral-800 text-left transition text-neutral-200"
              >
                <Disc className="w-5 h-5 text-neutral-400" />
                <span>Go to Album</span>
              </button>
            )}

            {onNavigateToArtist && (
              <button
                onClick={() => {
                  onNavigateToArtist(song.artistId);
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-neutral-800 active:bg-neutral-800 text-left transition text-neutral-200"
              >
                <User className="w-5 h-5 text-neutral-400" />
                <span>Go to Artist</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
