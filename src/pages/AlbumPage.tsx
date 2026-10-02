import React, { useEffect, useState } from 'react';
import { Album, Song, AppView } from '../types';
import { providerManager } from '../services/providerManager';
import { ArtworkImage } from '../components/common/ArtworkImage';
import { formatTime, formatDuration } from '../utils/formatters';
import { 
  Play, 
  Shuffle, 
  Bookmark, 
  BookmarkCheck, 
  MoreHorizontal, 
  ChevronRight, 
  Share2 
} from 'lucide-react';

interface AlbumPageProps {
  albumId: string;
  onNavigate: (view: AppView) => void;
  onPlaySong: (song: Song, queue?: Song[]) => void;
  onPlayAll: (songs: Song[], shuffle?: boolean) => void;
  onOpenContextMenu: (song: Song) => void;
  isSaved: boolean;
  onToggleSaveAlbum: (album: Album) => void;
}

export const AlbumPage: React.FC<AlbumPageProps> = ({
  albumId,
  onNavigate,
  onPlaySong,
  onPlayAll,
  onOpenContextMenu,
  isSaved,
  onToggleSaveAlbum,
}) => {
  const [album, setAlbum] = useState<Album | null>(null);
  const [moreAlbums, setMoreAlbums] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const provider = providerManager.getActiveProvider();
    provider.getAlbum(albumId)
      .then((alb) => {
        setAlbum(alb);
        setIsLoading(false);
        if (alb && alb.artistId) {
          provider.getArtist(alb.artistId)
            .then((artist) => {
              if (artist) {
                setMoreAlbums((artist.albums || []).filter((a) => a.id !== alb.id));
              }
            })
            .catch(() => {});
        }
      })
      .catch((err) => {
        console.warn('Failed to load album:', err);
        setAlbum(null);
        setIsLoading(false);
      });
  }, [albumId]);

  if (isLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-neutral-500 space-y-2">
        <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs">Loading album…</span>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="py-24 text-center text-neutral-400 px-4">
        <p className="font-semibold text-white">Album Not Found</p>
        <button
          onClick={() => onNavigate({ type: 'home' })}
          className="mt-4 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold"
        >
          Return Home
        </button>
      </div>
    );
  }

  const totalDuration = album.tracks.reduce((acc, cur) => acc + cur.duration, 0);

  return (
    <div 
      className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 select-none pt-2 sm:pt-6 space-y-8 pb-36 md:pb-28"
    >
      {/* Hero Header */}
      <div className="flex flex-col sm:flex-row items-center sm:items-end text-center sm:text-left gap-5 sm:gap-8">
        <div className="w-48 h-48 sm:w-56 sm:h-56 md:w-60 md:h-60 rounded-3xl overflow-hidden shadow-2xl shrink-0 border border-white/10">
          <ArtworkImage src={album.artworkUrl} alt={album.title} rounded="rounded-3xl" className="w-full h-full object-cover" />
        </div>

        <div className="flex-1 min-w-0">
          <span className="hidden sm:inline-block text-xs font-bold uppercase tracking-wider text-rose-500 mb-1">
            Album
          </span>
          <h2 className="text-xl sm:text-3xl md:text-4xl font-bold tracking-tight text-white leading-tight">
            {album.title}
          </h2>

          <button
            onClick={() => onNavigate({ type: 'artist', artistId: album.artistId })}
            className="text-sm sm:text-base font-semibold text-rose-500 hover:text-rose-400 mt-1 transition inline-block"
          >
            {album.artist}
          </button>

          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            {album.genre} • {album.releaseYear} • {album.tracks.length} songs, {formatDuration(totalDuration)}
          </p>

          {/* Action Buttons: Play & Shuffle */}
          <div className="flex items-center gap-3 w-full sm:w-auto mt-4 sm:mt-6">
            <button
              onClick={() => onPlayAll(album.tracks, false)}
              className="flex-1 sm:flex-initial py-2.5 px-6 rounded-2xl bg-white text-black font-semibold text-sm flex items-center justify-center gap-2 hover:bg-neutral-200 active:scale-95 transition shadow-lg cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current ml-0.5" />
              <span>Play</span>
            </button>

            <button
              onClick={() => onPlayAll(album.tracks, true)}
              className="flex-1 sm:flex-initial py-2.5 px-6 rounded-2xl bg-neutral-800 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-neutral-750 active:scale-95 transition border border-white/10 cursor-pointer"
            >
              <Shuffle className="w-4 h-4" />
              <span>Shuffle</span>
            </button>

            <button
              onClick={() => onToggleSaveAlbum(album)}
              title={isSaved ? 'Remove from Library' : 'Save to Library'}
              className={`p-2.5 rounded-2xl border transition active:scale-95 cursor-pointer ${
                isSaved
                  ? 'bg-rose-600/20 text-rose-400 border-rose-500/40'
                  : 'bg-neutral-800 text-neutral-300 hover:text-white border-white/10'
              }`}
            >
              {isSaved ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Track List */}
      <div>
        <div className="divide-y divide-neutral-850 bg-neutral-900/60 rounded-2xl border border-neutral-800/80 overflow-hidden">
          {album.tracks.map((song, index) => {
            const trackNum = (song.trackNumber || index + 1).toString().padStart(2, '0');

            return (
              <div
                key={song.id}
                className="flex items-center justify-between p-3 hover:bg-neutral-800/80 active:bg-neutral-800 transition group"
              >
                <button
                  onClick={() => onPlaySong(song, album.tracks)}
                  className="flex items-center gap-3.5 min-w-0 flex-1 text-left"
                >
                  <span className="text-xs font-mono text-neutral-500 w-5 text-right shrink-0">
                    {trackNum}
                  </span>
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-sm font-semibold text-white truncate">{song.title}</p>
                    <p className="text-xs text-neutral-400 truncate mt-0.5">{song.artist}</p>
                  </div>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-neutral-500 tabular-nums">
                    {formatTime(song.duration)}
                  </span>
                  <button
                    onClick={() => onOpenContextMenu(song)}
                    className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-700/60 transition"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Album Description */}
      {album.description && (
        <div className="p-4 rounded-2xl bg-neutral-900/50 border border-neutral-800 text-xs text-neutral-400 leading-relaxed">
          <p>{album.description}</p>
          <div className="mt-3 text-[11px] text-neutral-500">
            ℗ {album.releaseYear} Celestial Audio Records under royalty-free distribution.
          </div>
        </div>
      )}

      {/* More by Artist */}
      {moreAlbums.length > 0 && (
        <div className="pt-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-white tracking-tight">
              More by {album.artist}
            </h3>
            <button
              onClick={() => onNavigate({ type: 'artist', artistId: album.artistId })}
              className="text-xs text-rose-500 hover:text-rose-400 font-medium"
            >
              See All
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {moreAlbums.map((item) => (
              <div
                key={item.id}
                onClick={() => onNavigate({ type: 'album', albumId: item.id })}
                className="p-2.5 rounded-2xl bg-neutral-900/60 hover:bg-neutral-850/80 border border-neutral-800/80 cursor-pointer active:scale-95 transition"
              >
                <ArtworkImage src={item.artworkUrl} alt={item.title} className="w-full aspect-square rounded-xl shadow-md mb-2" />
                <p className="text-xs font-semibold text-white truncate">{item.title}</p>
                <p className="text-[11px] text-neutral-400 truncate">{item.releaseYear}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
