import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Layers, 
  Radio, 
  Play, 
  Plus, 
  Cloud, 
  HardDrive, 
  Sliders, 
  AlertTriangle,
  Info,
  CheckCircle2
} from 'lucide-react';
import { AppSettings } from '../../types';
import { GlassSwitch } from '../common/GlassSwitch';

interface SourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
}

export const SourcesModal: React.FC<SourcesModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const [showAddAddon, setShowAddAddon] = useState(false);
  const [addonUrl, setAddonUrl] = useState('');
  const [showWebDAV, setShowWebDAV] = useState(false);
  const [webdavInput, setWebdavInput] = useState(settings.webdavUrl || '');
  const [showSMB, setShowSMB] = useState(false);
  const [smbInput, setSmbInput] = useState(settings.smbShareUrl || '');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const tolerance = settings.trackLengthTolerance ?? 3;

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
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="w-full max-w-lg max-h-[90vh] rounded-3xl bg-[#0e0e11] border border-white/15 shadow-2xl text-white flex flex-col overflow-hidden pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-2.5">
                <Layers className="w-5 h-5 text-white" />
                <h2 className="text-base font-bold text-white">Sources</h2>
              </div>
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={onClose}
                className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-6">
              {statusNotice && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs text-center">
                  {statusNotice}
                </div>
              )}

              {/* Priority Ordered Sources List */}
              <div>
                <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-2 px-1">
                  Sources, tried in this order
                </span>

                <div className="bg-white/[0.03] rounded-2xl border border-white/10 divide-y divide-white/10 overflow-hidden shadow-sm">
                  {/* 1. JioSaavn Native Audio */}
                  <div className="p-4 flex items-center justify-between gap-3 bg-white/[0.02]">
                    <div className="flex items-start gap-3">
                      <span className="text-sm font-bold text-neutral-500 mt-0.5">1</span>
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                        <Radio className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">JioSaavn Native Audio</h4>
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                            Active
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          Direct 320kbps MP4 CDN • Native HTML5 audio for persistent iOS & Android background play
                        </p>
                      </div>
                    </div>
                    <GlassSwitch
                      checked={settings.enableJioSaavnSource !== false}
                      onChange={(val) => {
                        onUpdateSettings({ enableJioSaavnSource: val });
                        setStatusNotice(val ? 'JioSaavn 320kbps native audio source enabled' : 'JioSaavn native audio source disabled');
                      }}
                    />
                  </div>

                  {/* 2. Pure YouTube API (Always On) */}
                  <div className="p-4 bg-white/[0.01]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="text-sm font-bold text-neutral-500 mt-0.5">2</span>
                        <div className="w-8 h-8 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0">
                          <Play className="w-4 h-4 text-red-400 fill-red-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white">Pure YouTube API</h4>
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                              Active
                            </span>
                          </div>
                          <p className="text-xs text-neutral-400 mt-0.5">
                            Full YouTube Catalog • Official Releases, Covers & Live • No API Key Needed
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-emerald-400 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        Connected
                      </span>
                    </div>

                    <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-neutral-400">
                      <code className="text-[11px] font-mono bg-black/40 px-2 py-1 rounded-lg text-neutral-300 border border-white/5">
                        /api/ytmusic
                      </code>
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch('/api/ytmusic');
                            if (res.ok) {
                              setStatusNotice('Pure YouTube API is online and operational!');
                            } else {
                              setStatusNotice('Pure YouTube API check returned status ' + res.status);
                            }
                          } catch {
                            setStatusNotice('Unable to reach Pure YouTube API');
                          }
                        }}
                        className="text-xs text-red-400 hover:text-red-300 font-medium transition cursor-pointer"
                      >
                        Test API Connection
                      </button>
                    </div>
                  </div>

                  {/* 3. Add an addon */}
                  <div 
                    onClick={() => setShowAddAddon(!showAddAddon)}
                    className="p-4 flex items-center justify-between gap-3 hover:bg-white/5 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                        <Plus className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">Add an addon</h4>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          Point Celestial Music at an addon server you host or were given a link to
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {showAddAddon && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-4 mt-2 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2"
                  >
                    <input
                      type="text"
                      placeholder="https://addon.server.url/manifest.json"
                      value={addonUrl}
                      onChange={(e) => setAddonUrl(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={() => {
                          setStatusNotice('Custom addon server connected!');
                          setShowAddAddon(false);
                          setAddonUrl('');
                        }}
                        disabled={!addonUrl.trim()}
                        className="px-3 py-1.5 rounded-xl bg-white text-black font-bold text-xs disabled:opacity-40"
                      >
                        Connect Addon
                      </button>
                    </div>
                  </motion.div>
                )}

                <p className="text-xs text-neutral-500 mt-2.5 leading-relaxed px-1">
                  If a source does not have a track or cannot be reached, Celestial Music tries the next one. Sources above YouTube can replace its recording when they return a better version.
                </p>
              </div>

              {/* WEBDAV */}
              <div>
                <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-2 px-1">
                  WebDAV
                </span>
                <div 
                  onClick={() => setShowWebDAV(!showWebDAV)}
                  className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:bg-white/5 transition cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                        <Cloud className="w-4.5 h-4.5 text-white" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">WebDAV</h4>
                        <p className="text-xs text-neutral-400">
                          {settings.webdavUrl ? settings.webdavUrl : 'Connect a server under Sources'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {showWebDAV && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-4 mt-2 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2"
                  >
                    <input
                      type="text"
                      placeholder="https://nextcloud.example.com/remote.php/dav/files/user/Music"
                      value={webdavInput}
                      onChange={(e) => setWebdavInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          onUpdateSettings({ webdavUrl: webdavInput });
                          setStatusNotice('WebDAV music folder connected!');
                          setShowWebDAV(false);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white text-black font-bold text-xs"
                      >
                        Save WebDAV
                      </button>
                    </div>
                  </motion.div>
                )}

                <p className="text-xs text-neutral-500 mt-1.5 px-1 leading-relaxed">
                  Point BitChord at a WebDAV music folder — your Nextcloud Music directory or any server speaking WebDAV.
                </p>
              </div>

              {/* SMB */}
              <div>
                <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-2 px-1">
                  SMB
                </span>
                <div 
                  onClick={() => setShowSMB(!showSMB)}
                  className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:bg-white/5 transition cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                        <HardDrive className="w-4.5 h-4.5 text-white" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">SMB</h4>
                        <p className="text-xs text-neutral-400">
                          {settings.smbShareUrl ? settings.smbShareUrl : 'Connect a share under Sources'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {showSMB && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-4 mt-2 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2"
                  >
                    <input
                      type="text"
                      placeholder="smb://nas.local/Music"
                      value={smbInput}
                      onChange={(e) => setSmbInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          onUpdateSettings({ smbShareUrl: smbInput });
                          setStatusNotice('SMB share connected!');
                          setShowSMB(false);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white text-black font-bold text-xs"
                      >
                        Save SMB
                      </button>
                    </div>
                  </motion.div>
                )}

                <p className="text-xs text-neutral-500 mt-1.5 px-1 leading-relaxed">
                  Point BitChord at a shared music folder — a NAS or Windows share speaking SMB.
                </p>
              </div>

              {/* SOURCE MATCHING */}
              <div>
                <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-2 px-1">
                  Source Matching
                </span>
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-neutral-400" />
                      <span className="text-sm font-medium text-white">Track length tolerance</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-white">{tolerance} s</span>
                  </div>

                  <p className="text-xs text-neutral-400">
                    Maximum duration difference allowed for a replacement stream
                  </p>

                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={tolerance}
                    onChange={(e) => onUpdateSettings({ trackLengthTolerance: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-white"
                  />
                </div>

                <p className="text-xs text-neutral-500 mt-1.5 px-1 leading-relaxed">
                  A larger tolerance accepts more source matches; a smaller tolerance is stricter. The default is 3 seconds.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
