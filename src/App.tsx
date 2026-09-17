import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppView, Song, Album, Artist, Playlist, AppSettings } from './types';
import { usePlayer } from './hooks/usePlayer';
import { useLibrary } from './hooks/useLibrary';
import { db } from './services/indexedDB';

// Layout Components
import { TopBar } from './components/layout/TopBar';
import { BottomNav } from './components/layout/BottomNav';
import { MiniPlayer } from './components/layout/MiniPlayer';
import { DesktopPlayerBar } from './components/player/DesktopPlayerBar';
import { OfflineIndicator } from './components/common/OfflineIndicator';

// Pages
import { HomePage } from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { LibraryPage } from './pages/LibraryPage';
import { AlbumPage } from './pages/AlbumPage';
import { ArtistPage } from './pages/ArtistPage';
import { PlaylistPage } from './pages/PlaylistPage';
import { SeeAllPage } from './pages/SeeAllPage';

// Modals
import { NowPlayingModal } from './components/player/NowPlayingModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { AccountModal } from './components/common/AccountModal';
import { TrackContextMenu } from './components/common/TrackContextMenu';
import { AddToPlaylistModal } from './components/common/AddToPlaylistModal';
import { NewPlaylistModal } from './components/common/NewPlaylistModal';
import { subscribeToAuth } from './lib/firebase';
import { User } from 'firebase/auth';

export function App() {
  // Navigation stack
  const [currentView, setCurrentView] = useState<AppView>({ type: 'home' });
  const [history, setHistory] = useState<AppView[]>([]);
  const [navDirection, setNavDirection] = useState<number>(1);

  // Modals
  const [isNowPlayingOpen, setIsNowPlayingOpen] = useState(false);
  const [isMiniPlayerDismissed, setIsMiniPlayerDismissed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [contextMenuSong, setContextMenuSong] = useState<Song | null>(null);
  const [addToPlaylistSong, setAddToPlaylistSong] = useState<Song | null>(null);
  const [isNewPlaylistOpen, setIsNewPlaylistOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToAuth((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Settings
  const [settings, setSettings] = useState<AppSettings>({
    appearance: 'dark',
    audioQuality: 'high',
    crossfade: 0,
    autoplay: true,
    soundCheck: true,
  });

  // Hooks
  const player = usePlayer();
  const library = useLibrary();

  // Helper to determine relative index of view
  const getViewRank = (view: AppView) => {
    switch (view.type) {
      case 'home': return 0;
      case 'search': return 1;
      case 'library': return 2;
      default: return 3;
    }
  };

  const getViewKey = (view: AppView) => {
    switch (view.type) {
      case 'album': return `album-${view.albumId}`;
      case 'artist': return `artist-${view.artistId}`;
      case 'playlist': return `playlist-${view.playlistId}`;
      case 'seeAll': return `seeAll-${view.sectionId}`;
      default: return view.type;
    }
  };

  // Reset mini player dismissal on track change
  useEffect(() => {
    if (player.currentSong) {
      setIsMiniPlayerDismissed(false);
    }
  }, [player.currentSong?.id]);

  // Load persistent settings
  useEffect(() => {
    db.getSetting<AppSettings>('celestial_settings', settings).then((saved) => {
      if (saved) {
        setSettings(saved);
      } else {
        db.getSetting<AppSettings>('luma_settings', settings).then((oldSaved) => {
          if (oldSaved) setSettings(oldSaved);
        });
      }
    });
  }, []);

  // Sync appearance with DOM
  useEffect(() => {
    const root = document.documentElement;
    if (settings.appearance === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else if (settings.appearance === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      // System
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
        root.classList.remove('light');
      } else {
        root.classList.remove('dark');
        root.classList.add('light');
      }
    }
  }, [settings.appearance]);

  // Sync crossfade configuration with player audio engine
  useEffect(() => {
    if (typeof player.setCrossfade === 'function') {
      player.setCrossfade(settings.crossfade || 0);
    }
  }, [settings.crossfade, player.setCrossfade]);

  // Sync audio quality resolution with player audio engine
  useEffect(() => {
    if (typeof player.setAudioQuality === 'function' && settings.audioQuality) {
      player.setAudioQuality(settings.audioQuality);
    }
  }, [settings.audioQuality, player.setAudioQuality]);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      db.saveSetting('celestial_settings', updated);
      return updated;
    });
  };

  // Navigation handlers
  const navigateTo = useCallback((view: AppView) => {
    const currentRank = getViewRank(currentView);
    const targetRank = getViewRank(view);
    setNavDirection(targetRank >= currentRank ? 1 : -1);
    setHistory((prev) => [...prev, currentView]);
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [currentView]);

  const navigateBack = useCallback(() => {
    setNavDirection(-1);
    if (history.length > 0) {
      const prevView = history[history.length - 1];
      setHistory((prev) => prev.slice(0, prev.length - 1));
      setCurrentView(prevView);
    } else {
      setCurrentView({ type: 'home' });
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [history]);

  // Global keyboard shortcuts (Space to toggle, Esc to dismiss modals)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        player.togglePlay();
      } else if (e.code === 'Escape') {
        if (isNowPlayingOpen) setIsNowPlayingOpen(false);
        else if (isSettingsOpen) setIsSettingsOpen(false);
        else if (contextMenuSong) setContextMenuSong(null);
        else if (addToPlaylistSong) setAddToPlaylistSong(null);
        else if (isNewPlaylistOpen) setIsNewPlaylistOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [player, isNowPlayingOpen, isSettingsOpen, contextMenuSong, addToPlaylistSong, isNewPlaylistOpen]);

  // Playback wrappers
  const handlePlaySong = (song: Song, contextQueue?: Song[]) => {
    player.playTrack(song, contextQueue);
  };

  const handlePlayAll = (songs: Song[], shuffle: boolean = false) => {
    if (!songs || songs.length === 0) return;
    const queueToPlay = shuffle ? [...songs].sort(() => Math.random() - 0.5) : [...songs];
    player.playTrack(queueToPlay[0], queueToPlay);
  };

  // Get current view title for TopBar
  const getViewTitle = () => {
    if (currentView.type === 'album') return 'Album';
    if (currentView.type === 'artist') return 'Artist';
    if (currentView.type === 'playlist') return 'Playlist';
    if (currentView.type === 'seeAll') return currentView.title;
    return undefined;
  };

  return (
    <div className="min-h-screen bg-[#000000] text-white flex flex-col selection:bg-white selection:text-black font-sans antialiased relative">
      {/* Offline Connectivity Notification */}
      <OfflineIndicator />

      {/* Top Header Bar */}
      <TopBar
        currentView={currentView}
        onNavigateBack={navigateBack}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAccountModal={() => setIsAccountModalOpen(true)}
        onNavigate={navigateTo}
        title={getViewTitle()}
      />

      {/* Active Screen View */}
      <main className="flex-1 overflow-x-hidden relative min-h-[calc(100vh-8rem)]">
        <AnimatePresence mode="popLayout" custom={navDirection} initial={false}>
          <motion.div
            key={getViewKey(currentView)}
            custom={navDirection}
            initial={{ opacity: 0, x: navDirection * 36, filter: 'blur(3px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: navDirection * -36, filter: 'blur(3px)' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320, mass: 0.55 }}
            className="w-full"
          >
            {currentView.type === 'home' && (
              <HomePage
                onNavigate={navigateTo}
                onPlaySong={handlePlaySong}
                onPlayAlbum={(album) => handlePlayAll(album.tracks)}
                onPlayPlaylist={(pl) => handlePlayAll(pl.tracks)}
                onOpenContextMenu={(song) => setContextMenuSong(song)}
                onToggleFavorite={library.toggleFavorite}
                isFavorite={library.isFavorite}
                recentlyPlayed={library.recentlyPlayed}
                favoriteSongs={library.favoriteSongs}
                user={user}
                onOpenAccountModal={() => setIsAccountModalOpen(true)}
              />
            )}

            {currentView.type === 'search' && (
              <SearchPage
                onNavigate={navigateTo}
                onPlaySong={handlePlaySong}
                onOpenContextMenu={(song) => setContextMenuSong(song)}
              />
            )}

            {currentView.type === 'library' && (
              <LibraryPage
                onNavigate={navigateTo}
                onPlaySong={handlePlaySong}
                onOpenContextMenu={(song) => setContextMenuSong(song)}
                onRequestNewPlaylist={() => setIsNewPlaylistOpen(true)}
                favoriteSongs={library.favoriteSongs}
                savedAlbums={library.savedAlbums}
                savedArtists={library.savedArtists}
                playlists={library.playlists}
                recentlyPlayed={library.recentlyPlayed}
                onDeletePlaylist={library.deletePlaylist}
              />
            )}

            {currentView.type === 'album' && (
              <AlbumPage
                albumId={currentView.albumId}
                onNavigate={navigateTo}
                onPlaySong={handlePlaySong}
                onPlayAll={handlePlayAll}
                onOpenContextMenu={(song) => setContextMenuSong(song)}
                isSaved={library.isAlbumSaved(currentView.albumId)}
                onToggleSaveAlbum={library.toggleSaveAlbum}
              />
            )}

            {currentView.type === 'artist' && (
              <ArtistPage
                artistId={currentView.artistId}
                onNavigate={navigateTo}
                onPlaySong={handlePlaySong}
                onPlayAll={handlePlayAll}
                onOpenContextMenu={(song) => setContextMenuSong(song)}
                isSaved={library.isArtistSaved(currentView.artistId)}
                onToggleSaveArtist={library.toggleSaveArtist}
              />
            )}

            {currentView.type === 'playlist' && (
              <PlaylistPage
                playlistId={currentView.playlistId}
                onNavigate={navigateTo}
                onPlaySong={handlePlaySong}
                onPlayAll={handlePlayAll}
                onOpenContextMenu={(song) => setContextMenuSong(song)}
                userPlaylists={library.playlists}
                onUpdatePlaylist={library.updatePlaylist}
                onDeletePlaylist={library.deletePlaylist}
                onRemoveSongFromPlaylist={library.removeSongFromPlaylist}
                onReorderPlaylist={library.reorderPlaylistTracks}
              />
            )}

            {currentView.type === 'seeAll' && (
              <SeeAllPage
                sectionId={currentView.sectionId}
                title={currentView.title}
                onNavigate={navigateTo}
                onPlaySong={handlePlaySong}
                onOpenContextMenu={(song) => setContextMenuSong(song)}
                recentlyPlayed={library.recentlyPlayed}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Player Error Notification Toast */}
      {player.error && (
        <div className="fixed top-20 sm:top-24 inset-x-4 z-50 max-w-md mx-auto pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between p-3 rounded-2xl bg-neutral-900/95 border border-rose-500/30 text-rose-200 text-xs shadow-2xl backdrop-blur-md">
            <span className="truncate mr-2">{player.error}</span>
            <button
              onClick={() => player.next()}
              className="px-2.5 py-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium shrink-0 transition text-[11px]"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Persistent Mini Player (Mobile and Tablet, floating pill) */}
      <MiniPlayer
        currentSong={player.currentSong}
        isPlaying={player.isPlaying}
        currentTime={player.currentTime}
        duration={player.duration}
        isOpen={!isNowPlayingOpen && !isMiniPlayerDismissed}
        onTogglePlay={player.togglePlay}
        onNext={player.next}
        onPrevious={player.previous}
        onOpenFullPlayer={() => setIsNowPlayingOpen(true)}
        onClose={() => setIsMiniPlayerDismissed(true)}
      />

      {/* Persistent Desktop Player Bar (Desktop/PC, fixed to bottom) */}
      <DesktopPlayerBar
        currentSong={player.currentSong}
        isPlaying={player.isPlaying}
        currentTime={player.currentTime}
        duration={player.duration}
        volume={player.volume}
        isMuted={player.isMuted}
        shuffle={player.shuffle}
        repeat={player.repeat}
        isFavorite={player.currentSong ? library.isFavorite(player.currentSong.id) : false}
        onTogglePlay={player.togglePlay}
        onSeek={player.seek}
        onNext={player.next}
        onPrevious={player.previous}
        onSetVolume={player.setVolume}
        onToggleMute={player.toggleMute}
        onToggleShuffle={player.toggleShuffle}
        onCycleRepeat={player.cycleRepeatMode}
        onToggleFavorite={() => player.currentSong && library.toggleFavorite(player.currentSong)}
        onOpenFullPlayer={() => setIsNowPlayingOpen(true)}
        onOpenQueue={() => setIsNowPlayingOpen(true)}
        onOpenLyrics={() => setIsNowPlayingOpen(true)}
        queueLength={player.queue.length}
      />

      {/* Persistent Bottom Navigation Bar */}
      <BottomNav currentView={currentView} onNavigate={navigateTo} />

      {/* Full Screen Now Playing Sheet */}
      <AnimatePresence>
        {isNowPlayingOpen && player.currentSong && (
          <NowPlayingModal
            isOpen={isNowPlayingOpen}
            onClose={() => setIsNowPlayingOpen(false)}
            currentSong={player.currentSong}
            isPlaying={player.isPlaying}
            currentTime={player.currentTime}
            duration={player.duration}
            volume={player.volume}
            isMuted={player.isMuted}
            shuffle={player.shuffle}
            repeat={player.repeat}
            queue={player.queue}
            queueIndex={player.queueIndex}
            userQueue={player.userQueue}
            suggestionsQueue={player.suggestionsQueue}
            isFavorite={library.isFavorite(player.currentSong.id)}
            settings={settings}
            onUpdateSettings={updateSettings}
            onTogglePlay={player.togglePlay}
            onSeek={player.seek}
            onNext={player.next}
            onPrevious={player.previous}
            onSetVolume={player.setVolume}
            onToggleMute={player.toggleMute}
            onToggleShuffle={player.toggleShuffle}
            onCycleRepeat={player.cycleRepeatMode}
            onToggleFavorite={library.toggleFavorite}
            onSelectTrack={(song, idx) => player.playTrack(song, player.queue)}
            onPlayQueueIndex={player.playQueueIndex}
            isLoadingSuggestions={player.isLoadingSuggestions}
            onClearUpcoming={player.clearUpcoming}
            onClearUserQueue={player.clearUserQueue}
            onClearAutoplayQueue={player.clearAutoplayQueue}
            onLoadMoreSuggestions={() => player.loadSuggestions()}
            onRemoveFromQueue={player.removeFromQueue}
            onReorderQueue={player.reorderQueue}
            onClearQueue={player.clearQueue}
            onNavigateToAlbum={(albumId) => navigateTo({ type: 'album', albumId })}
            onNavigateToArtist={(artistId) => navigateTo({ type: 'artist', artistId })}
          />
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={updateSettings}
        onClearRecentlyPlayed={library.clearRecentlyPlayed}
        onResetLibrary={async () => {
          if (confirm('Clear local database and reset cached library?')) {
            await db.clearAll();
            await library.reloadLibrary();
            setIsSettingsOpen(false);
          }
        }}
      />

      {/* Account Management & Demus YouTube Sync Modal */}
      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        user={user}
        favoriteSongs={library.favoriteSongs}
        onImportSongsToFavorites={async (songs) => {
          for (const s of songs) {
            if (!library.isFavorite(s.id)) {
              await library.toggleFavorite(s);
            }
          }
        }}
        onPlaySong={handlePlaySong}
      />

      {/* Track Overflow Context Menu */}
      {contextMenuSong && (
        <TrackContextMenu
          song={contextMenuSong}
          isOpen={Boolean(contextMenuSong)}
          isFav={library.isFavorite(contextMenuSong.id)}
          onClose={() => setContextMenuSong(null)}
          onToggleFavorite={library.toggleFavorite}
          onPlayNext={player.playNext}
          onAddToQueue={player.addToQueue}
          onAddToPlaylist={(song) => setAddToPlaylistSong(song)}
          onNavigateToAlbum={(albumId) => navigateTo({ type: 'album', albumId })}
          onNavigateToArtist={(artistId) => navigateTo({ type: 'artist', artistId })}
        />
      )}

      {/* Add To Playlist Modal */}
      {addToPlaylistSong && (
        <AddToPlaylistModal
          song={addToPlaylistSong}
          isOpen={Boolean(addToPlaylistSong)}
          playlists={library.playlists}
          onClose={() => setAddToPlaylistSong(null)}
          onAddToPlaylist={library.addSongToPlaylist}
          onCreateNewPlaylist={() => setIsNewPlaylistOpen(true)}
        />
      )}

      {/* New Playlist Modal */}
      <NewPlaylistModal
        isOpen={isNewPlaylistOpen}
        onClose={() => setIsNewPlaylistOpen(false)}
        onCreate={async (title, desc) => {
          const newPl = await library.createPlaylist(title, desc);
          if (addToPlaylistSong) {
            library.addSongToPlaylist(newPl.id, addToPlaylistSong);
            setAddToPlaylistSong(null);
          }
        }}
      />
    </div>
  );
}

export default App;
