import React, { useState } from 'react';
import { Song, Album, Artist, Playlist, AppView } from '../types';
import { ArtworkImage } from '../components/common/ArtworkImage';
import { PlaylistThumbnail } from '../components/common/PlaylistThumbnail';
import { formatTime } from '../utils/formatters';
import { 
  ListMusic, 
  User, 
  Disc, 
  Music, 
  Plus, 
  ChevronRight, 
  Play, 
  MoreHorizontal, 
  Heart, 
  Clock, 
  Trash2
} from 'lucide-react';

interface LibraryPageProps {
  onNavigate: (view: AppView) => void;
  onPlaySong: (song: Song, contextQueue?: Song[]) => void;
  onOpenContextMenu: (song: Song) => void;
  onRequestNewPlaylist: () => void;
  favoriteSongs: Song[];
  savedAlbums: Album[];
  savedArtists: Artist[];
  playlists: Playlist[];
  recentlyPlayed: Song[];
  onDeletePlaylist: (playlistId: string) => void;
}

type LibraryTab = 'overview' | 'playlists' | 'songs' | 'albums' | 'artists';

export const LibraryPage: React.FC<LibraryPageProps> = ({
  onNavigate,
  onPlaySong,
  onOpenContextMenu,
  onRequestNewPlaylist,
  favoriteSongs,
  savedAlbums,
  savedArtists,
  playlists,
  recentlyPlayed,
  onDeletePlaylist,
}) => {
  const [tab, setTab] = useState<LibraryTab>('overview');

  return (
    <div 
      className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 select-none pt-2 sm:pt-4 space-y-6 pb-36 md:pb-28"
    >
      {/* Title & Add Action */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Library</h2>
        </div>
        <button
          onClick={onRequestNewPlaylist}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-semibold text-xs transition shadow"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Playlist</span>
        </button>
      </div>

      {/* Navigation Tabs Pill selector */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        {(['overview', 'playlists', 'songs', 'albums', 'artists'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 rounded-full text-xs font-medium capitalize whitespace-nowrap transition-all flex items-center gap-1.5 ${
              tab === t
                ? 'bg-rose-600 text-white font-semibold shadow'
                : 'bg-white/[0.08] text-neutral-300 hover:bg-white/[0.14] hover:text-white border border-white/[0.04]'
            }`}
          >
            <span>{t === 'overview' ? 'Overview' : t}</span>
          </button>
        ))}
      </div>

      {/* 1. OVERVIEW VIEW */}
      {tab === 'overview' && (
        <div className="space-y-5">
          {/* Category Rows */}
          <div className="divide-y divide-neutral-800/80 bg-neutral-850/80 rounded-xl border border-neutral-800 overflow-hidden">
            <button
              onClick={() => setTab('playlists')}
              className="w-full flex items-center justify-between p-3 hover:bg-neutral-800/60 active:bg-neutral-800 text-left transition"
            >
              <div className="flex items-center gap-2.5">
                <ListMusic className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-semibold text-white">Playlists</span>
              </div>
              <div className="flex items-center gap-1 text-neutral-400">
                <span className="text-xs">{playlists.length + (favoriteSongs.length > 0 ? 1 : 0)}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </button>

            <button
              onClick={() => setTab('albums')}
              className="w-full flex items-center justify-between p-3 hover:bg-neutral-800/60 active:bg-neutral-800 text-left transition"
            >
              <div className="flex items-center gap-2.5">
                <Disc className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-semibold text-white">Saved Albums</span>
              </div>
              <div className="flex items-center gap-1 text-neutral-400">
                <span className="text-xs">{savedAlbums.length}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </button>

            <button
              onClick={() => setTab('artists')}
              className="w-full flex items-center justify-between p-3 hover:bg-neutral-800/60 active:bg-neutral-800 text-left transition"
            >
              <div className="flex items-center gap-2.5">
                <User className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-semibold text-white">Artists</span>
              </div>
              <div className="flex items-center gap-1 text-neutral-400">
                <span className="text-xs">{savedArtists.length}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </button>
          </div>

          {/* Quick Playlists preview */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white tracking-tight">Your Playlists</h3>
              <button
                onClick={() => setTab('playlists')}
                className="text-xs text-rose-500 hover:text-rose-400 font-medium"
              >
                See All
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {/* Favorited Songs Playlist Card */}
              <div
                onClick={() => setTab('songs')}
                className="p-2 rounded-xl bg-neutral-900/80 hover:bg-neutral-850 border border-neutral-800/80 cursor-pointer active:scale-95 transition group relative"
              >
                <div className="w-full aspect-square rounded-lg shadow mb-1.5 bg-gradient-to-br from-indigo-700 via-purple-700 to-rose-600 flex flex-col items-center justify-center relative overflow-hidden group-hover:shadow-lg transition">
                  <Heart className="w-9 h-9 text-white fill-white drop-shadow-md group-hover:scale-110 transition-transform duration-300" />
                  {favoriteSongs.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlaySong(favoriteSongs[0], favoriteSongs);
                      }}
                      className="absolute right-2 bottom-2 w-9 h-9 rounded-full bg-rose-500 hover:bg-rose-400 text-white flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100"
                      title="Play Favorited Songs"
                    >
                      <Play className="w-4 h-4 fill-white ml-0.5" />
                    </button>
                  )}
                </div>
                <p className="text-xs font-semibold text-white truncate leading-tight">Favorited Songs</p>
                <p className="text-[10px] text-neutral-400 truncate mt-0.5">{favoriteSongs.length} tracks</p>
              </div>

              {playlists.slice(0, 5).map((pl) => (
                <div
                  key={pl.id}
                  onClick={() => onNavigate({ type: 'playlist', playlistId: pl.id })}
                  className="p-2 rounded-xl bg-neutral-900/80 hover:bg-neutral-850 border border-neutral-800/80 cursor-pointer active:scale-95 transition"
                >
                  <PlaylistThumbnail
                    artworkUrl={pl.artworkUrl}
                    collageArtworks={pl.collageArtworks}
                    trackCount={pl.trackCount}
                    title={pl.title}
                    rounded="rounded-lg"
                    className="w-full aspect-square mb-1.5"
                    showPlayButton={false}
                  />
                  <p className="text-xs font-semibold text-white truncate leading-tight">{pl.title}</p>
                  <p className="text-[10px] text-neutral-400 truncate mt-0.5">{pl.trackCount} tracks</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. PLAYLISTS VIEW */}
      {tab === 'playlists' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {/* Favorited Songs Playlist Card */}
            <div
              onClick={() => setTab('songs')}
              className="p-2.5 rounded-2xl bg-neutral-900/80 hover:bg-neutral-850 border border-neutral-800/80 cursor-pointer active:scale-95 transition relative group"
            >
              <div className="w-full aspect-square rounded-xl shadow-md mb-2 bg-gradient-to-br from-indigo-700 via-purple-700 to-rose-600 flex flex-col items-center justify-center relative overflow-hidden group-hover:shadow-lg transition">
                <Heart className="w-12 h-12 text-white fill-white drop-shadow-md group-hover:scale-110 transition-transform duration-300" />
                {favoriteSongs.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlaySong(favoriteSongs[0], favoriteSongs);
                    }}
                    className="absolute right-3 bottom-3 w-10 h-10 rounded-full bg-rose-500 hover:bg-rose-400 text-white flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100 cursor-pointer"
                    title="Play Favorited Songs"
                  >
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  </button>
                )}
              </div>
              <p className="text-xs font-semibold text-white truncate">Favorited Songs</p>
              <p className="text-[11px] text-neutral-400 truncate">{favoriteSongs.length} tracks</p>
            </div>

            {playlists.map((pl) => (
              <div
                key={pl.id}
                onClick={() => onNavigate({ type: 'playlist', playlistId: pl.id })}
                className="p-2.5 rounded-2xl bg-neutral-900/80 hover:bg-neutral-850 border border-neutral-800/80 cursor-pointer active:scale-95 transition relative group"
              >
                <PlaylistThumbnail
                  artworkUrl={pl.artworkUrl}
                  collageArtworks={pl.collageArtworks}
                  trackCount={pl.trackCount}
                  title={pl.title}
                  rounded="rounded-xl"
                  className="w-full aspect-square shadow-md mb-2"
                  onPlay={() => {
                    if (pl.tracks && pl.tracks.length > 0) {
                      onPlaySong(pl.tracks[0], pl.tracks);
                    }
                  }}
                />
                <p className="text-xs font-semibold text-white truncate">{pl.title}</p>
                <p className="text-[11px] text-neutral-400 truncate">{pl.trackCount} tracks</p>

                {pl.isCustom && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete playlist "${pl.title}"?`)) {
                        onDeletePlaylist(pl.id);
                      }
                    }}
                    className="absolute top-4 right-4 p-1.5 rounded-full bg-black/70 text-neutral-400 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                    title="Delete playlist"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. FAVORITE SONGS VIEW */}
      {tab === 'songs' && (
        <div className="space-y-3">
          {favoriteSongs.length === 0 ? (
            <div className="text-center py-16 text-neutral-400">
              <Heart className="w-10 h-10 mx-auto mb-2 opacity-40 text-neutral-500" />
              <p className="font-semibold text-white">No Favorite Songs Yet</p>
              <p className="text-xs text-neutral-500 mt-1">
                Tap the heart on any song to add it to your favorites.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-850 bg-neutral-900/70 rounded-xl border border-neutral-800 overflow-hidden">
              {favoriteSongs.map((song) => (
                <div
                  key={song.id}
                  className="flex items-center justify-between p-2 pr-3 hover:bg-neutral-800/80 active:bg-neutral-800 transition"
                >
                  <button
                    onClick={() => onPlaySong(song, favoriteSongs)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left"
                  >
                    <ArtworkImage
                      src={song.artworkUrl}
                      fallbackVideoId={song.id}
                      alt={song.title}
                      rounded="rounded-md"
                      className="w-10 h-10 rounded-md shrink-0 shadow-sm"
                    />
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="text-xs font-semibold text-white truncate leading-tight">{song.title}</p>
                      <p className="text-[10px] text-neutral-400 truncate mt-0.5 leading-tight">{song.artist}</p>
                    </div>
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-neutral-500 tabular-nums">
                      {formatTime(song.duration)}
                    </span>
                    <button
                      onClick={() => onOpenContextMenu(song)}
                      className="p-1.5 rounded-full text-neutral-400 hover:text-white transition"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. SAVED ALBUMS VIEW */}
      {tab === 'albums' && (
        <div className="space-y-4">
          {savedAlbums.length === 0 ? (
            <div className="text-center py-16 text-neutral-400">
              <Disc className="w-10 h-10 mx-auto mb-2 opacity-40 text-neutral-500" />
              <p className="font-semibold text-white">No Saved Albums</p>
              <p className="text-xs text-neutral-500 mt-1">
                Browse or search for albums and tap &quot;Save to Library&quot;.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {savedAlbums.map((album) => (
                <div
                  key={album.id}
                  onClick={() => onNavigate({ type: 'album', albumId: album.id })}
                  className="p-2.5 rounded-2xl bg-neutral-900/80 hover:bg-neutral-850 border border-neutral-800/80 cursor-pointer active:scale-95 transition"
                >
                  <ArtworkImage src={album.artworkUrl} alt={album.title} rounded="rounded-xl" className="w-full aspect-square rounded-xl shadow-md mb-2" />
                  <p className="text-xs font-semibold text-white truncate leading-tight">{album.title}</p>
                  <p className="text-[10px] text-neutral-400 truncate mt-0.5 leading-tight">{album.artist} • {album.releaseYear}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. SAVED ARTISTS VIEW */}
      {tab === 'artists' && (
        <div className="space-y-4">
          {savedArtists.length === 0 ? (
            <div className="text-center py-16 text-neutral-400">
              <User className="w-10 h-10 mx-auto mb-2 opacity-40 text-neutral-500" />
              <p className="font-semibold text-white">No Followed Artists</p>
              <p className="text-xs text-neutral-500 mt-1">
                Follow your favorite artists to keep up with their latest releases.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {savedArtists.map((artist) => (
                <div
                  key={artist.id}
                  onClick={() => onNavigate({ type: 'artist', artistId: artist.id })}
                  className="p-3 rounded-2xl bg-neutral-900/80 hover:bg-neutral-850 border border-neutral-800/80 cursor-pointer active:scale-95 transition text-center"
                >
                  <div className="w-20 h-20 mx-auto rounded-full overflow-hidden shadow-md mb-2 border border-white/10">
                    <ArtworkImage src={artist.avatarUrl} alt={artist.name} aspectRatio="avatar" className="w-full h-full" />
                  </div>
                  <p className="text-xs font-semibold text-white truncate">{artist.name}</p>
                  <p className="text-[11px] text-neutral-400 truncate">{artist.genre}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
