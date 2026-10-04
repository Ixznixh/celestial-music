import React, { useEffect, useState } from 'react';
import { Song, Album, Artist, Playlist, AppView } from '../types';
import { providerManager } from '../services/providerManager';
import { ArtworkImage } from '../components/common/ArtworkImage';
import { PlaylistThumbnail } from '../components/common/PlaylistThumbnail';
import { formatTime } from '../utils/formatters';
import { useLongPress } from '../hooks/useLongPress';
import { Play, MoreHorizontal } from 'lucide-react';

interface SeeAllPageProps {
  sectionId: string;
  title: string;
  onNavigate: (view: AppView) => void;
  onPlaySong: (song: Song, queue?: Song[]) => void;
  onOpenContextMenu: (song: Song) => void;
  recentlyPlayed: Song[];
}

export const SeeAllPage: React.FC<SeeAllPageProps> = ({
  sectionId,
  title,
  onNavigate,
  onPlaySong,
  onOpenContextMenu,
  recentlyPlayed,
}) => {
  const [items, setItems] = useState<(Song | Album | Artist | Playlist)[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { getHandlers } = useLongPress<Song>((song) => onOpenContextMenu(song));

  useEffect(() => {
    setIsLoading(true);

    if (sectionId === 'recently-played') {
      const seen = new Set<string>();
      const deduped = recentlyPlayed.filter((s) => {
        const key = `${(s.title || '').trim().toLowerCase()}:::${(s.artist || '').trim().toLowerCase()}`;
        if (seen.has(key) || seen.has(s.id)) return false;
        seen.add(key);
        seen.add(s.id);
        return true;
      });
      setItems(deduped);
      setIsLoading(false);
      return;
    }

    const provider = providerManager.getActiveProvider();

    // 1. Check local session cache for matching section items
    try {
      const cached = sessionStorage.getItem('celestial_ytmusic_tamil_home_feed_cache');
      if (cached) {
        const parsed = JSON.parse(cached) as any[];
        const target = parsed.find((s) => s.id === sectionId || (s.title && s.title.toLowerCase() === title.toLowerCase()));
        if (target && Array.isArray(target.items) && target.items.length > 0) {
          setItems(target.items);
          setIsLoading(false);
          return;
        }
      }
    } catch {}

    // 2. Fetch from home sections or fallback to direct search
    provider.getHomeSections(true).then(async (sections) => {
      let found = false;
      if (Array.isArray(sections)) {
        const target = sections.find((s) => s.id === sectionId || (s.title && s.title.toLowerCase() === title.toLowerCase()));
        if (target && Array.isArray(target.items) && target.items.length > 0) {
          setItems(target.items);
          found = true;
        }
      }

      if (!found && title) {
        try {
          const searchRes = await provider.search(title, 'song');
          if (searchRes.songs && searchRes.songs.length > 0) {
            setItems(searchRes.songs);
          }
        } catch (e) {
          console.warn('SeeAll search fallback error:', e);
        }
      }
      setIsLoading(false);
    }).catch(async () => {
      if (title) {
        try {
          const searchRes = await provider.search(title, 'song');
          if (searchRes.songs && searchRes.songs.length > 0) {
            setItems(searchRes.songs);
          }
        } catch {}
      }
      setIsLoading(false);
    });
  }, [sectionId, title, recentlyPlayed]);

  if (isLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-neutral-500 space-y-2">
        <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs">Loading collection…</span>
      </div>
    );
  }

  return (
    <div 
      className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 select-none pt-2 sm:pt-6 space-y-6 pb-36 md:pb-28"
    >
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">{title}</h2>
        <p className="text-xs sm:text-sm text-neutral-400 mt-0.5">{items.length} items</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
        {Array.isArray(items) && items.map((item, idx) => {
          // Song
          if ('duration' in item && 'streamUrl' in item) {
            const song = item as Song;
            return (
              <div
                key={`${song.id}-${idx}`}
                {...getHandlers(song)}
                onClick={() => onPlaySong(song)}
                className="p-2.5 rounded-2xl bg-neutral-900/60 hover:bg-neutral-850/80 border border-neutral-800/80 cursor-pointer active:scale-95 transition"
              >
                <div className="relative mb-2">
                  <ArtworkImage src={song.artworkUrl} alt={song.title} className="w-full aspect-square rounded-xl shadow-md" />
                  <div className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center shadow">
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </div>
                </div>
                <p className="text-xs font-semibold text-white truncate">{song.title}</p>
                <p className="text-[11px] text-neutral-400 truncate">{song.artist}</p>
              </div>
            );
          }

          // Album
          if ('releaseYear' in item && 'tracks' in item) {
            const album = item as Album;
            return (
              <div
                key={album.id}
                onClick={() => onNavigate({ type: 'album', albumId: album.id })}
                className="p-2.5 rounded-2xl bg-neutral-900/60 hover:bg-neutral-850/80 border border-neutral-800/80 cursor-pointer active:scale-95 transition"
              >
                <ArtworkImage src={album.artworkUrl} alt={album.title} className="w-full aspect-square rounded-xl shadow-md mb-2" />
                <p className="text-xs font-semibold text-white truncate">{album.title}</p>
                <p className="text-[11px] text-neutral-400 truncate">{album.artist} • {album.releaseYear}</p>
              </div>
            );
          }

          // Playlist
          if ('trackCount' in item && 'tracks' in item) {
            const playlist = item as Playlist;
            return (
              <div
                key={playlist.id}
                onClick={() => onNavigate({ type: 'playlist', playlistId: playlist.id })}
                className="p-2.5 rounded-2xl bg-neutral-900/60 hover:bg-neutral-850/80 border border-neutral-800/80 cursor-pointer active:scale-95 transition"
              >
                <PlaylistThumbnail
                  artworkUrl={playlist.artworkUrl}
                  collageArtworks={playlist.collageArtworks}
                  trackCount={playlist.trackCount}
                  title={playlist.title}
                  rounded="rounded-xl"
                  className="w-full aspect-square shadow-md mb-2"
                  onPlay={() => {
                    if (playlist.tracks && playlist.tracks.length > 0) {
                      onPlaySong(playlist.tracks[0], playlist.tracks);
                    }
                  }}
                />
                <p className="text-xs font-semibold text-white truncate">{playlist.title}</p>
                <p className="text-[11px] text-neutral-400 truncate">{playlist.trackCount} tracks</p>
              </div>
            );
          }

          // Artist
          if ('avatarUrl' in item && 'monthlyListeners' in item) {
            const artist = item as Artist;
            return (
              <div
                key={artist.id}
                onClick={() => onNavigate({ type: 'artist', artistId: artist.id })}
                className="p-3 rounded-2xl bg-neutral-900/60 hover:bg-neutral-850/80 border border-neutral-800/80 cursor-pointer active:scale-95 transition text-center"
              >
                <div className="w-20 h-20 mx-auto rounded-full overflow-hidden shadow-md mb-2 border border-white/10">
                  <ArtworkImage src={artist.avatarUrl} alt={artist.name} aspectRatio="avatar" className="w-full h-full" />
                </div>
                <p className="text-xs font-semibold text-white truncate">{artist.name}</p>
                <p className="text-[11px] text-neutral-400 truncate">{artist.genre}</p>
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
};
