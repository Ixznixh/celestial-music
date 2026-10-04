import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sliders, RotateCcw, Volume2, Sparkles, Check } from 'lucide-react';
import { AppSettings } from '../../types';
import { GlassSwitch } from '../common/GlassSwitch';
import { FluidSlider } from '../common/FluidSlider';

interface EqualizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
}

const EQ_PRESETS: Record<string, { bands: number[]; bass: number; treble: number }> = {
  Flat: { bands: [0, 0, 0, 0, 0, 0, 0], bass: 0, treble: 0 },
  'Bass Boost': { bands: [6, 5, 3, 1, 0, 0, 0], bass: 5, treble: 0 },
  Vocal: { bands: [-2, -1, 1, 3, 4, 3, 1], bass: -1, treble: 2 },
  Electronic: { bands: [5, 4, 1, 0, 2, 4, 5], bass: 4, treble: 3 },
  Rock: { bands: [4, 3, -1, -2, 1, 3, 4], bass: 3, treble: 3 },
  Acoustic: { bands: [2, 1, 1, 2, 2, 3, 2], bass: 1, treble: 2 },
  Pop: { bands: [-1, 1, 3, 3, 2, -1, -1], bass: 1, treble: 1 },
  Jazz: { bands: [3, 2, 0, 2, -1, 2, 3], bass: 2, treble: 2 },
  Classical: { bands: [4, 3, 2, 2, -1, 2, 3], bass: 2, treble: 3 },
  Deep: { bands: [7, 6, 2, 0, -1, -2, -3], bass: 6, treble: -2 },
};

const FREQUENCIES = ['32 Hz', '64 Hz', '125 Hz', '250 Hz', '1 kHz', '4 kHz', '16 kHz'];

export const EqualizerModal: React.FC<EqualizerModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const isEnabled = settings.equalizerEnabled ?? true;
  const currentBands = settings.equalizerBands || [0, 0, 0, 0, 0, 0, 0];
  const currentPreset = settings.equalizerPreset || 'Flat';
  const bassTone = settings.equalizerBassTone || 0;
  const trebleTone = settings.equalizerTrebleTone || 0;
  const balance = settings.equalizerBalance || 0;

  const handleBandChange = (index: number, val: number) => {
    const updated = [...currentBands];
    updated[index] = Math.round(val * 10) / 10;
    onUpdateSettings({
      equalizerBands: updated,
      equalizerPreset: 'Custom',
      equalizerEnabled: true,
    });
  };

  const handleSelectPreset = (presetName: string) => {
    const preset = EQ_PRESETS[presetName];
    if (preset) {
      onUpdateSettings({
        equalizerPreset: presetName,
        equalizerBands: [...preset.bands],
        equalizerBassTone: preset.bass,
        equalizerTrebleTone: preset.treble,
        equalizerEnabled: true,
      });
    }
  };

  const handleReset = () => {
    handleSelectPreset('Flat');
    onUpdateSettings({
      equalizerBalance: 0,
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className="relative z-10 w-full max-w-lg bg-[#141417] text-white rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Sliders className="w-5 h-5 text-rose-500" />
                <h3 className="text-base sm:text-lg font-bold tracking-tight text-white">Equalizer</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReset}
                  className="p-2 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition"
                  title="Reset to Flat"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content Scrollable */}
            <div className="p-5 space-y-6 overflow-y-auto no-scrollbar">
              {/* Enable Switch */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.04] border border-white/10">
                <div>
                  <p className="text-sm font-semibold text-white">Enable Audio Equalizer</p>
                  <p className="text-xs text-neutral-400">Real-time Web Audio 7-band parametric DSP</p>
                </div>
                <GlassSwitch
                  checked={isEnabled}
                  onChange={(val) => onUpdateSettings({ equalizerEnabled: val })}
                />
              </div>

              {/* Presets Grid */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">
                  Presets
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {Object.keys(EQ_PRESETS).map((p) => {
                    const isSelected = currentPreset === p;
                    return (
                      <button
                        key={p}
                        onClick={() => handleSelectPreset(p)}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition border ${
                          isSelected
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow'
                            : 'bg-white/[0.04] text-neutral-300 border-white/5 hover:bg-white/10'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 7 Graphic EQ Sliders */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                    Frequencies (dB)
                  </span>
                  <span className="text-xs font-semibold text-rose-400">{currentPreset}</span>
                </div>

                <div className="grid grid-cols-7 gap-1 sm:gap-2 bg-black/40 p-3 sm:p-4 rounded-2xl border border-white/10 text-center">
                  {FREQUENCIES.map((freq, idx) => {
                    const dbVal = currentBands[idx] ?? 0;
                    return (
                      <div key={freq} className="flex flex-col items-center gap-2">
                        <span className="text-[10px] font-bold text-neutral-300 tabular-nums">
                          {dbVal > 0 ? `+${dbVal}` : dbVal}
                        </span>
                        <div className="h-36 sm:h-40 flex items-center justify-center py-2">
                          <input
                            type="range"
                            min={-12}
                            max={12}
                            step={0.5}
                            value={dbVal}
                            disabled={!isEnabled}
                            onChange={(e) => handleBandChange(idx, Number(e.target.value))}
                            className="h-28 sm:h-32 -rotate-90 appearance-none bg-neutral-800 rounded-lg cursor-pointer accent-rose-500"
                            style={{ width: '120px' }}
                          />
                        </div>
                        <span className="text-[10px] text-neutral-400 font-medium truncate w-full">
                          {freq}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tone & Balance Adjusters */}
              <div className="space-y-4 pt-1">
                <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">
                  Tone & Stereo Balance
                </span>

                {/* Bass Boost */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-neutral-300">Bass Tone</span>
                    <span className="text-neutral-400 tabular-nums">
                      {bassTone > 0 ? `+${bassTone}` : bassTone}
                    </span>
                  </div>
                  <FluidSlider
                    value={bassTone}
                    min={-10}
                    max={10}
                    step={1}
                    disabled={!isEnabled}
                    onChange={(val) => onUpdateSettings({ equalizerBassTone: val, equalizerPreset: 'Custom' })}
                    size="sm"
                    ariaLabel="Bass tone"
                  />
                </div>

                {/* Treble Tone */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-neutral-300">Treble Tone</span>
                    <span className="text-neutral-400 tabular-nums">
                      {trebleTone > 0 ? `+${trebleTone}` : trebleTone}
                    </span>
                  </div>
                  <FluidSlider
                    value={trebleTone}
                    min={-10}
                    max={10}
                    step={1}
                    disabled={!isEnabled}
                    onChange={(val) => onUpdateSettings({ equalizerTrebleTone: val, equalizerPreset: 'Custom' })}
                    size="sm"
                    ariaLabel="Treble tone"
                  />
                </div>

                {/* Stereo Balance */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-neutral-300">Stereo Balance (L / R)</span>
                    <span className="text-neutral-400 tabular-nums">
                      {balance === 0 ? 'Center' : balance < 0 ? `L ${Math.abs(balance)}` : `R ${balance}`}
                    </span>
                  </div>
                  <FluidSlider
                    value={balance}
                    min={-10}
                    max={10}
                    step={1}
                    disabled={!isEnabled}
                    onChange={(val) => onUpdateSettings({ equalizerBalance: val })}
                    size="sm"
                    ariaLabel="Stereo balance"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
