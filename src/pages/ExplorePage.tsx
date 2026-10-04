import React, { useEffect, useState } from 'react';
import { 
  Compass, 
  Flame, 
  Sparkles, 
  TrendingUp, 
  Radio, 
  Music, 
  Play, 
  ChevronRight, 
  RefreshCw,
  Globe2,
  Headphones,
  Zap,
  Coffee,
  Dumbbell,
  Heart,
  Moon,
  Smile,
  PartyPopper
} from 'lucide-react';
import { Song, Album, Artist, Playlist, AppView } from '../types';
import { providerManager } from '../services/providerManager';
import { ArtworkImage } from '../components/common/ArtworkImage';
import { PlaylistThumbnail } from '../components/common/PlaylistThumbnail';
import { useLongPress } from '../hooks/useLongPress';

interface ExplorePageProps {
  onNavigate: (view: AppView) => void;
  onPlaySong: (song: Song, contextQueue?: Song[]) => void;
  onPlayAlbum: (album: Album) => void;
  onPlayPlaylist: (playlist: Playlist) => void;
  onOpenContextMenu: (song: Song) => void;
}

const MOODS = [
  { id: 'trending', label: 'Trending', icon: Flame, color: 'from-orange-500/20 to-red-500/10 border-orange-500/30 text-orange-400' },
  { id: 'chill', label: 'Chill & Relax', icon: Coffee, color: 'from-teal-500/20 to-emerald-500/10 border-teal-500/30 text-teal-400' },
  { id: 'workout', label: 'Workout', icon: Dumbbell, color: 'from-rose-500/20 to-pink-500/10 border-rose-500/30 text-rose-400' },
  { id: 'focus', label: 'Focus & Study', icon: Headphones, color: 'from-blue-500/20 to-indigo-500/10 border-blue-500/30 text-blue-400' },
  { id: 'party', label: 'Party', icon: PartyPopper, color: 'from-amber-500/20 to-yellow-500/10 border-amber-500/30 text-amber-400' },
  { id: 'romance', label: 'Romance', icon: Heart, color: 'from-pink-500/20 to-rose-500/10 border-pink-500/30 text-pink-400' },
  { id: 'sleep', label: 'Sleep & Ambient', icon: Moon, color: 'from-purple-500/20 to-indigo-500/10 border-purple-500/30 text-purple-400' },
  { id: 'feelgood', label: 'Feel Good', icon: Smile, color: 'from-emerald-500/20 to-green-500/10 border-emerald-500/30 text-emerald-400' },
];

export const ExplorePage: React.FC<ExplorePageProps> = ({
  onNavigate,
  onPlaySong,
  onPlayAlbum,
  onPlayPlaylist,
  onOpenContextMenu,
}) => {
  const [selectedMood, setSelectedMood] = useState<string>('trending');
  const [exploreSongs, setExploreSongs] = useState<Song[]>([]);
  const [trendingAlbums, setTrendingAlbums] = useState<Album[]>([]);
  const [topPlaylists, setTopPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchExploreData = async (mood: string) => {
    setIsLoading(true);
    try {
      const res = await providerManager.search(`${mood} music`);
      setExploreSongs(res.songs.slice(0, 16));
      setTrendingAlbums(res.albums.slice(0, 8));
      setTopPlaylists(res.playlists.slice(0, 8));
    } catch (err) {
      console.error('Failed to load explore data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExploreData(selectedMood);
  }, [selectedMood]);

  const { getHandlers } = useLongPress<Song>((song) => onOpenContextMenu(song));

  return (
    <div className="pb-32 pt-4 px-4 sm:px-6 md:px-8 max-w-[1600px] mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            Explore
            <Compass className="w-6 h-6 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            Discover new releases, charts, and curated YouTube Music categories
          </p>
        </div>

        <button
          onClick={() => fetchExploreData(selectedMood)}
          disabled={isLoading}
          className="p-2 rounded-full bg-white/10 hover:bg-white/15 text-white transition cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Moods & Categories Horizontal Pills */}
      <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-1">
        {MOODS.map((m) => {
          const Icon = m.icon;
          const isSelected = selectedMood === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setSelectedMood(m.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer border ${
                isSelected
                  ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.35)]'
                  : 'bg-white/[0.04] text-neutral-300 border-white/10 hover:bg-white/10'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-black' : 'text-neutral-400'}`} />
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* Trending Songs Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Flame className="w-4.5 h-4.5 text-rose-500" />
            Top {selectedMood.charAt(0).toUpperCase() + selectedMood.slice(1)} Tracks
          </h2>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-16 rounded-2xl bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {exploreSongs.map((song, idx) => (
              <div
                key={song.id}
                {...getHandlers(song)}
                onClick={() => onPlaySong(song, exploreSongs)}
                className="flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-white/15 transition cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-mono font-bold text-neutral-500 w-4 text-center">
                    {idx + 1}
                  </span>
                  <ArtworkImage
                    src={song.artworkUrl}
                    alt=""
                    className="w-11 h-11 rounded-xl object-cover shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white truncate group-hover:text-white">
                      {song.title}
                    </p>
                    <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                      {song.artist}
                    </p>
                  </div>
                </div>

                <div className="p-2 rounded-full bg-white text-black opacity-0 group-hover:opacity-100 transition shrink-0 shadow-md">
                  <Play className="w-3 h-3 fill-black" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Featured Albums & Singles Grid */}
      {trendingAlbums.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4.5 h-4.5 text-amber-400" />
            New Albums & Singles
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {trendingAlbums.map((album) => (
              <div
                key={album.id}
                onClick={() => onNavigate({ type: 'album', albumId: album.id })}
                className="p-2 rounded-2xl bg-neutral-900/60 hover:bg-neutral-900 border border-white/5 hover:border-white/15 transition cursor-pointer group flex flex-col"
              >
                <div className="relative aspect-square rounded-xl overflow-hidden mb-2 bg-neutral-800">
                  <ArtworkImage
                    src={album.artworkUrl}
                    alt={album.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlayAlbum(album);
                      }}
                      className="p-3 rounded-full bg-white text-black hover:scale-110 transition shadow-xl"
                    >
                      <Play className="w-4 h-4 fill-black" />
                    </button>
                  </div>
                </div>

                <p className="text-xs font-bold text-white truncate">{album.title}</p>
                <p className="text-[11px] text-neutral-400 truncate mt-0.5">{album.artist}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Playlists Section */}
      {topPlaylists.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-4.5 h-4.5 text-blue-400" />
            Curated YouTube Playlists
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {topPlaylists.map((playlist) => (
              <div
                key={playlist.id}
                onClick={() => onNavigate({ type: 'playlist', playlistId: playlist.id })}
                className="p-2 rounded-2xl bg-neutral-900/60 hover:bg-neutral-900 border border-white/5 hover:border-white/15 transition cursor-pointer group flex flex-col"
              >
                <div className="relative aspect-square rounded-xl overflow-hidden mb-2 bg-neutral-800">
                  <PlaylistThumbnail
                    artworkUrl={playlist.artworkUrl}
                    collageArtworks={playlist.collageArtworks}
                    trackCount={playlist.trackCount}
                    className="w-full h-full group-hover:scale-105 transition duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlayPlaylist(playlist);
                      }}
                      className="p-3 rounded-full bg-white text-black hover:scale-110 transition shadow-xl"
                    >
                      <Play className="w-4 h-4 fill-black" />
                    </button>
                  </div>
                </div>

                <p className="text-xs font-bold text-white truncate">{playlist.title}</p>
                <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                  {playlist.trackCount || 'YouTube'} tracks
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
