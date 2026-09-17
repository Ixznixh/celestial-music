import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Sun, 
  Moon, 
  Smartphone, 
  Sliders, 
  Volume2, 
  Radio, 
  Trash2, 
  Info, 
  Check, 
  ShieldCheck, 
  Sparkles,
  HardDrive,
  ArrowDownCircle
} from 'lucide-react';
import { AppSettings } from '../../types';
import { PWAInstallButton } from '../common/PWAInstallButton';
import { GlassSwitch } from '../common/GlassSwitch';
import { useDownloads } from '../../hooks/useDownloads';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onClearRecentlyPlayed: () => void;
  onResetLibrary: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onClearRecentlyPlayed,
  onResetLibrary,
}) => {
  const { 
    downloadCount, 
    storageFormatted, 
    isOfflineMode, 
    toggleOfflineMode, 
    clearAllDownloads 
  } = useDownloads();
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          onClick={onClose}
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.93, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 16 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="w-full max-w-md max-h-[90vh] rounded-3xl bg-black border border-white/15 shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_50px_rgba(255,255,255,0.06)] text-white flex flex-col overflow-hidden pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <motion.div
                  animate={{ rotate: [0, 15, -15, 0] }}
                  transition={{ duration: 0.5, ease: 'easeInOut' }}
                >
                  <Sliders className="w-5 h-5 text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
                </motion.div>
                <h2 className="text-base font-bold">Settings</h2>
              </div>
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={onClose}
                aria-label="Close settings"
                className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-6">
          {/* Playback Settings */}
          <div>
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-2 px-1">
              Audio & Playback
            </span>
            <div className="bg-white/[0.03] rounded-2xl border border-white/10 divide-y divide-white/10 overflow-hidden shadow-sm">
              {/* Audio Quality */}
              <div className="p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">Audio Quality</p>
                  <p className="text-xs text-neutral-400">Stream resolution & bit-rate</p>
                </div>
                <select
                  value={settings.audioQuality}
                  onChange={(e) => onUpdateSettings({ audioQuality: e.target.value as AppSettings['audioQuality'] })}
                  className="bg-neutral-900 border border-neutral-800 rounded-lg text-xs font-medium text-white px-2.5 py-1.5 focus:outline-none focus:border-white"
                >
                  <option value="normal">Normal (160 kbps)</option>
                  <option value="high">High (320 kbps AAC)</option>
                  <option value="lossless">Lossless (24-bit / 48 kHz)</option>
                  <option value="hires">Hi-Res Lossless (24-bit / 192 kHz)</option>
                </select>
              </div>

              {/* Crossfade */}
              <div className="p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">Crossfade</p>
                  <p className="text-xs text-neutral-400">Smooth transition between tracks</p>
                </div>
                <select
                  value={settings.crossfade}
                  onChange={(e) => onUpdateSettings({ crossfade: Number(e.target.value) })}
                  className="bg-neutral-900 border border-neutral-800 rounded-lg text-xs font-medium text-white px-2.5 py-1.5 focus:outline-none focus:border-white"
                >
                  <option value={0}>Off</option>
                  <option value={2}>2 seconds</option>
                  <option value={4}>4 seconds</option>
                  <option value={8}>8 seconds</option>
                </select>
              </div>

              {/* Autoplay */}
              <div className="p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">Continuous Autoplay</p>
                  <p className="text-xs text-neutral-400">Keep similar songs playing</p>
                </div>
                <GlassSwitch
                  checked={settings.autoplay}
                  onChange={(val) => onUpdateSettings({ autoplay: val })}
                  ariaLabel="Toggle continuous autoplay"
                />
              </div>

              {/* Sound Check / Volume Normalization */}
              <div className="p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">Sound Check</p>
                  <p className="text-xs text-neutral-400">Normalize volume across all songs</p>
                </div>
                <GlassSwitch
                  checked={settings.soundCheck}
                  onChange={(val) => onUpdateSettings({ soundCheck: val })}
                  ariaLabel="Toggle sound check volume normalization"
                />
              </div>
            </div>
          </div>

          {/* Offline & Downloads (Spotify-Style True Local Mode) */}
          <div>
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-2 px-1">
              Offline & Storage
            </span>
            <div className="bg-white/[0.03] rounded-2xl border border-white/10 divide-y divide-white/10 overflow-hidden shadow-sm">
              {/* Offline Mode Toggle */}
              <div className="p-3.5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white">Offline Mode</p>
                    {isOfflineMode && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold tracking-wider">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-400">
                    Only play tracks downloaded to this device
                  </p>
                </div>
                <GlassSwitch
                  checked={isOfflineMode}
                  onChange={(val) => {
                    toggleOfflineMode(val);
                    onUpdateSettings({ offlineMode: val });
                  }}
                  ariaLabel="Toggle offline mode"
                />
              </div>

              {/* Storage Used */}
              <div className="p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-neutral-900 border border-white/10 flex items-center justify-center">
                    <HardDrive className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Device Storage Used</p>
                    <p className="text-xs text-neutral-400">
                      {downloadCount} {downloadCount === 1 ? 'song' : 'songs'} • {storageFormatted}
                    </p>
                  </div>
                </div>
              </div>

              {/* Remove All Downloads */}
              {downloadCount > 0 && (
                <button
                  onClick={clearAllDownloads}
                  className="w-full p-3.5 flex items-center justify-between text-left hover:bg-rose-500/10 text-rose-400 transition"
                >
                  <span className="text-sm font-medium">Remove All Downloads</span>
                  <Trash2 className="w-4 h-4 text-rose-400" />
                </button>
              )}
            </div>
          </div>

          {/* Library Management */}
          <div>
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-2 px-1">
              Library Data
            </span>
            <div className="bg-white/[0.03] rounded-2xl border border-white/10 divide-y divide-white/10 overflow-hidden shadow-sm">
              <button
                onClick={onClearRecentlyPlayed}
                className="w-full p-3.5 flex items-center justify-between text-left hover:bg-white/5 transition"
              >
                <span className="text-sm font-medium text-neutral-200">Clear Recently Played</span>
                <Trash2 className="w-4 h-4 text-neutral-400" />
              </button>

              <button
                onClick={onResetLibrary}
                className="w-full p-3.5 flex items-center justify-between text-left hover:bg-white/5 transition text-white/90"
              >
                <span className="text-sm font-medium">Reset Local Library Database</span>
                <Trash2 className="w-4 h-4 text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]" />
              </button>
            </div>
          </div>

          {/* About Celestial */}
          <div>
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-2 px-1">
              About
            </span>
            <div className="bg-white/[0.03] rounded-2xl border border-white/10 p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white tracking-wide drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">Celestial Music</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-white/10 text-neutral-400">
                  v1.0.0-pwa
                </span>
              </div>

              <p className="text-xs text-neutral-400 leading-relaxed">
                An ad-free, minimal, mobile-first audio streaming platform inspired by Apple design language.
                Built with React, TypeScript, HTML5 Audio, and IndexedDB.
              </p>

              <div className="pt-2 border-t border-neutral-800 flex items-center gap-2 text-xs text-emerald-400 font-medium">
                <ShieldCheck className="w-4 h-4" />
                <span>Zero Ads • No Trackers • Offline Capable</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
    )}
  </AnimatePresence>
  );
};
