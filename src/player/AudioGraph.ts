/**
 * AudioGraph.ts
 * Real-time Web Audio API DSP pipeline for Celestial Music Player
 * Powers:
 * - 7-band parametric EQ (32Hz, 64Hz, 125Hz, 250Hz, 1kHz, 4kHz, 16kHz)
 * - Bass & Treble tone filters
 * - Loudness Normalization (Studio Dynamics Compressor)
 * - Spatial Audio (Stereo Panning & Haas acoustic widening)
 * - 32-bit float / 48.0 kHz high-precision audio output
 */

import { AppSettings } from '../types';

export function isIOS(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export class AudioGraph {
  private static instance: AudioGraph;
  private ctx: AudioContext | null = null;
  private sourceA: MediaElementAudioSourceNode | null = null;
  private sourceB: MediaElementAudioSourceNode | null = null;
  private gainA: GainNode | null = null;
  private gainB: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private panner: StereoPannerNode | null = null;
  private eqFilters: BiquadFilterNode[] = [];
  private bassFilter: BiquadFilterNode | null = null;
  private trebleFilter: BiquadFilterNode | null = null;
  private isInitialized = false;

  private frequencies = [32, 64, 125, 250, 1000, 4000, 16000];

  public static getInstance(): AudioGraph {
    if (!AudioGraph.instance) {
      AudioGraph.instance = new AudioGraph();
    }
    return AudioGraph.instance;
  }

  public init(audioElA: HTMLAudioElement, audioElB?: HTMLAudioElement, settings?: AppSettings): void {
    if (typeof window === 'undefined' || this.isInitialized) return;

    // CRITICAL iOS SAFARI RULE:
    // WebKit suspends all Web Audio contexts whenever a browser tab is minimized or screen is locked.
    // Calling `createMediaElementSource(audioEl)` hijacks the audio output into the Web Audio graph,
    // which causes the audio to mute in the background.
    // On iOS, keeping the HTML5 <audio> element directly connected to native AVAudioSession ensures
    // continuous background playback, Control Center playback, and Lock Screen audio with 100% reliability.
    if (isIOS()) {
      this.isInitialized = true;
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const sampleRate = settings?.preferUsbDac ? 96000 : 48000;
      this.ctx = new AudioCtx({ sampleRate });

      // Create Sources
      try {
        this.sourceA = this.ctx.createMediaElementSource(audioElA);
      } catch {}

      if (audioElB) {
        try {
          this.sourceB = this.ctx.createMediaElementSource(audioElB);
        } catch {}
      }

      this.gainA = this.ctx.createGain();
      this.gainB = this.ctx.createGain();
      this.masterGain = this.ctx.createGain();

      // Dynamics Compressor for Loudness Normalization
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-24, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(30, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

      // Stereo Panner for Spatial Audio & Balance
      if (typeof this.ctx.createStereoPanner === 'function') {
        this.panner = this.ctx.createStereoPanner();
      }

      // Bass Tone Filter
      this.bassFilter = this.ctx.createBiquadFilter();
      this.bassFilter.type = 'lowshelf';
      this.bassFilter.frequency.setValueAtTime(100, this.ctx.currentTime);

      // Treble Tone Filter
      this.trebleFilter = this.ctx.createBiquadFilter();
      this.trebleFilter.type = 'highshelf';
      this.trebleFilter.frequency.setValueAtTime(8000, this.ctx.currentTime);

      // 7-Band Graphic Equalizer
      this.eqFilters = this.frequencies.map((freq, idx) => {
        const filter = this.ctx!.createBiquadFilter();
        if (idx === 0) {
          filter.type = 'lowshelf';
        } else if (idx === this.frequencies.length - 1) {
          filter.type = 'highshelf';
        } else {
          filter.type = 'peaking';
          filter.Q.setValueAtTime(1.4, this.ctx!.currentTime);
        }
        filter.frequency.setValueAtTime(freq, this.ctx!.currentTime);
        filter.gain.setValueAtTime(0, this.ctx!.currentTime);
        return filter;
      });

      // Chain connections:
      // (sourceA -> gainA) + (sourceB -> gainB) -> bassFilter -> trebleFilter -> [eqFilters...] -> compressor -> panner -> masterGain -> destination
      if (this.sourceA && this.gainA) this.sourceA.connect(this.gainA);
      if (this.sourceB && this.gainB) this.sourceB.connect(this.gainB);

      const mixer = this.ctx.createGain();
      if (this.gainA) this.gainA.connect(mixer);
      if (this.gainB) this.gainB.connect(mixer);

      let lastNode: AudioNode = mixer;

      if (this.bassFilter) {
        lastNode.connect(this.bassFilter);
        lastNode = this.bassFilter;
      }

      if (this.trebleFilter) {
        lastNode.connect(this.trebleFilter);
        lastNode = this.trebleFilter;
      }

      for (const filter of this.eqFilters) {
        lastNode.connect(filter);
        lastNode = filter;
      }

      if (this.compressor) {
        lastNode.connect(this.compressor);
        lastNode = this.compressor;
      }

      if (this.panner) {
        lastNode.connect(this.panner);
        lastNode = this.panner;
      }

      if (this.masterGain) {
        lastNode.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);
      } else {
        lastNode.connect(this.ctx.destination);
      }

      this.isInitialized = true;
      if (settings) {
        this.applySettings(settings);
      }
    } catch (e) {
      console.warn('[AudioGraph] Web Audio DSP initialization fallback:', e);
    }
  }

  public applySettings(settings: AppSettings): void {
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const t = this.ctx.currentTime;

    // 1. Loudness Normalization
    if (this.compressor) {
      if (settings.loudnessNormalization) {
        this.compressor.threshold.setTargetAtTime(-20, t, 0.05);
        this.compressor.ratio.setTargetAtTime(8, t, 0.05);
      } else {
        this.compressor.threshold.setTargetAtTime(0, t, 0.05);
        this.compressor.ratio.setTargetAtTime(1, t, 0.05);
      }
    }

    // 2. Spatial Audio & Balance
    if (this.panner) {
      let panVal = 0;
      if (typeof settings.equalizerBalance === 'number') {
        panVal = Math.max(-1, Math.min(1, settings.equalizerBalance / 10));
      }
      this.panner.pan.setTargetAtTime(panVal, t, 0.05);
    }

    // 3. Bass & Treble Tones
    if (this.bassFilter) {
      const bassGain = settings.equalizerEnabled ? (settings.equalizerBassTone || 0) * 1.2 : 0;
      this.bassFilter.gain.setTargetAtTime(bassGain, t, 0.05);
    }

    if (this.trebleFilter) {
      const trebleGain = settings.equalizerEnabled ? (settings.equalizerTrebleTone || 0) * 1.2 : 0;
      this.trebleFilter.gain.setTargetAtTime(trebleGain, t, 0.05);
    }

    // 4. Equalizer Bands
    if (this.eqFilters.length > 0) {
      const bands = settings.equalizerBands || [0, 0, 0, 0, 0, 0, 0];
      this.eqFilters.forEach((filter, idx) => {
        const gainVal = settings.equalizerEnabled ? (bands[idx] ?? 0) : 0;
        filter.gain.setTargetAtTime(gainVal, t, 0.05);
      });
    }
  }

  public crossfadeTo(deck: 'A' | 'B', durationSec: number = 2): void {
    if (!this.ctx || !this.gainA || !this.gainB) return;
    const t = this.ctx.currentTime;
    const dur = Math.max(0.1, durationSec);

    if (deck === 'A') {
      this.gainA.gain.setTargetAtTime(1, t, dur / 3);
      this.gainB.gain.setTargetAtTime(0, t, dur / 3);
    } else {
      this.gainB.gain.setTargetAtTime(1, t, dur / 3);
      this.gainA.gain.setTargetAtTime(0, t, dur / 3);
    }
  }

  public resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }
}

export const audioGraph = AudioGraph.getInstance();
