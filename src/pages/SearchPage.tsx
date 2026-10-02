import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { SearchResults, Song, Album, Artist, Playlist, AppView } from '../types';
import { providerManager } from '../services/providerManager';
import { db } from '../services/indexedDB';
import { ArtworkImage } from '../components/common/ArtworkImage';
import { PlaylistThumbnail } from '../components/common/PlaylistThumbnail';
import { formatTime } from '../utils/formatters';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  X, 
  Clock, 
  Play, 
  MoreHorizontal, 
  Sparkles, 
  Disc, 
  User, 
  ListMusic, 
  Music 
} from 'lucide-react';

interface SearchPageProps {
  onNavigate: (view: AppView) => void;
  onPlaySong: (song: Song, queue?: Song[]) => void;
  onOpenContextMenu: (song: Song) => void;
}

const RECENT_SEARCHES_KEY = 'celestial_recent_searches';

const loadRecentSearchesFromStorage = (): string[] => {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length >= 2);
      }
    }
  } catch {
    // ignore
  }
  return [];
};

const saveRecentSearchesToStorage = (list: string[]) => {
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
};

export const SearchPage: React.FC<SearchPageProps> = ({
  onNavigate,
  onPlaySong,
  onOpenContextMenu,
}) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'songs' | 'artists' | 'albums' | 'playlists'>('all');
  const [results, setResults] = useState<SearchResults>({ songs: [], artists: [], albums: [], playlists: [] });
  const [recentSearches, setRecentSearches] = useState<string[]>(() => loadRecentSearchesFromStorage());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const [, startTransition] = useTransition();

  // Load recent searches from localStorage on mount & sync with IndexedDB fallback
  useEffect(() => {
    const stored = loadRecentSearchesFromStorage();
    if (stored.length > 0) {
      setRecentSearches(stored);
    } else {
      db.getSetting<string[]>('recent_searches', []).then((list) => {
        if (list && list.length > 0) {
          const cleaned: string[] = [];
          for (const item of list) {
            const norm = item.toLowerCase().trim();
            if (!norm || norm.length < 2) continue;
            if (!cleaned.some((existing) => existing.toLowerCase() === norm)) {
              cleaned.push(item);
            }
          }
          const final = cleaned.slice(0, 8);
          setRecentSearches(final);
          saveRecentSearchesToStorage(final);
        }
      });
    }
  }, []);

  const saveRecentSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed || trimmed.length < 2) return;
    setRecentSearches((prev) => {
      const norm = trimmed.toLowerCase();
      // Filter out exact duplicates AND substring clutter
      const filtered = prev.filter((item) => {
        const itemNorm = item.toLowerCase();
        if (itemNorm === norm) return false;
        return true;
      });
      const updated = [trimmed, ...filtered].slice(0, 8);
      saveRecentSearchesToStorage(updated);
      db.saveSetting('recent_searches', updated);
      return updated;
    });
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    saveRecentSearchesToStorage([]);
    db.saveSetting('recent_searches', []);
  };

  const removeRecentSearch = (term: string) => {
    setRecentSearches((prev) => {
      const updated = prev.filter((t) => t !== term);
      saveRecentSearchesToStorage(updated);
      db.saveSetting('recent_searches', updated);
      return updated;
    });
  };

  // Debounced search
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults({ songs: [], artists: [], albums: [], playlists: [] });
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    let isCancelled = false;
    const delayMs = retryTrigger > 0 ? 0 : 250;
    const timer = setTimeout(async () => {
      try {
        const provider = providerManager.getActiveProvider();
        const res = await provider.search(trimmed, filter);
        if (!isCancelled) {
          startTransition(() => {
            setResults(res);
            setIsLoading(false);
          });
        }
      } catch (err: any) {
        if (!isCancelled) {
          // If aborted, ignore
          if (err.name === 'AbortError') return;
          console.error('Search error:', err);
          setError('Music service is temporarily unavailable.');
          setIsLoading(false);
        }
      }
    }, delayMs);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [query, filter, retryTrigger]);

  const hasResults =
    results.songs.length > 0 ||
    results.artists.length > 0 ||
    results.albums.length > 0 ||
    results.playlists.length > 0;

  return (
    <div 
      className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 select-none pt-2 sm:pt-4 space-y-6 pb-36 md:pb-28"
    >
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Search</h2>
      </div>

      {/* Compact Search Field */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) {
            saveRecentSearch(query);
          }
        }}
        className="relative flex items-center"
      >
        <Search className="absolute left-3.5 w-4 h-4 text-neutral-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Artists, Songs, Lyrics, and More"
          className="w-full pl-10 pr-9 py-2 rounded-xl bg-neutral-850/90 hover:bg-neutral-800/90 border border-neutral-750/70 text-white placeholder-neutral-400 text-xs focus:outline-none focus:border-rose-500/80 transition shadow-inner"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute right-3 p-1 rounded-full text-neutral-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </form>

      {/* Category filter pills (when query is entered) */}
      {query.trim() && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {(['all', 'songs', 'artists', 'albums', 'playlists'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium capitalize whitespace-nowrap transition-all ${
                filter === cat
                  ? 'bg-rose-600 text-white font-semibold shadow'
                  : 'bg-white/[0.08] text-neutral-300 hover:bg-white/[0.14] hover:text-white border border-white/[0.04]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="py-12 flex flex-col items-center justify-center text-neutral-500 space-y-2">
          <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs">Searching global catalog…</span>
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/40 text-rose-300 text-sm flex items-center justify-between">
          <span className="truncate mr-2">{error}</span>
          <button
            onClick={() => setRetryTrigger((prev) => prev + 1)}
            className="px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition active:scale-95 shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty query state: Clean Recent Searches */}
      {!query.trim() && (
        <div className="space-y-4 pt-1">
          {/* Recent searches */}
          {recentSearches.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                  Recent Searches
                </span>
                <button
                  onClick={clearRecentSearches}
                  className="text-[11px] font-medium text-rose-400 hover:text-rose-300 transition"
                >
                  Clear All
                </button>
              </div>

              <div className="divide-y divide-neutral-800/70 bg-neutral-900/80 rounded-xl border border-neutral-800/80 overflow-hidden">
                {recentSearches.map((term) => (
                  <div
                    key={term}
                    className="flex items-center justify-between px-3 py-2 hover:bg-neutral-800/80 transition group cursor-pointer"
                    onClick={() => {
                      setQuery(term);
                      saveRecentSearch(term);
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Clock className="w-4 h-4 text-neutral-500 shrink-0" />
                      <span className="text-sm text-neutral-200 font-medium truncate">{term}</span>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${term} from search history`}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRecentSearch(term);
                      }}
                      className="text-neutral-500 hover:text-rose-400 p-1 transition rounded-full"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* Search results */}
      {query.trim() && !isLoading && !hasResults && !error && (
        <div className="py-16 text-center text-neutral-400">
          <Search className="w-10 h-10 mx-auto mb-2 opacity-40 text-neutral-500" />
          <p className="font-semibold text-white">No Results Found</p>
          <p className="text-xs text-neutral-500 mt-1">
            Check the spelling or try searching for another artist or track title.
          </p>
        </div>
      )}

      {/* Categorized Results */}
      {query.trim() && !isLoading && hasResults && (
        <div className="space-y-6">
          {/* Top Result Card (Spotify Style) */}
          {filter === 'all' && results.songs.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-rose-500" /> Top Result
              </h3>
              <motion.div
                whileTap={{ scale: 0.98 }}
                onClick={() => onPlaySong(results.songs[0], results.songs)}
                className="relative p-3.5 sm:p-4 rounded-2xl bg-neutral-850 hover:bg-neutral-800 border border-neutral-750/90 hover:border-neutral-700 cursor-pointer transition-all shadow-xl flex items-center justify-between gap-3 sm:gap-4 group"
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="relative shrink-0">
                    <ArtworkImage
                      src={results.songs[0].artworkUrl}
                      fallbackVideoId={results.songs[0].id}
                      alt={results.songs[0].title}
                      rounded="rounded-xl"
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl shadow-xl object-cover"
                    />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300 text-[10px] font-bold uppercase tracking-wider shrink-0">
                        Song
                      </span>
                      <span className="text-xs text-neutral-400 font-medium truncate">
                        {results.songs[0].artist}
                      </span>
                    </div>

                    <h4 className="text-base sm:text-lg font-bold text-white truncate leading-snug group-hover:text-rose-400 transition-colors">
                      {results.songs[0].title}
                    </h4>

                    {results.songs[0].album && results.songs[0].album !== 'Single' && (
                      <p className="text-xs text-neutral-500 truncate">
                        {results.songs[0].album}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenContextMenu(results.songs[0]);
                    }}
                    className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-750 transition"
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </button>

                  <button
                    type="button"
                    aria-label={`Play ${results.songs[0].title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlaySong(results.songs[0], results.songs);
                    }}
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-500/30 group-hover:scale-105 transition-transform"
                  >
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* Songs List */}
          {results.songs.length > 0 && (filter === 'all' || filter === 'songs') && (
            <div>
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-rose-500" /> {filter === 'all' ? 'Songs' : 'All Songs'}
              </h3>
              <div className="divide-y divide-neutral-850 bg-neutral-900/60 rounded-xl border border-neutral-800/80 overflow-hidden">
                {(filter === 'all' ? results.songs.slice(1) : results.songs).map((song) => (
                  <motion.div
                    key={song.id}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center justify-between p-2.5 pr-3 hover:bg-neutral-800/70 active:bg-neutral-800 transition group"
                  >
                    <button
                      onClick={() => onPlaySong(song, results.songs)}
                      className="flex items-center gap-3 min-w-0 flex-1 text-left"
                    >
                      <ArtworkImage
                        src={song.artworkUrl}
                        fallbackVideoId={song.id}
                        alt={song.title}
                        rounded="rounded-md"
                        className="w-11 h-11 rounded-md shrink-0 shadow-sm"
                      />
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="text-xs font-bold text-white truncate leading-tight group-hover:text-rose-400 transition-colors">
                          {song.title}
                        </p>
                        <p className="text-[11px] text-neutral-400 truncate mt-0.5 leading-tight">
                          Song • {song.artist}
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-neutral-500 tabular-nums">
                        {formatTime(song.duration)}
                      </span>
                      <button
                        onClick={() => onOpenContextMenu(song)}
                        className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-700/60 transition"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Artists */}
          {results.artists.length > 0 && (filter === 'all' || filter === 'artists') && (
            <div>
              <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <User className="w-4 h-4 text-rose-500" /> Artists
              </h3>
              <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
                {results.artists.map((artist) => (
                  <div
                    key={artist.id}
                    onClick={() => onNavigate({ type: 'artist', artistId: artist.id })}
                    className="w-28 shrink-0 text-center cursor-pointer group active:scale-95 transition"
                  >
                    <div className="w-24 h-24 mx-auto rounded-full overflow-hidden shadow-md mb-2 border border-white/10">
                      <ArtworkImage src={artist.avatarUrl} alt={artist.name} aspectRatio="avatar" className="w-full h-full" />
                    </div>
                    <p className="text-xs font-semibold text-white truncate">{artist.name}</p>
                    <p className="text-[10px] text-neutral-400 truncate">{artist.genre}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Albums */}
          {results.albums.length > 0 && (filter === 'all' || filter === 'albums') && (
            <div>
              <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Disc className="w-4 h-4 text-rose-500" /> Albums
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {results.albums.map((album) => (
                  <div
                    key={album.id}
                    onClick={() => onNavigate({ type: 'album', albumId: album.id })}
                    className="p-2.5 rounded-2xl bg-neutral-900/60 hover:bg-neutral-850/80 border border-neutral-800/80 cursor-pointer active:scale-95 transition"
                  >
                    <ArtworkImage src={album.artworkUrl} alt={album.title} className="w-full aspect-square rounded-xl shadow-md mb-2" />
                    <p className="text-xs font-semibold text-white truncate">{album.title}</p>
                    <p className="text-[11px] text-neutral-400 truncate">{album.artist} • {album.releaseYear}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Playlists */}
          {results.playlists.length > 0 && (filter === 'all' || filter === 'playlists') && (
            <div>
              <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <ListMusic className="w-4 h-4 text-rose-500" /> Playlists
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {results.playlists.map((playlist) => (
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
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
