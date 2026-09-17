import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Sparkles, 
  Check, 
  Cpu
} from 'lucide-react';
import { AppSettings, Song } from '../../types';

interface AudioQualityModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  currentSong?: Song | null;
}

export const AudioQualityModal: React.FC<AudioQualityModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const currentQuality = settings.audioQuality || 'lossless';

  const qualityOptions: Array<{
    id: 'normal' | 'high' | 'lossless' | 'hires';
    title: string;
    badge: string;
    description: string;
    codec: string;
  }> = [
    {
      id: 'hires',
      title: 'Hi-Res Lossless',
      badge: '24-bit • 192 kHz',
      description: 'Studio master recording with uncompressed acoustic depth.',
      codec: 'FLAC Studio Master',
    },
    {
      id: 'lossless',
      title: 'Lossless',
      badge: '24-bit • 48 kHz',
      description: 'Bit-for-bit studio precision with zero compression loss.',
      codec: 'ALAC / FLAC Lossless',
    },
    {
      id: 'high',
      title: 'High Quality',
      badge: '320 kbps',
      description: 'Crisp, high-definition sound with fast buffering.',
      codec: 'AAC 320 kbps',
    },
    {
      id: 'normal',
      title: 'Data Saver',
      badge: '160 kbps',
      description: 'Optimized playback using minimal mobile data.',
      codec: 'Opus 160 kbps',
    },
  ];

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
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', damping: 26, stiffness: 360 }}
            className="w-full max-w-md rounded-3xl bg-[#16161a] border border-white/10 shadow-2xl text-white flex flex-col overflow-hidden pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative flex items-center justify-center p-5 border-b border-white/10 bg-white/[0.02]">
              <h2 className="text-base font-bold text-white text-center">
                Audio Quality
              </h2>
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={onClose}
                aria-label="Close audio quality settings"
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>

            {/* Quality Selection List */}
            <div className="p-5 space-y-2.5 overflow-y-auto no-scrollbar max-h-[75vh]">
              {qualityOptions.map((opt) => {
                const isSelected = 
                  (opt.id === 'hires' && (currentQuality as any) === 'hires') ||
                  (opt.id === 'lossless' && currentQuality === 'lossless') ||
                  (opt.id === 'high' && currentQuality === 'high') ||
                  (opt.id === 'normal' && currentQuality === 'normal');

                return (
                  <motion.div
                    key={opt.id}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                        try { navigator.vibrate(12); } catch {}
                      }
                      onUpdateSettings({ audioQuality: opt.id as any });
                      // Auto-confirm & dismiss modal instantly
                      onClose();
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative ${
                      isSelected
                        ? 'bg-white/[0.08] border-rose-500/60 shadow-lg shadow-rose-950/20'
                        : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                            {opt.title}
                            {opt.id === 'hires' && (
                              <Sparkles className="w-3.5 h-3.5 text-amber-400 inline" />
                            )}
                          </h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isSelected
                              ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                              : 'bg-white/5 border-white/10 text-neutral-400'
                          }`}>
                            {opt.badge}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                          {opt.description}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2 text-[11px] text-neutral-400">
                          <Cpu className="w-3 h-3 text-rose-400" />
                          <span>{opt.codec}</span>
                        </div>
                      </div>

                      <div className="pt-0.5 shrink-0">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                          isSelected
                            ? 'bg-rose-500 border-rose-500 text-white'
                            : 'border-white/20 bg-transparent'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
