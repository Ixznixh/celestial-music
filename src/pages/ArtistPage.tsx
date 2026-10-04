import React, { useEffect, useState } from 'react';
import { Artist, Song, Album, AppView } from '../types';
import { providerManager } from '../services/providerManager';
import { ArtworkImage } from '../components/common/ArtworkImage';
import { formatTime, formatListeners, formatPlayCount } from '../utils/formatters';
import { useLongPress } from '../hooks/useLongPress';
import { 
  Play, 
  Shuffle, 
  Heart, 
  MoreHorizontal, 
  UserCheck, 
  UserPlus, 
  Sparkles 
} from 'lucide-react';

interface ArtistPageProps {
  artistId: string;
  onNavigate: (view: AppView) => void;
  onPlaySong: (song: Song, queue?: Song[]) => void;
  onPlayAll: (songs: Song[], shuffle?: boolean) => void;
  onOpenContextMenu: (song: Song) => void;
  isSaved: boolean;
  onToggleSaveArtist: (artist: Artist) => void;
}

export const ArtistPage: React.FC<ArtistPageProps> = ({
  artistId,
  onNavigate,
  onPlaySong,
  onPlayAll,
  onOpenContextMenu,
  isSaved,
  onToggleSaveArtist,
}) => {
  const [artist, setArtist] = useState<Artist | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { getHandlers } = useLongPress<Song>((song) => onOpenContextMenu(song));

  useEffect(() => {
    setIsLoading(true);
    const provider = providerManager.getActiveProvider();
    provider.getArtist(artistId)
      .then((art) => {
        setArtist(art);
        setIsLoading(false);
      })
      .catch((err) => {
        console.warn('Failed to load artist:', err);
        setArtist(null);
        setIsLoading(false);
      });
  }, [artistId]);

  if (isLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-neutral-500 space-y-2">
        <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs">Loading artist profile…</span>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="py-24 text-center text-neutral-400 px-4">
        <p className="font-semibold text-white">Artist Not Found</p>
        <button
          onClick={() => onNavigate({ type: 'home' })}
          className="mt-4 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold"
        >
          Return Home
        </button>
      </div>
    );
  }

  return (
    <div 
      className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 select-none pt-2 sm:pt-6 space-y-8 pb-36 md:pb-28"
    >
      {/* Hero Header */}
      <div className="flex flex-col sm:flex-row items-center sm:items-end text-center sm:text-left gap-5 sm:gap-8 pt-2">
        <div className="w-36 h-36 sm:w-44 sm:h-44 md:w-48 md:h-48 rounded-full overflow-hidden shadow-2xl shrink-0 border-2 border-white/10 ring-4 ring-white/5">
          <ArtworkImage src={artist.avatarUrl} alt={artist.name} aspectRatio="avatar" className="w-full h-full object-cover" />
        </div>

        <div className="flex-1 min-w-0">
          <span className="hidden sm:inline-block text-xs font-bold uppercase tracking-wider text-rose-500 mb-1">
            Artist
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-white leading-tight">
            {artist.name}
          </h2>

          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            {artist.genre} • {formatListeners(artist.monthlyListeners)}
          </p>

          {/* Buttons: Play, Shuffle, Follow */}
          <div className="flex items-center gap-3 w-full sm:w-auto mt-4 sm:mt-6">
            <button
              onClick={() => onPlayAll(artist.popularSongs, false)}
              className="flex-1 sm:flex-initial py-2.5 px-6 rounded-2xl bg-white text-black font-semibold text-sm flex items-center justify-center gap-2 hover:bg-neutral-200 active:scale-95 transition shadow-lg cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current ml-0.5" />
              <span>Play</span>
            </button>

            <button
              onClick={() => onPlayAll(artist.popularSongs, true)}
              className="flex-1 sm:flex-initial py-2.5 px-6 rounded-2xl bg-neutral-800 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-neutral-750 active:scale-95 transition border border-white/10 cursor-pointer"
            >
              <Shuffle className="w-4 h-4" />
              <span>Shuffle</span>
            </button>

            <button
              onClick={() => onToggleSaveArtist(artist)}
              title={isSaved ? 'Unfollow' : 'Follow'}
              className={`p-2.5 rounded-2xl border transition active:scale-95 cursor-pointer ${
                isSaved
                  ? 'bg-rose-600/20 text-rose-400 border-rose-500/40'
                  : 'bg-neutral-800 text-neutral-300 hover:text-white border-white/10'
              }`}
            >
              {isSaved ? <UserCheck className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Top Popular Tracks */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-white tracking-tight">Top Songs</h3>
        </div>

        <div className="divide-y divide-neutral-850 bg-neutral-900/60 rounded-2xl border border-neutral-800/80 overflow-hidden">
          {artist.popularSongs.map((song, idx) => (
            <div
              key={song.id}
              {...getHandlers(song)}
              className="flex items-center justify-between p-2.5 hover:bg-neutral-800/80 active:bg-neutral-800 transition group cursor-pointer"
            >
              <button
                onClick={() => onPlaySong(song, artist.popularSongs)}
                className="flex items-center gap-3 min-w-0 flex-1 text-left"
              >
                <span className="text-xs font-bold text-neutral-500 w-4 text-center shrink-0">
                  {idx + 1}
                </span>
                <ArtworkImage
                  src={song.artworkUrl}
                  alt={song.title}
                  className="w-11 h-11 rounded-lg shrink-0 shadow-sm"
                />
                <div className="min-w-0 flex-1 pr-2">
                  <p className="text-sm font-semibold text-white truncate">{song.title}</p>
                  <p className="text-xs text-neutral-400 truncate mt-0.5">
                    {formatPlayCount(song.plays)}
                  </p>
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
          ))}
        </div>
      </div>

      {/* Albums Discography */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-white tracking-tight">Albums & Releases</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {artist.albums.map((album) => (
            <div
              key={album.id}
              onClick={() => onNavigate({ type: 'album', albumId: album.id })}
              className="p-2.5 rounded-2xl bg-neutral-900/60 hover:bg-neutral-850/80 border border-neutral-800/80 cursor-pointer active:scale-95 transition"
            >
              <ArtworkImage src={album.artworkUrl} alt={album.title} className="w-full aspect-square rounded-xl shadow-md mb-2" />
              <p className="text-xs font-semibold text-white truncate">{album.title}</p>
              <p className="text-[11px] text-neutral-400 truncate">{album.releaseYear} • {album.tracks.length} songs</p>
            </div>
          ))}
        </div>
      </div>

      {/* Biography */}
      {artist.bio && (
        <div className="p-4 rounded-2xl bg-neutral-900/50 border border-neutral-800 text-xs text-neutral-300 leading-relaxed">
          <div className="flex items-center gap-1.5 font-bold text-white mb-2 uppercase tracking-wider text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-rose-500" />
            <span>About the Artist</span>
          </div>
          <p>{artist.bio}</p>
        </div>
      )}
    </div>
  );
};
