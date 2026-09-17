import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Song, Album, Artist, Playlist, HomeSection, AppView } from '../types';
import { providerManager } from '../services/providerManager';
import { usePlayer } from '../hooks/usePlayer';
import { ArtworkImage } from '../components/common/ArtworkImage';
import { isDemoItem } from '../services/indexedDB';
import { User } from 'firebase/auth';
import {
  Play,
  Pause,
  ChevronRight,
  Sparkles,
  Flame,
  Radio,
  Clock,
  Heart,
  RotateCw,
  Zap,
  Moon,
  Dumbbell,
  Compass,
  MoreVertical,
  Share2,
  Music2,
  Disc,
  Youtube,
  LogIn,
  UserCheck,
  Search,
} from 'lucide-react';

interface HomePageProps {
  onNavigate: (view: AppView) => void;
  onPlaySong: (song: Song, contextQueue?: Song[]) => void;
  onPlayAlbum: (album: Album) => void;
  onPlayPlaylist: (playlist: Playlist) => void;
  onOpenContextMenu?: (song: Song) => void;
  onToggleFavorite?: (song: Song) => void;
  isFavorite?: (songId: string) => boolean;
  recentlyPlayed: Song[];
  favoriteSongs: Song[];
  user?: User | null;
  onOpenAccountModal?: () => void;
}

type MoodFilter = 'all' | 'trending' | 'melody' | 'kuthu' | 'anirudh' | 'rahman' | 'yuvan' | 'classics' | 'chill';

const CACHE_KEY = 'celestial_ytmusic_tamil_home_feed_cache';
const LAST_SYNC_KEY = 'celestial_ytmusic_tamil_last_sync';

export const HomePage: React.FC<HomePageProps> = ({
  onNavigate,
  onPlaySong,
  onPlayAlbum,
  onPlayPlaylist,
  onOpenContextMenu,
  onToggleFavorite,
  isFavorite,
  recentlyPlayed,
  favoriteSongs,
  user,
  onOpenAccountModal,
}) => {
  const player = usePlayer();

  const cleanFavorites = favoriteSongs.filter((s) => !isDemoItem(s));

  const [sections, setSections] = useState<HomeSection[]>(() => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as HomeSection[];
        return parsed.map((sec) => {
          const seenItemKeys = new Set<string>();
          const dedupedItems = (sec.items || []).filter((item) => {
            if (isDemoItem(item)) return false;
            const itemTitle = ('title' in item ? item.title : ('name' in item ? (item as any).name : '')) || '';
            const itemArtist = ('artist' in item ? (item as any).artist : '') || '';
            const itemKey = `${itemTitle.trim().toLowerCase()}:::${itemArtist.trim().toLowerCase()}`;
            if (seenItemKeys.has(itemKey) || seenItemKeys.has(item.id)) return false;
            seenItemKeys.add(itemKey);
            seenItemKeys.add(item.id);
            return true;
          });
          return {
            ...sec,
            items: dedupedItems,
          };
        }).filter((sec) => sec.items.length > 0);
      }
    } catch {}
    return [];
  });

  const [activeMood, setActiveMood] = useState<MoodFilter>('all');
  const [isLoading, setIsLoading] = useState(() => sections.length === 0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Just now');
  const [error, setError] = useState<string | null>(null);

  const lastFetchRef = useRef<number>(0);

  const updateSyncLabel = () => {
    const last = parseInt(sessionStorage.getItem(LAST_SYNC_KEY) || '0', 10);
    if (!last) {
      setLastSyncTime('Just now');
      return;
    }
    const diffSec = Math.floor((Date.now() - last) / 1000);
    if (diffSec < 30) setLastSyncTime('Just now');
    else if (diffSec < 60) setLastSyncTime(`${diffSec}s ago`);
    else if (diffSec < 3600) setLastSyncTime(`${Math.floor(diffSec / 60)}m ago`);
    else setLastSyncTime(`${Math.floor(diffSec / 3600)}h ago`);
  };

  /**
   * Primary Home Data Fetcher with Auto-Refresh & Live Dynamic Variety
   */
  const loadHomeData = useCallback(async (forceRefresh = true, mood: MoodFilter = 'all') => {
    const now = Date.now();
    if (now - lastFetchRef.current < 400) return;
    lastFetchRef.current = now;

    if (sections.length === 0) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);

    try {
      const provider = providerManager.getActiveProvider();
      const moodParam = mood !== 'all' ? mood : undefined;
      const loadedSections = await provider.getHomeSections(forceRefresh, moodParam);

      let rawSections: HomeSection[] = [];
      if (Array.isArray(loadedSections)) {
        rawSections = loadedSections;
      } else if (loadedSections && Array.isArray((loadedSections as any).sections)) {
        rawSections = (loadedSections as any).sections;
      }

      const sanitizedSections: HomeSection[] = rawSections
        .map((sec) => {
          const seenItemKeys = new Set<string>();
          const dedupedItems = (sec.items || []).filter((item) => {
            if (isDemoItem(item)) return false;
            const itemTitle = ('title' in item ? item.title : ('name' in item ? (item as any).name : '')) || '';
            const itemArtist = ('artist' in item ? (item as any).artist : '') || '';
            const itemKey = `${itemTitle.trim().toLowerCase()}:::${itemArtist.trim().toLowerCase()}`;
            if (seenItemKeys.has(itemKey) || seenItemKeys.has(item.id)) return false;
            seenItemKeys.add(itemKey);
            seenItemKeys.add(item.id);
            return true;
          });
          return {
            ...sec,
            items: dedupedItems,
          };
        })
        .filter((sec) => sec.items.length > 0);

      setSections(sanitizedSections);
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(sanitizedSections));
      sessionStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
      updateSyncLabel();
    } catch (e: any) {
      console.warn('Home data refresh error:', e?.message || e);
      if (sections.length === 0) {
        setError('Music service is temporarily reconnecting. Tap to retry.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [sections.length]);

  /**
   * Auto-Refresh on mount and mood changes
   */
  useEffect(() => {
    // Initial load on mount or mood change
    loadHomeData(false, activeMood);

    // Update clock label periodically
    const clockTimer = setInterval(updateSyncLabel, 30_000);

    return () => {
      clearInterval(clockTimer);
    };
  }, [activeMood, loadHomeData]);

  const handleMoodSelect = (mood: MoodFilter) => {
    setActiveMood(mood);
    loadHomeData(true, mood);
  };

  // Play handler that automatically builds a context queue of Tamil recommendations
  const handlePlayAction = (
    item: Song | Playlist | Album,
    contextList?: Song[],
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();

    if ('duration' in item && 'streamUrl' in item) {
      const song = item as Song;
      if (player.currentSong?.id === song.id) {
        if (player.isPlaying) {
          player.pause();
        } else {
          player.play();
        }
      } else {
        // Collect context songs so music automatically keeps playing
        const queueToPlay = contextList && contextList.length > 0 ? contextList : [song];
        onPlaySong(song, queueToPlay);
      }
    } else if ('trackCount' in item && 'tracks' in item) {
      onPlayPlaylist(item as Playlist);
    } else if ('releaseYear' in item && 'tracks' in item) {
      onPlayAlbum(item as Album);
    }
  };

  // Extract Quick Picks section if available
  const quickPicksSection = sections.find((s) => s.id === 'quick-picks' || s.title.toLowerCase().includes('quick picks'));
  const otherSections = sections.filter((s) => s !== quickPicksSection);

  // Group quick picks into 4-song chunks for YouTube Music style swipeable columns
  const quickPicksSongs = (quickPicksSection?.items || []).filter(
    (i) => 'duration' in i && 'streamUrl' in i
  ) as Song[];

  const quickPicksColumns: Song[][] = [];
  for (let i = 0; i < quickPicksSongs.length; i += 4) {
    quickPicksColumns.push(quickPicksSongs.slice(i, i + 4));
  }

  return (
    <div 
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 select-none pt-2 sm:pt-4 space-y-6 sm:space-y-8 pb-36 md:pb-28"
    >
      {/* 1. Category & Mood Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-0.5 scroll-smooth">
        {[
          { id: 'all', label: 'All', icon: Sparkles },
          { id: 'trending', label: 'Trending Tamil', icon: Flame },
          { id: 'melody', label: 'Melody & Romance', icon: Heart },
          { id: 'kuthu', label: 'Mass & Kuthu', icon: Zap },
          { id: 'anirudh', label: 'Anirudh Hits', icon: Disc },
          { id: 'rahman', label: 'A.R. Rahman', icon: Music2 },
          { id: 'yuvan', label: 'Yuvan Vibes', icon: Radio },
          { id: 'classics', label: '90s Classics', icon: Clock },
          { id: 'chill', label: 'Late Night Chill', icon: Moon },
        ].map((pill) => {
          const isActive = activeMood === pill.id;
          const Icon = pill.icon;
          return (
            <button
              key={pill.id}
              id={`ytm-pill-${pill.id}`}
              onClick={() => handleMoodSelect(pill.id as MoodFilter)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all flex items-center gap-1.5 whitespace-nowrap select-none ${
                isActive
                  ? 'bg-white text-black font-bold shadow-lg scale-[1.02]'
                  : 'bg-[#2c2c2e] text-neutral-300 hover:bg-[#3a3a3c] hover:text-white border border-white/5 active:scale-95'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-black' : 'text-neutral-400'}`} />
              <span className="whitespace-nowrap">{pill.label}</span>
            </button>
          );
        })}
      </div>

      {/* Error state */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => loadHomeData(true, activeMood)}
            className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-xs font-semibold active:scale-95 transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && sections.length === 0 && (
        <div className="space-y-4 pt-1">
          <div className="space-y-2">
            <div className="h-3.5 w-28 bg-white/[0.06] rounded animate-pulse" />
            <div className="h-5 w-40 bg-white/[0.1] rounded animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[1, 2, 3, 4].map((c) => (
                <div key={c} className="flex items-center gap-2.5 p-1.5 bg-white/[0.04] rounded-lg animate-pulse">
                  <div className="w-9 h-9 bg-white/[0.08] rounded-md" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 w-28 bg-white/[0.08] rounded" />
                    <div className="h-2.5 w-16 bg-white/[0.05] rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. YouTube Music Quick Picks (Compact 4-Item Swipe Columns) */}
      {quickPicksSongs.length > 0 && (
        <section className="pt-0">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
                Start Radio From a Song
              </span>
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Quick Picks
              </h3>
            </div>
            {quickPicksSongs.length > 0 && (
              <button
                onClick={() => handlePlayAction(quickPicksSongs[0], quickPicksSongs)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white hover:bg-neutral-200 active:scale-95 text-[11px] font-bold text-black transition"
              >
                <Play className="w-3 h-3 fill-black text-black" />
                <span>Play All</span>
              </button>
            )}
          </div>

          {/* Compact 4-row Column Swiper */}
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 snap-x snap-mandatory">
            {quickPicksColumns.map((col, colIdx) => (
              <div
                key={colIdx}
                className="w-[82vw] max-w-[290px] sm:w-[310px] md:w-[340px] lg:w-[360px] shrink-0 space-y-1 snap-start"
              >
                {col.map((song) => {
                  const isPlayingThis = player.isPlaying && player.currentSong?.id === song.id;
                  const isCurrentSong = player.currentSong?.id === song.id;
                  const isFav = isFavorite ? isFavorite(song.id) : false;

                  return (
                    <div
                      key={song.id}
                      id={`quick-pick-${song.id}`}
                      onClick={() => handlePlayAction(song, quickPicksSongs)}
                      className={`group relative flex items-center gap-2.5 p-1.5 pr-2 rounded-lg transition-all cursor-pointer h-12 ${
                        isCurrentSong
                          ? 'bg-rose-500/15 text-rose-300'
                          : 'hover:bg-white/[0.06] active:bg-white/[0.1]'
                      }`}
                    >
                      {/* Compact Thumbnail with overlay play */}
                      <div className="w-9 h-9 shrink-0 rounded-md overflow-hidden relative bg-neutral-800 shadow">
                        <ArtworkImage
                          src={song.artworkUrl}
                          fallbackVideoId={song.id}
                          alt={song.title}
                          rounded="rounded-md"
                          className="w-9 h-9 shrink-0 object-cover"
                          size="small"
                        />
                        <div
                          className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
                            isPlayingThis ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          {isPlayingThis ? (
                            <Pause className="w-3.5 h-3.5 fill-white text-white" />
                          ) : (
                            <Play className="w-3.5 h-3.5 fill-white text-white ml-0.5" />
                          )}
                        </div>
                      </div>

                      {/* Song Details */}
                      <div className="flex-1 min-w-0 pr-1">
                        <p
                          className={`text-xs font-semibold truncate leading-tight ${
                            isCurrentSong ? 'text-rose-400 font-bold' : 'text-white'
                          }`}
                        >
                          {song.title}
                        </p>
                        <p className="text-[10px] text-neutral-400 truncate mt-0.5 leading-tight">
                          {song.artist}
                        </p>
                      </div>

                      {/* Favorite Heart */}
                      {onToggleFavorite && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(song);
                          }}
                          className={`p-1 rounded-full transition ${
                            isFav ? 'text-rose-500' : 'text-neutral-400 hover:text-white sm:opacity-0 sm:group-hover:opacity-100'
                          }`}
                          title="Favorite"
                        >
                          <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-rose-500' : ''}`} />
                        </button>
                      )}

                      {/* 3-Dot Options Menu */}
                      {onOpenContextMenu && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenContextMenu(song);
                          }}
                          className="p-1 text-neutral-400 hover:text-white sm:opacity-0 sm:group-hover:opacity-100 transition rounded-full"
                          title="Options"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. Dynamic YouTube Music Tamil Shelves */}
      {Array.isArray(otherSections) && otherSections.map((section) => {
        const sectionSongs = section.items.filter(
          (i) => 'duration' in i && 'streamUrl' in i && !isDemoItem(i)
        ) as Song[];

        return (
          <section key={section.id} id={`section-${section.id}`} className="pt-0">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-tight">
                  {section.title}
                </h3>
                {section.subtitle && (
                  <p className="text-[10px] text-neutral-400 mt-0.5">{section.subtitle}</p>
                )}
              </div>
              <button
                onClick={() => onNavigate({ type: 'seeAll', sectionId: section.id, title: section.title })}
                className="text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-0.5 shrink-0 ml-2 active:scale-95 transition"
              >
                More <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Compact Horizontally Scrollable Cards Carousel */}
            <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
              {Array.isArray(section.items) && section.items.map((item) => {
                if (isDemoItem(item)) return null;

                // Song item
                if ('duration' in item && 'streamUrl' in item) {
                  const song = item as Song;
                  const isPlayingThis = player.isPlaying && player.currentSong?.id === song.id;
                  const isFav = isFavorite ? isFavorite(song.id) : false;

                  return (
                    <div
                      key={song.id}
                      id={`home-song-${song.id}`}
                      onClick={() => handlePlayAction(song, sectionSongs)}
                      className="w-32 sm:w-36 md:w-40 lg:w-44 xl:w-48 shrink-0 group cursor-pointer active:scale-95 transition"
                    >
                      <div className="relative rounded-xl overflow-hidden shadow mb-1.5 bg-neutral-900 border border-white/5">
                        <ArtworkImage
                          src={song.artworkUrl}
                          fallbackVideoId={song.id}
                          alt={song.title}
                          rounded="rounded-xl"
                          className="w-full aspect-square object-cover"
                        />
                        
                        {/* YouTube Music Play Action Overlay */}
                        <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
                          isPlayingThis ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}>
                          <button
                            onClick={(e) => handlePlayAction(song, sectionSongs, e)}
                            className="w-9 h-9 rounded-full bg-rose-600 text-white flex items-center justify-center shadow hover:scale-105 transition"
                          >
                            {isPlayingThis ? (
                              <Pause className="w-4 h-4 fill-current" />
                            ) : (
                              <Play className="w-4 h-4 fill-current ml-0.5" />
                            )}
                          </button>
                        </div>

                        {/* Favorite Heart Button */}
                        {onToggleFavorite && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleFavorite(song);
                            }}
                            className={`absolute top-1.5 right-1.5 p-1 rounded-full backdrop-blur-md bg-black/40 transition ${
                              isFav ? 'text-rose-500 opacity-100' : 'text-white/70 opacity-0 group-hover:opacity-100 hover:text-white'
                            }`}
                          >
                            <Heart className={`w-3 h-3 ${isFav ? 'fill-rose-500' : ''}`} />
                          </button>
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className={`text-xs font-semibold truncate leading-tight ${player.currentSong?.id === song.id ? 'text-rose-400' : 'text-white'}`}>
                          {song.title}
                        </p>
                        <p className="text-[10px] text-neutral-400 truncate mt-0.5 leading-tight">{song.artist}</p>
                      </div>
                    </div>
                  );
                }

                // Album item
                if ('releaseYear' in item && 'tracks' in item) {
                  const album = item as Album;
                  return (
                    <div
                      key={album.id}
                      id={`home-album-${album.id}`}
                      onClick={() => onNavigate({ type: 'album', albumId: album.id })}
                      className="w-32 sm:w-36 md:w-40 lg:w-44 xl:w-48 shrink-0 group cursor-pointer active:scale-95 transition"
                    >
                      <div className="relative rounded-xl overflow-hidden shadow mb-1.5 bg-neutral-900 border border-white/5">
                        <ArtworkImage
                          src={album.artworkUrl}
                          alt={album.title}
                          rounded="rounded-xl"
                          className="w-full aspect-square object-cover"
                        />
                        <div className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full bg-rose-600 text-white flex items-center justify-center shadow group-hover:scale-105 transition">
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-white truncate leading-tight">{album.title}</p>
                      <p className="text-[10px] text-neutral-400 truncate mt-0.5 leading-tight">{album.artist} • {album.releaseYear}</p>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
};
