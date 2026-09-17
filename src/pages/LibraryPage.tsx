import React, { useState } from 'react';
import { Song, Album, Artist, Playlist, AppView } from '../types';
import { ArtworkImage } from '../components/common/ArtworkImage';
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
  Trash2,
  ArrowDownCircle,
  CheckCircle2,
  HardDrive
} from 'lucide-react';
import { useDownloads, formatBytes } from '../hooks/useDownloads';

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

type LibraryTab = 'overview' | 'downloaded' | 'playlists' | 'songs' | 'albums' | 'artists';

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
  const { downloadedTracks, downloadCount, storageFormatted, clearAllDownloads } = useDownloads();

  return (
    <div 
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 select-none pt-2 sm:pt-4 space-y-6 pb-36 md:pb-28"
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
        {(['overview', 'downloaded', 'playlists', 'songs', 'albums', 'artists'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 rounded-full text-xs font-medium capitalize whitespace-nowrap transition-all flex items-center gap-1.5 ${
              tab === t
                ? 'bg-rose-600 text-white font-semibold shadow'
                : 'bg-white/[0.08] text-neutral-300 hover:bg-white/[0.14] hover:text-white border border-white/[0.04]'
            }`}
          >
            {t === 'downloaded' && <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-400" />}
            <span>{t === 'overview' ? 'Overview' : t === 'downloaded' ? 'Downloaded' : t}</span>
            {t === 'downloaded' && downloadCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${tab === 'downloaded' ? 'bg-black/40 text-white' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {downloadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 1. OVERVIEW VIEW */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {/* Category Rows */}
          <div className="divide-y divide-neutral-800/80 bg-neutral-850/80 rounded-xl border border-neutral-800 overflow-hidden">
            <button
              onClick={() => setTab('downloaded')}
              className="w-full flex items-center justify-between p-3 hover:bg-neutral-800/60 active:bg-neutral-800 text-left transition"
            >
              <div className="flex items-center gap-2.5">
                <ArrowDownCircle className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-white">Downloaded Music</span>
              </div>
              <div className="flex items-center gap-1 text-neutral-400">
                <span className="text-xs font-medium text-emerald-400">
                  {downloadCount > 0 ? `${downloadCount} offline` : '0 offline'}
                </span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </button>

            <button
              onClick={() => setTab('playlists')}
              className="w-full flex items-center justify-between p-3 hover:bg-neutral-800/60 active:bg-neutral-800 text-left transition"
            >
              <div className="flex items-center gap-2.5">
                <ListMusic className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-semibold text-white">Playlists</span>
              </div>
              <div className="flex items-center gap-1 text-neutral-400">
                <span className="text-xs">{playlists.length}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </button>

            <button
              onClick={() => setTab('songs')}
              className="w-full flex items-center justify-between p-3 hover:bg-neutral-800/60 active:bg-neutral-800 text-left transition"
            >
              <div className="flex items-center gap-2.5">
                <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                <span className="text-xs font-semibold text-white">Favorited Songs</span>
              </div>
              <div className="flex items-center gap-1 text-neutral-400">
                <span className="text-xs">{favoriteSongs.length}</span>
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
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-white tracking-tight">Your Playlists</h3>
              <button
                onClick={() => setTab('playlists')}
                className="text-xs text-rose-500 hover:text-rose-400 font-medium"
              >
                See All
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {playlists.slice(0, 6).map((pl) => (
                <div
                  key={pl.id}
                  onClick={() => onNavigate({ type: 'playlist', playlistId: pl.id })}
                  className="p-2 rounded-xl bg-neutral-900/80 hover:bg-neutral-850 border border-neutral-800/80 cursor-pointer active:scale-95 transition"
                >
                  <ArtworkImage src={pl.artworkUrl} alt={pl.title} rounded="rounded-lg" className="w-full aspect-square rounded-lg shadow mb-1.5" />
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
            {playlists.map((pl) => (
              <div
                key={pl.id}
                onClick={() => onNavigate({ type: 'playlist', playlistId: pl.id })}
                className="p-2.5 rounded-2xl bg-neutral-900/80 hover:bg-neutral-850 border border-neutral-800/80 cursor-pointer active:scale-95 transition relative group"
              >
                <ArtworkImage src={pl.artworkUrl} alt={pl.title} className="w-full aspect-square rounded-xl shadow-md mb-2" />
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
                    className="absolute top-4 right-4 p-1.5 rounded-full bg-black/70 text-neutral-400 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition"
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

      {/* DOWNLOADED TRACKS VIEW (SPOTIFY-STYLE TRUE LOCAL OFFLINE) */}
      {tab === 'downloaded' && (
        <div className="space-y-4">
          {/* Header Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-neutral-900/80 to-neutral-900/90 border border-emerald-500/20 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <ArrowDownCircle className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">Downloaded Music</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold tracking-wide">
                    OFFLINE READY
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {downloadCount} {downloadCount === 1 ? 'song' : 'songs'} • {storageFormatted} stored on this device
                </p>
              </div>
            </div>

            {downloadCount > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const songs = downloadedTracks.map((dt) => dt.song);
                    if (songs.length > 0) {
                      onPlaySong(songs[0], songs);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black font-bold text-xs transition shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-black text-black" />
                  <span>Play Offline</span>
                </button>
                <button
                  onClick={clearAllDownloads}
                  className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-neutral-400 hover:text-rose-400 text-xs font-medium transition border border-white/10 cursor-pointer"
                  title="Remove all downloads"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {downloadCount === 0 ? (
            <div className="text-center py-16 px-4 bg-neutral-900/40 rounded-2xl border border-white/5 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-neutral-800 flex items-center justify-center mx-auto text-neutral-500">
                <ArrowDownCircle className="w-7 h-7" />
              </div>
              <div>
                <p className="font-semibold text-white text-sm">No Downloaded Songs</p>
                <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                  Download any song or album to listen anywhere without internet or data usage.
                </p>
              </div>
              <p className="text-[11px] text-neutral-500">
                Tip: Open the context menu (•••) on any track and tap "Download for Offline"
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5 bg-neutral-900/70 rounded-2xl border border-white/10 overflow-hidden">
              {downloadedTracks.map(({ song, sizeBytes }) => (
                <div
                  key={song.id}
                  className="flex items-center justify-between p-2.5 sm:p-3 hover:bg-white/5 active:bg-white/10 transition group"
                >
                  <button
                    onClick={() => {
                      const allDownloadedSongs = downloadedTracks.map((dt) => dt.song);
                      onPlaySong(song, allDownloadedSongs);
                    }}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <div className="relative shrink-0">
                      <ArtworkImage
                        src={song.artworkUrl}
                        fallbackVideoId={song.id}
                        alt={song.title}
                        rounded="rounded-lg"
                        className="w-11 h-11 rounded-lg shadow-sm"
                      />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shadow">
                        <CheckCircle2 className="w-3.5 h-3.5 text-black fill-emerald-500" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="text-xs sm:text-sm font-semibold text-white truncate leading-tight group-hover:text-emerald-400 transition-colors">
                        {song.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-neutral-400 truncate">
                        <span>{song.artist}</span>
                        <span>•</span>
                        <span className="text-[10px] text-emerald-400/80 font-mono">
                          {formatBytes(sizeBytes)}
                        </span>
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-neutral-500 tabular-nums">
                      {formatTime(song.duration)}
                    </span>
                    <button
                      onClick={() => onOpenContextMenu(song)}
                      className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                      aria-label="Track options"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
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
