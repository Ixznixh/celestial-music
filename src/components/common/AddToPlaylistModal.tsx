import React, { useState } from 'react';
import { Song, Playlist } from '../../types';
import { Plus, Check, X, ListMusic } from 'lucide-react';
import { ArtworkImage } from './ArtworkImage';

interface AddToPlaylistModalProps {
  song: Song | null;
  isOpen: boolean;
  playlists: Playlist[];
  onClose: () => void;
  onAddToPlaylist: (playlistId: string, song: Song) => void;
  onCreateNewPlaylist: () => void;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  song,
  isOpen,
  playlists,
  onClose,
  onAddToPlaylist,
  onCreateNewPlaylist,
}) => {
  const [addedId, setAddedId] = useState<string | null>(null);

  if (!isOpen || !song) return null;

  const handleSelectPlaylist = (playlistId: string) => {
    onAddToPlaylist(playlistId, song);
    setAddedId(playlistId);
    setTimeout(() => {
      setAddedId(null);
      onClose();
    }, 600);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 animate-in fade-in duration-150 p-0 sm:p-4"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-neutral-900 border border-neutral-800 p-6 shadow-2xl text-white pb-safe max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div>
            <h3 className="text-base font-semibold">Add to Playlist</h3>
            <p className="text-xs text-neutral-400 truncate max-w-[240px] mt-0.5">
              &quot;{song.title}&quot; by {song.artist}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Create new playlist button */}
        <button
          onClick={() => {
            onClose();
            onCreateNewPlaylist();
          }}
          className="mt-4 flex items-center gap-3 w-full p-3 rounded-2xl bg-neutral-800/80 hover:bg-neutral-750 transition text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
            <Plus className="w-6 h-6" />
          </div>
          <div>
            <p className="font-semibold text-sm text-white">New Playlist</p>
            <p className="text-xs text-neutral-400">Create a custom collection</p>
          </div>
        </button>

        {/* List of existing playlists */}
        <div className="mt-4 overflow-y-auto no-scrollbar space-y-2 flex-1">
          {playlists.length === 0 ? (
            <div className="text-center py-8 text-neutral-500 text-sm">
              <ListMusic className="w-10 h-10 mx-auto mb-2 opacity-40" />
              No playlists found. Create one above!
            </div>
          ) : (
            playlists.map((playlist) => {
              const isAlreadyIn = playlist.tracks.some((t) => t.id === song.id);
              const isJustAdded = addedId === playlist.id;

              return (
                <button
                  key={playlist.id}
                  disabled={isAlreadyIn}
                  onClick={() => handleSelectPlaylist(playlist.id)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition ${
                    isAlreadyIn 
                      ? 'opacity-50 cursor-not-allowed bg-neutral-900/40' 
                      : 'hover:bg-neutral-800/60 active:bg-neutral-800'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ArtworkImage
                      src={playlist.artworkUrl}
                      alt={playlist.title}
                      className="w-11 h-11 rounded-lg shrink-0"
                      size="small"
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-white truncate">{playlist.title}</p>
                      <p className="text-xs text-neutral-400">{playlist.trackCount} tracks</p>
                    </div>
                  </div>

                  <div>
                    {isJustAdded ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                        <Check className="w-4 h-4" /> Added
                      </span>
                    ) : isAlreadyIn ? (
                      <span className="text-[11px] text-neutral-500">Added</span>
                    ) : (
                      <Plus className="w-4 h-4 text-neutral-400" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
