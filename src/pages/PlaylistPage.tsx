import React, { useEffect, useState } from 'react';
import { Playlist, Song, AppView } from '../types';
import { providerManager } from '../services/providerManager';
import { ArtworkImage } from '../components/common/ArtworkImage';
import { PlaylistThumbnail } from '../components/common/PlaylistThumbnail';
import { formatTime, formatDuration } from '../utils/formatters';
import { useLongPress } from '../hooks/useLongPress';
import { 
  Play, 
  Shuffle, 
  Trash2, 
  MoreHorizontal, 
  ListMusic, 
  Plus, 
  Edit3, 
  Check, 
  X, 
  ArrowUp, 
  ArrowDown 
} from 'lucide-react';

interface PlaylistPageProps {
  playlistId: string;
  onNavigate: (view: AppView) => void;
  onPlaySong: (song: Song, queue?: Song[]) => void;
  onPlayAll: (songs: Song[], shuffle?: boolean) => void;
  onOpenContextMenu: (song: Song) => void;
  userPlaylists: Playlist[];
  onUpdatePlaylist: (playlist: Playlist) => void;
  onDeletePlaylist: (playlistId: string) => void;
  onRemoveSongFromPlaylist: (playlistId: string, songId: string) => void;
  onReorderPlaylist: (playlistId: string, from: number, to: number) => void;
}

export const PlaylistPage: React.FC<PlaylistPageProps> = ({
  playlistId,
  onNavigate,
  onPlaySong,
  onPlayAll,
  onOpenContextMenu,
  userPlaylists,
  onUpdatePlaylist,
  onDeletePlaylist,
  onRemoveSongFromPlaylist,
  onReorderPlaylist,
}) => {
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const { getHandlers } = useLongPress<Song>((song) => onOpenContextMenu(song));

  // Find playlist either from user playlists state (IndexedDB) or provider
  useEffect(() => {
    const userPl = userPlaylists.find((p) => p.id === playlistId);
    if (userPl) {
      setPlaylist(userPl);
      setEditTitle(userPl.title);
      setEditDesc(userPl.description || '');
      return;
    }

    const provider = providerManager.getActiveProvider();
    provider.getPlaylist(playlistId)
      .then((pl) => {
        setPlaylist(pl);
        if (pl) {
          setEditTitle(pl.title);
          setEditDesc(pl.description || '');
        }
      })
      .catch((err) => {
        console.warn('Failed to load playlist:', err);
        setPlaylist(null);
      });
  }, [playlistId, userPlaylists]);

  if (!playlist) {
    return (
      <div className="py-24 text-center text-neutral-400 px-4">
        <p className="font-semibold text-white">Playlist Not Found</p>
        <button
          onClick={() => onNavigate({ type: 'library' })}
          className="mt-4 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold"
        >
          Return to Library
        </button>
      </div>
    );
  }

  const totalDuration = playlist.tracks.reduce((acc, cur) => acc + cur.duration, 0);

  const handleSaveEdit = () => {
    if (!editTitle.trim()) return;
    const updated: Playlist = {
      ...playlist,
      title: editTitle.trim(),
      description: editDesc.trim(),
      updatedAt: Date.now(),
    };
    onUpdatePlaylist(updated);
    setPlaylist(updated);
    setIsEditing(false);
  };

  return (
    <div 
      className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 select-none pt-2 sm:pt-6 space-y-8 pb-36 md:pb-28"
    >
      {/* Header / Collage artwork */}
      <div className="flex flex-col sm:flex-row items-center sm:items-end text-center sm:text-left gap-5 sm:gap-8">
        <div className="w-48 h-48 sm:w-56 sm:h-56 md:w-60 md:h-60 rounded-3xl overflow-hidden shadow-2xl shrink-0 border border-white/10 relative">
          <PlaylistThumbnail
            artworkUrl={playlist.artworkUrl}
            collageArtworks={playlist.collageArtworks}
            trackCount={playlist.trackCount}
            title={playlist.title}
            rounded="rounded-3xl"
            className="w-full h-full"
            showPlayButton={false}
            showBadge={true}
            size="large"
          />
        </div>

        <div className="flex-1 min-w-0">
          <span className="hidden sm:inline-block text-xs font-bold uppercase tracking-wider text-rose-500 mb-1">
            Playlist
          </span>

          {/* Title or Inline Edit */}
          {isEditing ? (
            <div className="w-full space-y-2 max-w-md">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full text-left text-lg font-bold text-white bg-neutral-800 rounded-xl px-3 py-2 border border-neutral-700 focus:outline-none focus:border-rose-500"
              />
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={2}
                className="w-full text-left text-xs text-neutral-300 bg-neutral-800 rounded-xl px-3 py-1.5 border border-neutral-700 focus:outline-none focus:border-rose-500 resize-none"
              />
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold shadow cursor-pointer"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <h2 className="text-xl sm:text-3xl md:text-4xl font-bold tracking-tight text-white leading-tight">
                  {playlist.title}
                </h2>
                {playlist.isCustom && (
                  <button
                    onClick={() => setIsEditing(true)}
                    aria-label="Edit playlist name"
                    className="p-1 rounded-full text-neutral-400 hover:text-white cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {playlist.description && (
                <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-xl leading-relaxed">
                  {playlist.description}
                </p>
              )}

              <p className="text-xs sm:text-sm text-neutral-500 mt-1">
                {playlist.tracks.length} songs, {formatDuration(totalDuration)}
              </p>
            </>
          )}

          {/* Action Buttons: Play & Shuffle */}
          {playlist.tracks.length > 0 && (
            <div className="flex items-center gap-3 w-full sm:w-auto mt-4 sm:mt-6">
              <button
                onClick={() => onPlayAll(playlist.tracks, false)}
                className="flex-1 sm:flex-initial py-2.5 px-6 rounded-2xl bg-white text-black font-semibold text-sm flex items-center justify-center gap-2 hover:bg-neutral-200 active:scale-95 transition shadow-lg cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current ml-0.5" />
                <span>Play</span>
              </button>

              <button
                onClick={() => onPlayAll(playlist.tracks, true)}
                className="flex-1 sm:flex-initial py-2.5 px-6 rounded-2xl bg-neutral-800 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-neutral-750 active:scale-95 transition border border-white/10 cursor-pointer"
              >
                <Shuffle className="w-4 h-4" />
                <span>Shuffle</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Track List */}
      <div>
        {playlist.tracks.length === 0 ? (
          <div className="py-16 text-center text-neutral-400 bg-neutral-900/40 rounded-3xl border border-neutral-800 p-6">
            <ListMusic className="w-10 h-10 mx-auto mb-2 opacity-40 text-neutral-500" />
            <p className="font-semibold text-white">This Playlist is Empty</p>
            <p className="text-xs text-neutral-500 mt-1 mb-4">
              Add songs from Search or Home using the track menu.
            </p>
            <button
              onClick={() => onNavigate({ type: 'search' })}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition"
            >
              Explore Music
            </button>
          </div>
        ) : (
          <div className="divide-y divide-neutral-850 bg-neutral-900/60 rounded-2xl border border-neutral-800/80 overflow-hidden">
            {playlist.tracks.map((song, index) => (
              <div
                key={`${song.id}-${index}`}
                {...getHandlers(song)}
                className="flex items-center justify-between p-2.5 hover:bg-neutral-800/80 active:bg-neutral-800 transition group cursor-pointer"
              >
                <button
                  onClick={() => onPlaySong(song, playlist.tracks)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left"
                >
                  <ArtworkImage
                    src={song.artworkUrl}
                    alt={song.title}
                    className="w-11 h-11 rounded-lg shrink-0 shadow-sm"
                  />
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-sm font-semibold text-white truncate">{song.title}</p>
                    <p className="text-xs text-neutral-400 truncate mt-0.5">{song.artist}</p>
                  </div>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-neutral-500 tabular-nums mr-1">
                    {formatTime(song.duration)}
                  </span>

                  {/* Reorder handles for custom playlists */}
                  {playlist.isCustom && (
                    <div className="flex items-center">
                      {index > 0 && (
                        <button
                          onClick={() => onReorderPlaylist(playlist.id, index, index - 1)}
                          className="p-1 rounded text-neutral-500 hover:text-white"
                          title="Move up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {index < playlist.tracks.length - 1 && (
                        <button
                          onClick={() => onReorderPlaylist(playlist.id, index, index + 1)}
                          className="p-1 rounded text-neutral-500 hover:text-white"
                          title="Move down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Remove from playlist button if custom */}
                  {playlist.isCustom && (
                    <button
                      onClick={() => onRemoveSongFromPlaylist(playlist.id, song.id)}
                      className="p-1.5 rounded-full text-neutral-500 hover:text-rose-400 transition"
                      title="Remove from playlist"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}

                  {/* Overflow menu */}
                  <button
                    onClick={() => onOpenContextMenu(song)}
                    className="p-1.5 rounded-full text-neutral-400 hover:text-white transition"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete playlist if custom */}
      {playlist.isCustom && (
        <div className="pt-4 flex justify-center">
          <button
            onClick={() => {
              if (confirm(`Are you sure you want to delete "${playlist.title}"?`)) {
                onDeletePlaylist(playlist.id);
                onNavigate({ type: 'library' });
              }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-rose-500 hover:bg-rose-950/30 text-xs font-semibold transition"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Playlist</span>
          </button>
        </div>
      )}
    </div>
  );
};
