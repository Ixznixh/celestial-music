import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import {
  X,
  User as UserIcon,
  CloudCheck,
  RefreshCw,
  LogOut,
  Youtube,
  Heart,
  Music,
  TrendingUp,
  Download,
  Upload,
  Trash2,
  CheckCircle2,
  Loader2,
  Sparkles,
  ShieldCheck,
  HardDrive,
  Cloud,
  CloudOff,
  Database,
  UploadCloud
} from 'lucide-react';
import { User } from 'firebase/auth';
import { signInWithGoogle, signOutUser, fetchUserCachedSongsFromFirestore } from '../../lib/firebase';
import { fetchYouTubeLikedSongs, fetchYouTubeMostViewed, importYouTubePlaylistUrl } from '../../services/youtubeSync';
import { Song, Playlist } from '../../types';
import { db } from '../../services/indexedDB';
import { GlassSwitch } from './GlassSwitch';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  favoriteSongs: Song[];
  onImportPlaylist: (playlist: Playlist) => Promise<void>;
  onClearFavorites?: () => Promise<void>;
  onImportSongsToFavorites?: (songs: Song[]) => void;
  onPlaySong?: (song: Song) => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  user,
  favoriteSongs,
  onImportPlaylist,
  onClearFavorites,
  onImportSongsToFavorites,
  onPlaySong,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'youtube' | 'data'>('youtube');
  const [isSyncingYT, setIsSyncingYT] = useState(false);
  const [ytLikedSongs, setYtLikedSongs] = useState<Song[]>([]);
  const [ytMostViewed, setYtMostViewed] = useState<Song[]>([]);
  const [ytUrlInput, setYtUrlInput] = useState('');
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [cachedTrackCount, setCachedTrackCount] = useState<number>(0);
  const [tabDirection, setTabDirection] = useState<number>(1);
  const [offlineBackupEnabled, setOfflineBackupEnabled] = useState(false);
  const [cloudCachedCount, setCloudCachedCount] = useState<number>(0);
  const [isSyncingBackup, setIsSyncingBackup] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Check cached tracks
      db.getCachedQueueTracks().then((res) => {
        let count = 0;
        if (res.currentTrack) count++;
        if (res.nextTrack) count++;
        count += res.queue?.length || 0;
        setCachedTrackCount(count);
      });

      // Load offline backup setting
      db.getSetting('offline_backup_enabled', false).then((val) => {
        setOfflineBackupEnabled(val);
      });

      // Load cloud backup count
      if (user) {
        fetchUserCachedSongsFromFirestore(user.uid).then((songs) => {
          setCloudCachedCount(songs.length);
        }).catch(() => {});
      } else {
        setCloudCachedCount(0);
      }
    }
  }, [isOpen, user]);

  const handleToggleOfflineBackup = async (checked: boolean) => {
    setOfflineBackupEnabled(checked);
    await db.saveSetting('offline_backup_enabled', checked);
    setSyncSuccessMsg(null);
    
    if (checked) {
      if (!user) {
        setSyncSuccessMsg('Please sign in to enable Cloud Backup!');
        setOfflineBackupEnabled(false);
        await db.saveSetting('offline_backup_enabled', false);
        return;
      }
      setIsSyncingBackup(true);
      try {
        await db.backupAllCachedTracksToFirestore();
        const songs = await fetchUserCachedSongsFromFirestore(user.uid);
        setCloudCachedCount(songs.length);
        setSyncSuccessMsg('Automatic Offline Backup enabled! Your offline tracks are now secured in the cloud.');
      } catch (err) {
        console.error('Backup failed:', err);
        setSyncSuccessMsg('Failed to run initial cloud backup. Try again.');
      } finally {
        setIsSyncingBackup(false);
      }
    } else {
      setSyncSuccessMsg('Automatic Offline Backup disabled.');
    }
  };

  const handleManualCloudBackup = async () => {
    if (!user) return;
    setIsSyncingBackup(true);
    setSyncSuccessMsg(null);
    try {
      await db.backupAllCachedTracksToFirestore();
      const songs = await fetchUserCachedSongsFromFirestore(user.uid);
      setCloudCachedCount(songs.length);
      
      // Also ensure everything in the cloud backup has its audio downloaded locally
      for (const song of songs) {
        db.ensureAudioBlobCached(song).catch(() => {});
      }

      setSyncSuccessMsg('Offline backup completed successfully!');
    } catch (err) {
      console.error('Manual backup failed:', err);
      setSyncSuccessMsg('Backup failed. Please check your internet connection.');
    } finally {
      setIsSyncingBackup(false);
    }
  };

  const handleRestoreCloudBackup = async () => {
    if (!user) return;
    setIsSyncingBackup(true);
    setSyncSuccessMsg(null);
    try {
      const songs = await fetchUserCachedSongsFromFirestore(user.uid);
      if (songs.length === 0) {
        setSyncSuccessMsg('No backed up songs found in the cloud.');
        return;
      }
      // Add to favorites locally
      for (const song of songs) {
        await db.addFavorite(song);
        db.ensureAudioBlobCached(song).catch(() => {});
      }
      if (onImportSongsToFavorites) {
        onImportSongsToFavorites(songs);
      }
      setSyncSuccessMsg(`Restored ${songs.length} cloud-backed tracks into your library!`);
    } catch (err) {
      console.error('Restore failed:', err);
      setSyncSuccessMsg('Failed to restore from cloud backup.');
    } finally {
      setIsSyncingBackup(false);
    }
  };

  const handleSignIn = async () => {
    try {
      setSigningIn(true);
      await signInWithGoogle();
      setSyncSuccessMsg('Successfully signed in with Google Account!');
    } catch (err: any) {
      console.error('Sign-in error:', err);
    } finally {
      setSigningIn(false);
    }
  };

  const handleSyncYouTubeLiked = async () => {
    try {
      setIsSyncingYT(true);
      setSyncSuccessMsg(null);
      
      if (ytUrlInput.trim()) {
        const result = await importYouTubePlaylistUrl(ytUrlInput);
        if (result && result.tracks.length > 0) {
          await onImportPlaylist(result.playlist);
          setSyncSuccessMsg(`Imported playlist "${result.playlist.title}" with ${result.tracks.length} tracks into Your Playlists!`);
          setYtUrlInput('');
          return;
        }
      }

      const tracks = await fetchYouTubeLikedSongs();
      setYtLikedSongs(tracks);
      if (tracks.length > 0) {
        if (onImportSongsToFavorites) {
          onImportSongsToFavorites(tracks);
        }
        setSyncSuccessMsg(`Successfully fetched & synced ${tracks.length} real tracks from YouTube!`);
      } else {
        setSyncSuccessMsg('Paste your YouTube Playlist or Video URL (e.g. https://www.youtube.com/playlist?list=... or https://youtu.be/...) below to sync your exact tracks.');
      }
    } catch (err) {
      console.error('Failed to sync YouTube liked songs:', err);
      setSyncSuccessMsg('Failed to sync YouTube account. Please check URL or connection.');
    } finally {
      setIsSyncingYT(false);
    }
  };

  const handleLoadYouTubeMostViewed = async () => {
    try {
      setIsSyncingYT(true);
      const top = await fetchYouTubeMostViewed();
      setYtMostViewed(top);
    } catch (err) {
      console.error('Failed to load YouTube most viewed:', err);
    } finally {
      setIsSyncingYT(false);
    }
  };

  const handleImportUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ytUrlInput.trim()) return;

    try {
      setIsSyncingYT(true);
      setSyncSuccessMsg(null);
      const result = await importYouTubePlaylistUrl(ytUrlInput);
      if (result && result.tracks.length > 0) {
        await onImportPlaylist(result.playlist);
        setSyncSuccessMsg(`Imported playlist "${result.playlist.title}" with ${result.tracks.length} tracks into Your Playlists!`);
        setYtUrlInput('');
      } else {
        setSyncSuccessMsg('Could not find tracks for the provided YouTube link.');
      }
    } catch (err) {
      console.error('URL import failed:', err);
      setSyncSuccessMsg('Failed to import YouTube playlist. Please check link.');
    } finally {
      setIsSyncingYT(false);
    }
  };

  const handleExportData = () => {
    const dataStr = JSON.stringify(
      {
        favorites: favoriteSongs,
        exportedAt: new Date().toISOString(),
        version: '1.0',
      },
      null,
      2
    );
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `celestial_music_backup_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-hidden"
        >
          {/* Dimmed backdrop layer with dynamic smooth fade */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-xl"
          />

          {/* Modal Window Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ 
              type: 'spring', 
              stiffness: 340, 
              damping: 28,
            }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl bg-black border border-white/15 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_40px_rgba(255,255,255,0.06)] text-white overflow-hidden flex flex-col max-h-[90vh] z-10"
          >
          {/* Top Header Bar */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/10 bg-white/[0.02] shrink-0 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white shrink-0 shadow-[0_0_10px_rgba(255,255,255,0.15)]">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                  Account Management
                </h2>
                <p className="text-xs text-neutral-400 truncate">
                  Google Account, YouTube integration & Cloud Firestore
                </p>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-neutral-300 hover:text-white transition cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </motion.button>
          </div>

          {/* User Profile Card Section */}
          <div className="p-3 sm:p-4.5 border-b border-white/10 bg-gradient-to-r from-neutral-950 via-neutral-900/40 to-neutral-950 shrink-0">
            {user ? (
              <div className="flex items-center justify-between w-full gap-3">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Profile'}
                      className="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl object-cover border-2 border-white/20 shadow-md shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-white/10 border-2 border-white/20 flex items-center justify-center text-lg sm:text-xl text-white font-bold shrink-0">
                      {user.displayName?.charAt(0) || 'U'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                        {user.displayName || 'Google User'}
                      </h3>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[9px] text-emerald-300 font-semibold shrink-0">
                        <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
                        Google Verified
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-0.5 truncate">{user.email}</p>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1 text-[10px] text-neutral-300">
                      <span className="text-neutral-400 shrink-0">
                        {favoriteSongs.length} Liked Tracks
                      </span>
                    </div>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={async () => {
                    await signOutUser();
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 hover:border-white/25 text-neutral-300 hover:text-white text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer shrink-0"
                >
                  <LogOut className="w-3 h-3" />
                  Sign Out
                </motion.button>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full gap-3 p-1">
                <div className="flex items-center gap-3 text-left min-w-0">
                  <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-white shrink-0">
                    <UserIcon className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-white">Sign in with Google</h3>
                    <p className="text-[11px] text-neutral-400 mt-0.5 truncate">
                      Sync playlists and cloud backups
                    </p>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSignIn}
                  disabled={signingIn}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 text-black font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer shrink-0"
                >
                  {signingIn ? (
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                  )}
                  <span>Sign In with Google</span>
                </motion.button>
              </div>
            )}
          </div>

          {/* Nav Tabs */}
          <LayoutGroup id="accountTabsGroup">
            <div className="flex items-center justify-center border-b border-white/10 px-4 py-2.5 bg-black/60 shrink-0 gap-2 select-none overflow-hidden w-full">
              {[
                { id: 'youtube', label: 'YouTube Sync', icon: Youtube },
                { id: 'data', label: 'Cloud Backups', icon: HardDrive },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      const fromIndex = activeTab === 'youtube' ? 0 : 1;
                      const toIndex = tab.id === 'youtube' ? 0 : 1;
                      if (fromIndex !== toIndex) {
                        setTabDirection(toIndex > fromIndex ? 1 : -1);
                      }
                      setActiveTab(tab.id as any);
                    }}
                    className="relative flex-1 max-w-[170px] min-w-0 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-full transition-colors duration-200 cursor-pointer select-none border-0 bg-transparent focus:outline-none"
                  >
                    {isActive && (
                      <motion.div
                        layoutId="accountModalTabIndicator"
                        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                        className="absolute inset-0 bg-white/[0.12] border border-white/20 rounded-full shadow-[0_0_12px_rgba(255,255,255,0.15)]"
                      />
                    )}

                    <div className="relative z-10 flex items-center gap-1.5 min-w-0 pointer-events-none">
                      <Icon 
                        className={`w-3.5 h-3.5 shrink-0 transition-colors duration-200 ${
                          isActive ? 'text-white stroke-[2.2px] drop-shadow-[0_0_6px_rgba(255,255,255,0.8)]' : 'text-neutral-400 stroke-[1.8px]'
                        }`} 
                      />

                      <span 
                        className={`text-[11px] sm:text-[12px] font-bold tracking-wide transition-colors duration-200 truncate ${
                          isActive ? 'text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.5)]' : 'text-neutral-400'
                        }`}
                      >
                        {tab.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </LayoutGroup>

          {/* Modal Scrollable Body */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1 min-h-[250px] scrollbar-thin relative">
            {syncSuccessMsg && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs text-center"
              >
                {syncSuccessMsg}
              </motion.div>
            )}

            <AnimatePresence mode="wait" initial={false}>
              {activeTab === 'youtube' ? (
                <motion.div
                  key="youtube"
                  initial={{ opacity: 0, filter: 'blur(3px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(3px)' }}
                  transition={{ duration: 0.18, ease: 'easeInOut' }}
                  className="space-y-6"
                >
                  {/* Import YouTube Link / Playlist Box */}
                  <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-[0_0_12px_rgba(255,255,255,0.15)]">
                        <Youtube className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-white leading-tight mt-1.5">Import YouTube Playlist URL</h4>
                        <p className="text-[11px] text-neutral-400/80 mt-1 leading-relaxed">
                          Paste any YouTube playlist link (e.g. <span className="text-white/80">https://music.youtube.com/playlist?list=...</span>) to import as a dedicated playlist in Your Playlists with its original name.
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleImportUrl} className="flex items-center gap-2 pt-1 sm:pl-[52px]">
                      <input
                        type="text"
                        value={ytUrlInput}
                        onChange={(e) => setYtUrlInput(e.target.value)}
                        placeholder="https://music.youtube.com/playlist?list=... or video URL"
                        className="flex-1 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 text-xs focus:outline-none focus:border-white/50"
                      />
                      <motion.button
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        type="submit"
                        disabled={isSyncingYT || !ytUrlInput.trim()}
                        className="px-4 py-2 rounded-xl bg-white text-black font-bold text-xs transition cursor-pointer shrink-0 disabled:opacity-50"
                      >
                        {isSyncingYT ? 'Importing...' : 'Import Playlist'}
                      </motion.button>
                    </form>
                  </div>

                  {/* Most Viewed Songs from YouTube */}
                  <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-[0_0_12px_rgba(255,255,255,0.15)]">
                        <TrendingUp className="w-5 h-5 text-white" />
                      </div>
                      <h4 className="text-sm font-bold text-white leading-tight mt-1.5">Most Viewed YouTube Songs</h4>
                    </div>

                    <p className="text-[11px] text-neutral-400/80 sm:pl-[52px] leading-relaxed text-left">
                      Discover and import top trending YouTube music from your Google account profile
                    </p>

                    <div className="pt-1 sm:pl-[52px]">
                      <motion.button
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={handleLoadYouTubeMostViewed}
                        disabled={isSyncingYT}
                        className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                      >
                        <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                        <span>Fetch Top Hits</span>
                      </motion.button>
                    </div>

                    {ytMostViewed.length > 0 && (
                      <div className="space-y-2 pt-2 max-h-40 overflow-y-auto scrollbar-thin">
                        {ytMostViewed.map((song) => (
                          <div
                            key={song.id}
                            className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] transition group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <img
                                src={song.artworkUrl}
                                alt=""
                                className="w-9 h-9 rounded-lg object-cover"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-white truncate">{song.title}</p>
                                <p className="text-[11px] text-neutral-400 truncate">{song.artist}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {onPlaySong && (
                                <button
                                  onClick={() => onPlaySong(song)}
                                  className="px-2.5 py-1 rounded-lg bg-white text-black hover:bg-neutral-200 text-[11px] font-bold transition shadow-sm cursor-pointer"
                                >
                                  Play
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="data"
                  initial={{ opacity: 0, filter: 'blur(3px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(3px)' }}
                  transition={{ duration: 0.18, ease: 'easeInOut' }}
                  className="space-y-4"
                >
                  {/* Automatic Offline Backup Card */}
                  <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 text-left">
                        <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-[0_0_12px_rgba(255,255,255,0.15)]">
                          <Cloud className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-left">
                          <h4 className="text-sm font-bold text-white leading-tight mt-1">Automatic Offline Backup</h4>
                          <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                            Automatically save and sync your offline cached songs and playing queue snapshot to your account cloud storage.
                          </p>
                        </div>
                      </div>
                      
                      <div className="shrink-0 mt-1">
                        <GlassSwitch
                          checked={offlineBackupEnabled}
                          onChange={handleToggleOfflineBackup}
                          disabled={isSyncingBackup}
                        />
                      </div>
                    </div>

                    <div className="sm:pl-[52px] space-y-3 pt-1 text-left">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                        <span className="flex items-center gap-1.5 text-neutral-400">
                          <HardDrive className="w-3.5 h-3.5 text-neutral-400" />
                          Local Cache: <strong className="text-neutral-200">{cachedTrackCount} songs</strong>
                        </span>
                        
                        <span className="flex items-center gap-1.5 text-neutral-400">
                          <Database className="w-3.5 h-3.5 text-neutral-400" />
                          Cloud Backup: <strong className="text-neutral-200">{user ? `${cloudCachedCount} songs` : 'Not Signed In'}</strong>
                        </span>
                      </div>

                      {user ? (
                        <div className="flex flex-wrap items-center gap-2 pt-2">
                          <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={handleManualCloudBackup}
                            disabled={isSyncingBackup}
                            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-[11px] flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                          >
                            {isSyncingBackup ? (
                              <Loader2 className="w-3 h-3 animate-spin text-white" />
                            ) : (
                              <UploadCloud className="w-3 h-3 text-white" />
                            )}
                            Backup Now
                          </motion.button>

                          <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={handleRestoreCloudBackup}
                            disabled={isSyncingBackup || cloudCachedCount === 0}
                            className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/20 border border-white/20 text-white font-semibold text-[11px] flex items-center gap-1.5 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <RefreshCw className={`w-3 h-3 text-white ${isSyncingBackup ? 'animate-spin' : ''}`} />
                            Restore to Library
                          </motion.button>
                        </div>
                      ) : (
                        <p className="text-[10px] text-amber-400/95 bg-amber-400/5 border border-amber-400/15 p-2 rounded-xl">
                          ⚠️ You must be signed in with your Google Account above to back up cached songs to your account login automatically.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Favorited Songs Management */}
                  {favoriteSongs.length > 0 && onClearFavorites && (
                    <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between gap-3">
                      <div className="text-left">
                        <h4 className="text-sm font-bold text-white leading-tight">Favorited Songs ({favoriteSongs.length} tracks)</h4>
                        <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                          Clean up your Favorited Songs list. (Your playlists in Your Playlists will stay safe)
                        </p>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={async () => {
                          if (confirm(`Clear all ${favoriteSongs.length} songs from your Favorited Songs list? (Your playlists will remain untouched)`)) {
                            await onClearFavorites();
                            setSyncSuccessMsg('Favorited Songs list cleared.');
                          }
                        }}
                        className="px-3.5 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 font-semibold text-xs whitespace-nowrap cursor-pointer transition shrink-0"
                      >
                        Clear Favorites
                      </motion.button>
                    </div>
                  )}

                  <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-[0_0_12px_rgba(255,255,255,0.15)]">
                        <HardDrive className="w-5 h-5 text-white" />
                      </div>
                      <h4 className="text-sm font-bold text-white leading-tight mt-1.5">Library Export & Backup</h4>
                    </div>

                    <p className="text-[11px] text-neutral-400/80 sm:pl-[52px] leading-relaxed text-left">
                      Download a standard JSON backup file of your entire Celestial Music library including liked tracks and custom playlists.
                    </p>

                    <div className="flex items-center gap-3 pt-1 sm:pl-[52px]">
                      <motion.button
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={handleExportData}
                        className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-xs flex items-center gap-2 transition cursor-pointer"
                      >
                        <Download className="w-4 h-4 text-white" />
                        Export JSON Backup
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );
};
