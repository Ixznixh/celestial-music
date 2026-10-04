/**
 * High-fidelity fallback audio synthesizer for iOS Safari background playback testing
 * 
 * When YouTube's BotGuard restricts datacenter IP addresses from fetching
 * raw googlevideo audio streams (LOGIN_REQUIRED: Sign in to confirm you're not a bot),
 * this module provides a valid, continuous musical PCM WAV audio stream with full
 * HTTP 206 Partial Content Byte-Range support.
 * 
 * This ensures the persistent HTMLAudioElement receives a real, valid audio stream
 * and iOS Safari continues uninterrupted background playback when locked or minimized.
 */

import { Request, Response } from 'express';

// Cache generated musical buffers so we don't recalculate per request
const audioCache = new Map<number, Buffer>();

export function generateMusicalWavBuffer(durationSec: number = 12, sampleRate: number = 44100): Buffer {
  const roundedSec = Math.max(6, Math.min(24, Math.round(durationSec)));
  if (audioCache.has(roundedSec)) {
    return audioCache.get(roundedSec)!;
  }

  const numChannels = 2; // Stereo
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const numSamples = roundedSec * sampleRate;
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  // WAV Header (RIFF format)
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // SubChunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // BitsPerSample
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Musical chord progression (warm ambient lofi chords)
  // Dm7 -> G7 -> Cmaj7 -> Am7
  const chordFreqs = [
    [146.83, 174.61, 220.00, 261.63], // Dm7 (D3, F3, A3, C4)
    [196.00, 246.94, 293.66, 349.23], // G7  (G3, B3, D4, F4)
    [130.81, 164.81, 196.00, 246.94], // Cmaj7 (C3, E3, G3, B3)
    [110.00, 130.81, 164.81, 196.00], // Am7 (A2, C3, E3, G3)
  ];

  const chordDuration = 4; // 4 seconds per chord
  let offset = 44;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const chordIndex = Math.floor((t / chordDuration) % chordFreqs.length);
    const chord = chordFreqs[chordIndex];
    const beatTime = (t % 0.5) / 0.5; // gentle 120 bpm rhythm pulse

    let left = 0;
    let right = 0;

    // Chords (warm stereo pad sound)
    for (let c = 0; c < chord.length; c++) {
      const freq = chord[c];
      const tone = Math.sin(2 * Math.PI * freq * t) * 0.12;
      const harmonic = Math.sin(2 * Math.PI * freq * 2 * t) * 0.04;
      left += (tone + harmonic);
      right += (tone + harmonic);
    }

    // Sub bass
    const rootFreq = chord[0] / 2;
    const bass = Math.sin(2 * Math.PI * rootFreq * t) * 0.22;
    left += bass;
    right += bass;

    // Gentle soft shaker / beat pulse
    const envelope = Math.exp(-beatTime * 6);
    const click = (Math.random() * 2 - 1) * 0.03 * envelope;
    left += click;
    right += click;

    // Clamp to 16-bit range
    const clampedLeft = Math.max(-32767, Math.min(32767, Math.round(left * 32767 * 0.6)));
    const clampedRight = Math.max(-32767, Math.min(32767, Math.round(right * 32767 * 0.6)));

    buffer.writeInt16LE(clampedLeft, offset);
    buffer.writeInt16LE(clampedRight, offset + 2);
    offset += 4;
  }

  audioCache.set(roundedSec, buffer);
  return buffer;
}

/**
 * Serve audio buffer with full HTTP 206 Byte-Range request support
 * Required by iOS Safari HTMLAudioElement for smooth seeking and background audio.
 */
export function streamWavWithRangeSupport(req: Request, res: Response, buffer: Buffer, statusReason = 'fallback-audio') {
  const totalSize = buffer.length;
  const rangeHeader = req.headers.range;

  res.setHeader('Content-Type', 'audio/wav');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('X-Celestial-Audio-Source', statusReason);

  if (rangeHeader) {
    const parts = rangeHeader.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

    if (start >= totalSize || end >= totalSize || start > end) {
      res.status(416).setHeader('Content-Range', `bytes */${totalSize}`);
      return res.end();
    }

    const chunkSize = end - start + 1;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
    res.setHeader('Content-Length', chunkSize);
    res.end(buffer.subarray(start, end + 1));
  } else {
    res.status(200);
    res.setHeader('Content-Length', totalSize);
    res.end(buffer);
  }
}
