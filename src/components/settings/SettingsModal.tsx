import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Sliders, 
  Wifi, 
  Smartphone, 
  Layers, 
  Download, 
  Play, 
  Activity, 
  Volume2, 
  SlidersHorizontal, 
  Sparkles, 
  VolumeX, 
  Radio, 
  Sun, 
  Moon, 
  EyeOff, 
  Maximize2, 
  Video, 
  Music, 
  Languages, 
  Cpu, 
  Folder, 
  Filter, 
  HardDrive, 
  Trash2, 
  BarChart2, 
  Tag, 
  Upload, 
  FileDown, 
  Repeat, 
  Check, 
  Globe, 
  Info,
  ChevronRight,
  ShieldCheck,
  Disc3,
  Zap,
  Battery,
  BatteryCharging,
  Leaf
} from 'lucide-react';
import { AppSettings } from '../../types';
import { GlassSwitch } from '../common/GlassSwitch';
import { SourcesModal } from './SourcesModal';
import { ReplayModal } from './ReplayModal';
import { EqualizerModal } from './EqualizerModal';

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
  const [isEqualizerOpen, setIsEqualizerOpen] = useState(false);
  const [isSourcesOpen, setIsSourcesOpen] = useState(false);
  const [isReplayOpen, setIsReplayOpen] = useState(false);
  const [isAudioQualitySheetOpen, setIsAudioQualitySheetOpen] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [batteryState, setBatteryState] = useState<{ level: number; charging: boolean; supported: boolean }>({
    level: 100,
    charging: false,
    supported: false,
  });

  React.useEffect(() => {
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        const update = () => {
          setBatteryState({
            level: Math.round(battery.level * 100),
            charging: Boolean(battery.charging),
            supported: true,
          });
        };
        update();
        battery.addEventListener('levelchange', update);
        battery.addEventListener('chargingchange', update);
      }).catch(() => {});
    }
  }, []);

  const showToast = (msg: string) => {
    setNoticeMessage(msg);
    setTimeout(() => setNoticeMessage(null), 3000);
  };

  const handleExportData = () => {
    const dataStr = JSON.stringify(
      {
        settings,
        exportedAt: new Date().toISOString(),
        version: '1.7-bitchord',
      },
      null,
      2
    );
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bitchord_settings_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Settings exported successfully!');
  };

  const handleImportData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target?.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const parsed = JSON.parse(event.target?.result as string);
            if (parsed && (parsed.settings || parsed.appearance)) {
              onUpdateSettings(parsed.settings || parsed);
              showToast('Settings and preferences imported!');
            }
          } catch {
            showToast('Invalid JSON backup file');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4"
            onClick={onClose}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.93, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 16 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="w-full max-w-lg max-h-[92vh] rounded-3xl bg-[#09090b] border border-white/15 shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_50px_rgba(255,255,255,0.06)] text-white flex flex-col overflow-hidden pb-safe"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4.5 sm:p-5 border-b border-white/10 bg-white/[0.02]">
                <div className="flex items-center gap-2.5">
                  <Sliders className="w-5 h-5 text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
                  <h2 className="text-base font-bold tracking-tight">Settings</h2>
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

              {/* Toast message if any */}
              {noticeMessage && (
                <div className="p-2.5 bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-300 text-xs text-center">
                  {noticeMessage}
                </div>
              )}

              {/* Scrollable content matching all screenshots */}
              <div className="flex-1 overflow-y-auto no-scrollbar p-4 sm:p-5 space-y-6">

                {/* 1. AUDIO QUALITY */}
                <div>
                  <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-2 px-1">
                    Audio Quality
                  </span>
                  <div className="bg-white/[0.03] rounded-2xl border border-white/10 divide-y divide-white/10 overflow-hidden shadow-sm">
                    {/* Sources subpage */}
                    <div 
                      onClick={() => setIsSourcesOpen(true)}
                      className="p-3.5 flex items-center justify-between hover:bg-white/5 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <Layers className="w-4.5 h-4.5 text-neutral-400" />
                        <div>
                          <p className="text-sm font-medium text-white">Sources</p>
                          <p className="text-xs text-neutral-400">Where audio comes from and the order used</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-neutral-500" />
                    </div>

                    {/* On Wi-Fi */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Wifi className="w-4.5 h-4.5 text-neutral-400" />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-white">On Wi-Fi</p>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-neutral-300 uppercase">In Use</span>
                          </div>
                        </div>
                      </div>
                      <select
                        value={settings.audioQualityWifi || 'lossless'}
                        onChange={(e) => onUpdateSettings({ audioQualityWifi: e.target.value as any })}
                        className="bg-neutral-900 border border-neutral-800 rounded-lg text-xs font-medium text-white px-2.5 py-1.5 focus:outline-none"
                      >
                        <option value="lossless">Lossless</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>

                    {/* On mobile data */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Smartphone className="w-4.5 h-4.5 text-neutral-400" />
                        <div>
                          <p className="text-sm font-medium text-white">On mobile data</p>
                        </div>
                      </div>
                      <select
                        value={settings.audioQualityMobile || 'lossless'}
                        onChange={(e) => onUpdateSettings({ audioQualityMobile: e.target.value as any })}
                        className="bg-neutral-900 border border-neutral-800 rounded-lg text-xs font-medium text-white px-2.5 py-1.5 focus:outline-none"
                      >
                        <option value="lossless">Lossless</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>

                    {/* Dolby Atmos */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Disc3 className="w-4.5 h-4.5 text-neutral-400" />
                        <div>
                          <p className="text-sm font-medium text-white">Dolby Atmos</p>
                          <p className="text-xs text-neutral-400">Atmospheric surround channel virtualization</p>
                        </div>
                      </div>
                      <GlassSwitch
                        checked={settings.dolbyAtmos || false}
                        onChange={(val) => onUpdateSettings({ dolbyAtmos: val })}
                      />
                    </div>
                  </div>
                </div>

                {/* 2. DOWNLOADS */}
                <div>
                  <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-2 px-1">
                    Downloads
                  </span>
                  <div className="bg-white/[0.03] rounded-2xl border border-white/10 divide-y divide-white/10 overflow-hidden shadow-sm">
                    {/* Download quality */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Download className="w-4.5 h-4.5 text-neutral-400" />
                        <div>
                          <p className="text-sm font-medium text-white">Download quality</p>
                          <p className="text-xs text-neutral-400">~35 MB per track, whatever the connection</p>
                        </div>
                      </div>
                      <select
                        value={settings.downloadQuality || 'lossless'}
                        onChange={(e) => onUpdateSettings({ downloadQuality: e.target.value as any })}
                        className="bg-neutral-900 border border-neutral-800 rounded-lg text-xs font-medium text-white px-2.5 py-1.5 focus:outline-none"
                      >
                        <option value="lossless">Lossless</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>

                    {/* Download over Wi-Fi only */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">Download over Wi-Fi only</p>
                      </div>
                      <GlassSwitch
                        checked={settings.downloadOverWifiOnly ?? true}
                        onChange={(val) => onUpdateSettings({ downloadOverWifiOnly: val })}
                      />
                    </div>

                    {/* Export compatible downloads */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">Export compatible downloads</p>
                      </div>
                      <GlassSwitch
                        checked={settings.exportCompatibleDownloads || false}
                        onChange={(val) => onUpdateSettings({ exportCompatibleDownloads: val })}
                      />
                    </div>
                  </div>
                </div>

                {/* 3. PLAYBACK */}
                <div>
                  <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-2 px-1">
                    Playback
                  </span>
                  <div className="bg-white/[0.03] rounded-2xl border border-white/10 divide-y divide-white/10 overflow-hidden shadow-sm">
                    {/* Prefer music-only version */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Play className="w-4.5 h-4.5 text-neutral-400" />
                        <div>
                          <p className="text-sm font-medium text-white">Prefer music-only version</p>
                          <p className="text-xs text-neutral-400">For music videos, load catalogue audio version</p>
                        </div>
                      </div>
                      <GlassSwitch
                        checked={settings.preferMusicOnly || false}
                        onChange={(val) => onUpdateSettings({ preferMusicOnly: val })}
                      />
                    </div>

                    {/* Output precision */}
                    <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-3">
                        <Activity className="w-4.5 h-4.5 text-neutral-400" />
                        <div>
                          <p className="text-sm font-medium text-white">Output precision</p>
                          <p className="text-xs text-neutral-400">AudioTrack • 48.0 kHz • Bit-depth engine</p>
                        </div>
                      </div>
                      <div className="flex items-center bg-black/60 p-1 rounded-xl border border-white/10 self-end sm:self-auto">
                        <button
                          onClick={() => onUpdateSettings({ outputPrecision: '16-bit PCM' })}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                            (settings.outputPrecision || '16-bit PCM') === '16-bit PCM'
                              ? 'bg-white text-black shadow'
                              : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          16-bit PCM
                        </button>
                        <button
                          onClick={() => onUpdateSettings({ outputPrecision: '32-bit float' })}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                            settings.outputPrecision === '32-bit float'
                              ? 'bg-white text-black shadow'
                              : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          32-bit float
                        </button>
                      </div>
                    </div>

                    {/* Prefer USB DAC */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">Prefer USB DAC</p>
                      </div>
                      <GlassSwitch
                        checked={settings.preferUsbDac || false}
                        onChange={(val) => onUpdateSettings({ preferUsbDac: val })}
                      />
                    </div>

                    {/* Loudness normalization */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Volume2 className="w-4.5 h-4.5 text-neutral-400" />
                        <div>
                          <p className="text-sm font-medium text-white">Loudness normalization</p>
                          <p className="text-xs text-neutral-400">Levels every track to the same loudness</p>
                        </div>
                      </div>
                      <GlassSwitch
                        checked={settings.loudnessNormalization ?? true}
                        onChange={(val) => onUpdateSettings({ loudnessNormalization: val })}
                      />
                    </div>

                    {/* Crossfade */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <SlidersHorizontal className="w-4.5 h-4.5 text-neutral-400" />
                        <div>
                          <p className="text-sm font-medium text-white">Crossfade</p>
                          <p className="text-xs text-neutral-400">Blends one track into the next</p>
                        </div>
                      </div>
                      <select
                        value={settings.crossfade || 0}
                        onChange={(e) => onUpdateSettings({ crossfade: parseInt(e.target.value) })}
                        className="bg-neutral-900 border border-neutral-800 rounded-lg text-xs font-medium text-white px-2.5 py-1.5 focus:outline-none"
                      >
                        <option value={0}>Off</option>
                        <option value={2}>2s</option>
                        <option value={4}>4s</option>
                        <option value={8}>8s</option>
                        <option value={12}>12s</option>
                      </select>
                    </div>

                    {/* Automix [BETA] */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Sparkles className="w-4.5 h-4.5 text-neutral-400" />
                        <div>
                          <p className="text-sm font-medium text-white">Automix [BETA]</p>
                          <p className="text-xs text-neutral-400">Times and blends transitions automatically</p>
                        </div>
                      </div>
                      <GlassSwitch
                        checked={settings.automix || false}
                        onChange={(val) => onUpdateSettings({ automix: val })}
                      />
                    </div>

                    {/* Automix performance */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Cpu className="w-4.5 h-4.5 text-neutral-400" />
                        <div>
                          <p className="text-sm font-medium text-white">Automix performance</p>
                          <p className="text-xs text-neutral-400">Sets how much background analysis may use</p>
                        </div>
                      </div>
                      <select
                        value={settings.automixPerformance || 'Balanced'}
                        onChange={(e) => onUpdateSettings({ automixPerformance: e.target.value as any })}
                        className="bg-neutral-900 border border-neutral-800 rounded-lg text-xs font-medium text-white px-2.5 py-1.5 focus:outline-none"
                      >
                        <option value="Balanced">Balanced</option>
                        <option value="High">High</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>

                    {/* Skip silence */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <VolumeX className="w-4.5 h-4.5 text-neutral-400" />
                        <div>
                          <p className="text-sm font-medium text-white">Skip silence</p>
                          <p className="text-xs text-neutral-400">Trim gaps longer than a second</p>
                        </div>
                      </div>
                      <GlassSwitch
                        checked={settings.skipSilence || false}
                        onChange={(val) => onUpdateSettings({ skipSilence: val })}
                      />
                    </div>

                    {/* Spatial audio */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Radio className="w-4.5 h-4.5 text-neutral-400" />
                        <div>
                          <p className="text-sm font-medium text-white">Spatial audio</p>
                          <p className="text-xs text-neutral-400">Widens stereo tracks for a more immersive feel</p>
                        </div>
                      </div>
                      <GlassSwitch
                        checked={settings.spatialAudio || false}
                        onChange={(val) => onUpdateSettings({ spatialAudio: val })}
                      />
                    </div>

                    {/* Equalizer */}
                    <div 
                      onClick={() => setIsEqualizerOpen(true)}
                      className="p-3.5 flex items-center justify-between hover:bg-white/5 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <Sliders className="w-4.5 h-4.5 text-neutral-400" />
                        <div>
                          <p className="text-sm font-medium text-white">Equalizer</p>
                          <p className="text-xs text-neutral-400">
                            {settings.equalizerEnabled ? `Enabled • ${settings.equalizerPreset || 'Custom'}` : 'Tone, seven bands and balance'}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-neutral-500" />
                    </div>
                  </div>
                </div>

                {/* 4. APPEARANCE */}
                <div>
                  <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-2 px-1">
                    Appearance
                  </span>
                  <div className="bg-white/[0.03] rounded-2xl border border-white/10 divide-y divide-white/10 overflow-hidden shadow-sm">
                    {/* Theme selector */}
                    <div className="p-3.5 space-y-2">
                      <div className="flex items-center gap-2">
                        <Sun className="w-4 h-4 text-neutral-400" />
                        <p className="text-sm font-medium text-white">Theme</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2 bg-black/60 p-1 rounded-xl border border-white/10">
                        {['system', 'light', 'dark'].map((t) => (
                          <button
                            key={t}
                            onClick={() => onUpdateSettings({ appearance: t as any })}
                            className={`py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                              settings.appearance === t
                                ? 'bg-white text-black shadow'
                                : 'text-neutral-400 hover:text-white'
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Reduce animation */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <EyeOff className="w-4.5 h-4.5 text-neutral-400" />
                        <div>
                          <p className="text-sm font-medium text-white">Reduce animation</p>
                          <p className="text-xs text-neutral-400">Freezes the main player's gradient instead of drifting</p>
                        </div>
                      </div>
                      <GlassSwitch
                        checked={settings.reduceAnimation || false}
                        onChange={(val) => onUpdateSettings({ reduceAnimation: val })}
                      />
                    </div>

                    {/* Reduce dynamic blur */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">Reduce dynamic blur</p>
                        <p className="text-xs text-neutral-400">Swaps frosted glass for solid fills across the app</p>
                      </div>
                      <GlassSwitch
                        checked={settings.reduceDynamicBlur || false}
                        onChange={(val) => onUpdateSettings({ reduceDynamicBlur: val })}
                      />
                    </div>

                    {/* Liquid Glass */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Sparkles className="w-4.5 h-4.5 text-neutral-400" />
                        <div>
                          <p className="text-sm font-medium text-white">Liquid Glass</p>
                          <p className="text-xs text-neutral-400">Real refracting glass on the floating nav bar</p>
                        </div>
                      </div>
                      <GlassSwitch
                        checked={settings.liquidGlass ?? true}
                        onChange={(val) => onUpdateSettings({ liquidGlass: val })}
                      />
                    </div>

                    {/* Full-screen cover art */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Maximize2 className="w-4.5 h-4.5 text-neutral-400" />
                        <div>
                          <p className="text-sm font-medium text-white">Full-screen cover art</p>
                          <p className="text-xs text-neutral-400">Runs cover to player edges instead of a square sleeve</p>
                        </div>
                      </div>
                      <GlassSwitch
                        checked={settings.fullscreenCoverArt || false}
                        onChange={(val) => onUpdateSettings({ fullscreenCoverArt: val })}
                      />
                    </div>

                    {/* Legacy mesh gradient */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">Legacy mesh gradient</p>
                        <p className="text-xs text-neutral-400">Brings back drifting colour blobs behind the player</p>
                      </div>
                      <GlassSwitch
                        checked={settings.legacyMeshGradient || false}
                        onChange={(val) => onUpdateSettings({ legacyMeshGradient: val })}
                      />
                    </div>

                    {/* Animated cover art */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Video className="w-4.5 h-4.5 text-neutral-400" />
                        <div>
                          <p className="text-sm font-medium text-white">Animated cover art</p>
                          <p className="text-xs text-neutral-400">Plays looping video or canvas releases</p>
                        </div>
                      </div>
                      <GlassSwitch
                        checked={settings.animatedCoverArt ?? true}
                        onChange={(val) => onUpdateSettings({ animatedCoverArt: val })}
                      />
                    </div>

                    {/* Play animated cover over cellular */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">Play animated cover over cellular</p>
                      </div>
                      <GlassSwitch
                        checked={settings.playAnimatedCoverOverCellular || false}
                        onChange={(val) => onUpdateSettings({ playAnimatedCoverOverCellular: val })}
                      />
                    </div>

                    {/* Synced lyrics */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Music className="w-4.5 h-4.5 text-neutral-400" />
                        <div>
                          <p className="text-sm font-medium text-white">Synced lyrics</p>
                          <p className="text-xs text-neutral-400">Lights up words on the player as they're sung</p>
                        </div>
                      </div>
                      <GlassSwitch
                        checked={settings.syncedLyrics ?? true}
                        onChange={(val) => onUpdateSettings({ syncedLyrics: val })}
                      />
                    </div>

                    {/* Blur unfocused lyrics */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">Blur unfocused lyrics</p>
                        <p className="text-xs text-neutral-400">Keeps the spotlight on the current line</p>
                      </div>
                      <GlassSwitch
                        checked={settings.blurUnfocusedLyrics ?? true}
                        onChange={(val) => onUpdateSettings({ blurUnfocusedLyrics: val })}
                      />
                    </div>

                    {/* Lyrics sources */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Globe className="w-4.5 h-4.5 text-neutral-400" />
                        <div>
                          <p className="text-sm font-medium text-white">Lyrics sources</p>
                          <p className="text-xs text-neutral-400">LRCLIB, YouTube captions, PaxSenix, Genius</p>
                        </div>
                      </div>
                      <select
                        value={settings.lyricsSource || 'all'}
                        onChange={(e) => onUpdateSettings({ lyricsSource: e.target.value })}
                        className="bg-neutral-900 border border-neutral-800 rounded-lg text-xs font-medium text-white px-2.5 py-1.5 focus:outline-none"
                      >
                        <option value="all">Auto (All Sources)</option>
                        <option value="lrclib">LRCLIB</option>
                        <option value="youtube">YouTube Captions</option>
                        <option value="musixmatch">Musixmatch</option>
                        <option value="genius">Genius</option>
                      </select>
                    </div>

                    {/* Translation language */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Languages className="w-4.5 h-4.5 text-neutral-400" />
                        <div>
                          <p className="text-sm font-medium text-white">Translation language</p>
                          <p className="text-xs text-neutral-400">Follows the app language</p>
                        </div>
                      </div>
                      <select
                        value={settings.translationLanguage || 'en'}
                        onChange={(e) => onUpdateSettings({ translationLanguage: e.target.value })}
                        className="bg-neutral-900 border border-neutral-800 rounded-lg text-xs font-medium text-white px-2.5 py-1.5 focus:outline-none"
                      >
                        <option value="en">English</option>
                        <option value="hi">Hindi</option>
                        <option value="ta">Tamil</option>
                        <option value="te">Telugu</option>
                        <option value="es">Spanish</option>
                        <option value="ja">Japanese</option>
                        <option value="ko">Korean</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 5. BATTERY & LOW POWER MODE */}
                <div>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">
                      Battery & Power Saving
                    </span>
                    {settings.lowPowerMode && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                        <Zap className="w-2.5 h-2.5 fill-amber-300" />
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div className="bg-white/[0.03] rounded-2xl border border-white/10 divide-y divide-white/10 overflow-hidden shadow-sm">
                    {/* Master Low Power Mode switch */}
                    <div className="p-3.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                          settings.lowPowerMode ? 'bg-amber-500/25 text-amber-400 border border-amber-500/40' : 'bg-white/5 text-neutral-400'
                        }`}>
                          <Zap className={`w-4.5 h-4.5 ${settings.lowPowerMode ? 'fill-amber-400 text-amber-400' : ''}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-white">Low Power Mode</p>
                            {batteryState.supported && (
                              <span className="text-[10px] font-mono text-neutral-400 flex items-center gap-1">
                                {batteryState.charging ? <BatteryCharging className="w-3 h-3 text-emerald-400" /> : <Battery className="w-3 h-3 text-amber-400" />}
                                {batteryState.level}%
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-neutral-400 mt-0.5">
                            Reduces background task frequency and stops visual animations to preserve battery life while listening to music in the background.
                          </p>
                        </div>
                      </div>
                      <GlassSwitch
                        checked={settings.lowPowerMode || false}
                        onChange={(val) => {
                          onUpdateSettings({
                            lowPowerMode: val,
                            ...(val ? { highPerformanceMode: false } : {}),
                          });
                          showToast(val ? 'Low Power Mode activated' : 'Low Power Mode deactivated');
                        }}
                      />
                    </div>

                    {/* Active Optimizations Status Box */}
                    {settings.lowPowerMode && (
                      <div className="p-3.5 bg-amber-500/[0.08] text-xs space-y-2 border-l-2 border-l-amber-500">
                        <div className="flex items-center justify-between font-semibold text-amber-300">
                          <span className="flex items-center gap-1.5">
                            <Leaf className="w-3.5 h-3.5 text-amber-400" />
                            Active Power Conservation
                          </span>
                          {batteryState.supported ? (
                            <span className="font-mono text-[11px] text-amber-200/90">
                              {batteryState.charging ? '⚡ Charging' : `🔋 ${batteryState.level}% remaining`}
                            </span>
                          ) : (
                            <span className="text-[10px] text-neutral-400">Background Engine Engaged</span>
                          )}
                        </div>

                        {batteryState.supported && (
                          <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                batteryState.level <= 20
                                  ? 'bg-rose-500'
                                  : batteryState.level <= 50
                                  ? 'bg-amber-400'
                                  : 'bg-emerald-400'
                              }`}
                              style={{ width: `${batteryState.level}%` }}
                            />
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[11px] text-neutral-300">
                          <div className="flex items-center gap-1.5">
                            <span className="text-amber-400">✓</span>
                            <span>CPU polling throttled to 1.0s – 2.0s</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-amber-400">✓</span>
                            <span>60fps lyrics rAF loop halted</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-amber-400">✓</span>
                            <span>Spinning artwork & CSS animations frozen</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-amber-400">✓</span>
                            <span>Screen wake lock dropped when backgrounded</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-amber-400">✓</span>
                            <span>Eager network prefetch deferred</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-amber-400">✓</span>
                            <span>Dynamic GPU blurs suspended</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Auto-enable on low battery */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Battery className="w-4.5 h-4.5 text-neutral-400" />
                        <div>
                          <p className="text-sm font-medium text-white">Auto-enable on low battery (≤ 20%)</p>
                          <p className="text-xs text-neutral-400">
                            Automatically activates Low Power Mode when your battery drops below 20%
                          </p>
                        </div>
                      </div>
                      <GlassSwitch
                        checked={settings.autoLowPowerOnBattery || false}
                        onChange={(val) => onUpdateSettings({ autoLowPowerOnBattery: val })}
                      />
                    </div>

                    {/* Reduce background sync & polling */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">Reduce background sync & polling</p>
                        <p className="text-xs text-neutral-400">
                          Throttles playback progress intervals and reduces cellular radio wakeups
                        </p>
                      </div>
                      <GlassSwitch
                        checked={settings.lowPowerBackgroundSync ?? true}
                        onChange={(val) => onUpdateSettings({ lowPowerBackgroundSync: val })}
                      />
                    </div>

                    {/* Freeze visual animations */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">Stop visual animations</p>
                        <p className="text-xs text-neutral-400">
                          Freezes spinning discs, animated cover art, and eliminates 60fps lyric renders
                        </p>
                      </div>
                      <GlassSwitch
                        checked={settings.lowPowerStopAnimations ?? true}
                        onChange={(val) => onUpdateSettings({ lowPowerStopAnimations: val })}
                      />
                    </div>
                  </div>
                </div>

                {/* 6. PERFORMANCE & LOCAL MUSIC */}
                <div>
                  <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-2 px-1">
                    Performance & Local Music
                  </span>
                  <div className="bg-white/[0.03] rounded-2xl border border-white/10 divide-y divide-white/10 overflow-hidden shadow-sm">
                    {/* High performance mode */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Cpu className="w-4.5 h-4.5 text-neutral-400" />
                        <div>
                          <p className="text-sm font-medium text-white">High performance mode</p>
                          <p className="text-xs text-neutral-400">Uses full animations and requests higher refresh rate</p>
                        </div>
                      </div>
                      <GlassSwitch
                        checked={settings.highPerformanceMode || false}
                        onChange={(val) => onUpdateSettings({ highPerformanceMode: val })}
                      />
                    </div>

                    {/* Local music folder */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Folder className="w-4.5 h-4.5 text-neutral-400" />
                        <div>
                          <p className="text-sm font-medium text-white">Local music folder</p>
                          <p className="text-xs text-neutral-400">{settings.localMusicFolder || 'All audio folders'}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-neutral-500" />
                    </div>

                    {/* Filter non-music audio */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Filter className="w-4.5 h-4.5 text-neutral-400" />
                        <div>
                          <p className="text-sm font-medium text-white">Filter non-music audio</p>
                          <p className="text-xs text-neutral-400">Hides clips &lt;30s, voice notes and system sounds</p>
                        </div>
                      </div>
                      <GlassSwitch
                        checked={settings.filterNonMusicAudio ?? true}
                        onChange={(val) => onUpdateSettings({ filterNonMusicAudio: val })}
                      />
                    </div>
                  </div>
                </div>

                {/* 6. STORAGE */}
                <div>
                  <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-2 px-1">
                    Storage
                  </span>
                  <div className="bg-white/[0.03] rounded-2xl border border-white/10 divide-y divide-white/10 overflow-hidden shadow-sm">
                    {/* Song cache limit */}
                    <div className="p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <HardDrive className="w-4 h-4 text-neutral-400" />
                          <p className="text-sm font-medium text-white">Song cache limit</p>
                        </div>
                        <span className="text-xs font-mono font-bold text-white">
                          {(settings.songCacheLimitMB || 512) === 0 ? 'Unlimited' : `${settings.songCacheLimitMB || 512} MB`}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400">Keeps downloaded audio on disk for instant playback</p>
                      <input
                        type="range"
                        min="256"
                        max="2048"
                        step="256"
                        value={settings.songCacheLimitMB || 512}
                        onChange={(e) => onUpdateSettings({ songCacheLimitMB: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-white"
                      />
                    </div>

                    {/* Clear song cache */}
                    <button
                      onClick={onClearRecentlyPlayed}
                      className="w-full p-3.5 flex items-center justify-between text-left hover:bg-white/5 transition cursor-pointer"
                    >
                      <div>
                        <p className="text-sm font-medium text-neutral-200">Clear song cache</p>
                        <p className="text-xs text-neutral-400">Frees space used by downloaded audio</p>
                      </div>
                      <Trash2 className="w-4 h-4 text-neutral-400" />
                    </button>

                    {/* Clear image cache */}
                    <button
                      onClick={() => showToast('Image cache cleaned!')}
                      className="w-full p-3.5 flex items-center justify-between text-left hover:bg-white/5 transition cursor-pointer"
                    >
                      <div>
                        <p className="text-sm font-medium text-neutral-200">Clear image cache</p>
                        <p className="text-xs text-neutral-400">Frees space used by album artwork</p>
                      </div>
                      <Trash2 className="w-4 h-4 text-neutral-400" />
                    </button>
                  </div>
                </div>

                {/* 7. YOUR DATA */}
                <div>
                  <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-2 px-1">
                    Your Data
                  </span>
                  <div className="bg-white/[0.03] rounded-2xl border border-white/10 divide-y divide-white/10 overflow-hidden shadow-sm">
                    {/* Replay */}
                    <div
                      onClick={() => setIsReplayOpen(true)}
                      className="p-3.5 flex items-center justify-between hover:bg-white/5 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <BarChart2 className="w-4.5 h-4.5 text-neutral-400" />
                        <div>
                          <p className="text-sm font-medium text-white">Replay</p>
                          <p className="text-xs text-neutral-400">Your top songs, artists, albums and genres</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-neutral-500" />
                    </div>

                    {/* Work out genres */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Tag className="w-4.5 h-4.5 text-neutral-400" />
                        <div>
                          <p className="text-sm font-medium text-white">Work out genres</p>
                          <p className="text-xs text-neutral-400">Asks Last.fm for an artist's genres</p>
                        </div>
                      </div>
                      <GlassSwitch
                        checked={settings.workOutGenres ?? true}
                        onChange={(val) => onUpdateSettings({ workOutGenres: val })}
                      />
                    </div>

                    {/* Export data */}
                    <button
                      onClick={handleExportData}
                      className="w-full p-3.5 flex items-center justify-between text-left hover:bg-white/5 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <FileDown className="w-4.5 h-4.5 text-neutral-400" />
                        <div>
                          <p className="text-sm font-medium text-white">Export data</p>
                          <p className="text-xs text-neutral-400">Settings and listening history as JSON</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-neutral-500" />
                    </button>

                    {/* Import data */}
                    <button
                      onClick={handleImportData}
                      className="w-full p-3.5 flex items-center justify-between text-left hover:bg-white/5 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <Upload className="w-4.5 h-4.5 text-neutral-400" />
                        <div>
                          <p className="text-sm font-medium text-white">Import data</p>
                          <p className="text-xs text-neutral-400">Replaces settings and history on this device</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-neutral-500" />
                    </button>
                  </div>
                </div>

                {/* 8. MISCELLANEOUS & ADVANCED */}
                <div>
                  <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-2 px-1">
                    Miscellaneous & Advanced
                  </span>
                  <div className="bg-white/[0.03] rounded-2xl border border-white/10 divide-y divide-white/10 overflow-hidden shadow-sm">
                    {/* Play next on swipe */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">Play next on swipe</p>
                        <p className="text-xs text-neutral-400">When disabled, swiping adds to end of queue</p>
                      </div>
                      <GlassSwitch
                        checked={settings.playNextOnSwipe || false}
                        onChange={(val) => onUpdateSettings({ playNextOnSwipe: val })}
                      />
                    </div>

                    {/* Don't repeat songs in current session */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">Don't repeat songs in session</p>
                        <p className="text-xs text-neutral-400">AutoPlay won't suggest already played songs</p>
                      </div>
                      <GlassSwitch
                        checked={settings.dontRepeatSongsInSession || false}
                        onChange={(val) => onUpdateSettings({ dontRepeatSongsInSession: val })}
                      />
                    </div>

                    {/* Stop music on close from recents */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">Stop music on close from recents</p>
                      </div>
                      <GlassSwitch
                        checked={settings.stopMusicOnCloseFromRecents || false}
                        onChange={(val) => onUpdateSettings({ stopMusicOnCloseFromRecents: val })}
                      />
                    </div>

                    {/* Hide volume bar */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">Hide volume bar</p>
                        <p className="text-xs text-neutral-400">Removes volume slider from main player</p>
                      </div>
                      <GlassSwitch
                        checked={settings.hideVolumeBar || false}
                        onChange={(val) => onUpdateSettings({ hideVolumeBar: val })}
                      />
                    </div>

                    {/* Hide Song Status */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">Hide Song Status</p>
                        <p className="text-xs text-neutral-400">Hides "Playing from" text in main player</p>
                      </div>
                      <GlassSwitch
                        checked={settings.hideSongStatus || false}
                        onChange={(val) => onUpdateSettings({ hideSongStatus: val })}
                      />
                    </div>

                    {/* Smart audio alignment */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">Smart audio alignment</p>
                        <p className="text-xs text-neutral-400">Analyze waveforms to match playback moment</p>
                      </div>
                      <GlassSwitch
                        checked={settings.smartAudioAlignment ?? true}
                        onChange={(val) => onUpdateSettings({ smartAudioAlignment: val })}
                      />
                    </div>

                    {/* Show stats for nerds */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">Show stats for nerds</p>
                        <p className="text-xs text-neutral-400">Codec, bitrate and sample rate on the player</p>
                      </div>
                      <GlassSwitch
                        checked={settings.showStatsForNerds || false}
                        onChange={(val) => onUpdateSettings({ showStatsForNerds: val })}
                      />
                    </div>
                  </div>
                </div>

                {/* Reset Library Action */}
                <div className="pt-2">
                  <button
                    onClick={onResetLibrary}
                    className="w-full p-3.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 text-rose-300 flex items-center justify-center gap-2 text-xs font-bold transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    Reset Local Database
                  </button>
                </div>

                {/* Celestial Version Footer */}
                <div className="text-center pt-3 pb-2 text-[11px] text-neutral-500 space-y-1">
                  <p className="font-semibold text-neutral-400">
                    Celestial Music 2.0 <span className="text-neutral-600">•</span> YouTube Music Engine
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sub-modals */}
      <SourcesModal
        isOpen={isSourcesOpen}
        onClose={() => setIsSourcesOpen(false)}
        settings={settings}
        onUpdateSettings={onUpdateSettings}
      />

      <ReplayModal
        isOpen={isReplayOpen}
        onClose={() => setIsReplayOpen(false)}
      />

      <EqualizerModal
        isOpen={isEqualizerOpen}
        onClose={() => setIsEqualizerOpen(false)}
        settings={settings}
        onUpdateSettings={onUpdateSettings}
      />
    </>
  );
};
