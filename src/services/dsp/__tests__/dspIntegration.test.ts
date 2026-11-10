import { describe, it, expect } from 'vitest';
import { applyVocalReductionSync, applyVocalReductionAsync } from '../vocalReducer';
import { encodeWavArrayBuffer } from '../wavEncoder';
import { validateAudioFile } from '../../audioMetadata';

describe('DSP Edge Cases, Durations, Codecs & Formats', () => {
  it('handles short audio (e.g. 100 samples) accurately preserving duration', () => {
    const sampleRate = 44100;
    const numSamples = 100;
    const left = new Float32Array(numSamples).fill(0.5);
    const right = new Float32Array(numSamples).fill(0.2);

    const result = applyVocalReductionSync([left, right], sampleRate, { strength: 0.8 });

    expect(result.duration).toBeCloseTo(100 / 44100, 6);
    expect(result.channels[0].length).toBe(100);
    expect(result.channels[1].length).toBe(100);
  });

  it('handles full-length audio (500,000 samples, ~11.3s @ 44.1kHz) without memory leaks', () => {
    const sampleRate = 44100;
    const numSamples = 500000;
    const left = new Float32Array(numSamples);
    const right = new Float32Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      left[i] = 0.5 * Math.sin(i * 0.05);
      right[i] = 0.5 * Math.sin(i * 0.05);
    }

    const result = applyVocalReductionSync([left, right], sampleRate, { strength: 1.0 });

    expect(result.channels[0].length).toBe(numSamples);
    expect(result.duration).toBeCloseTo(500000 / 44100, 4);

    // Verify output buffer encodes to WAV without error
    const wav = encodeWavArrayBuffer(result.channels, sampleRate);
    expect(wav.byteLength).toBe(44 + numSamples * 2 * 2);
  });

  it('handles high sample rate audio (192 kHz) without overflowing or distorting', () => {
    const sampleRate = 192000;
    const numSamples = 19200; // 0.1s
    const left = new Float32Array(numSamples).fill(0.4);
    const right = new Float32Array(numSamples).fill(-0.4);

    const result = applyVocalReductionSync([left, right], sampleRate, { strength: 1.0 });

    expect(result.sampleRate).toBe(192000);
    expect(result.duration).toBeCloseTo(0.1, 4);

    const wav = encodeWavArrayBuffer(result.channels, sampleRate);
    const view = new DataView(wav);
    expect(view.getUint32(24, true)).toBe(192000);
  });

  it('prevents accidental clipping when left and right are completely out of phase', () => {
    const sampleRate = 44100;
    // Left = +1.0, Right = -1.0
    // Un-attenuated diff (L - R) = 2.0. The DSP algorithm normalizes and clamps to [-1.0, 1.0].
    const left = new Float32Array([1.0, 1.0, 1.0]);
    const right = new Float32Array([-1.0, -1.0, -1.0]);

    const result = applyVocalReductionSync([left, right], sampleRate, { strength: 1.0 });

    for (let i = 0; i < result.channels[0].length; i++) {
      expect(result.channels[0][i]).toBeLessThanOrEqual(1.0);
      expect(result.channels[0][i]).toBeGreaterThanOrEqual(-1.0);
      expect(result.channels[1][i]).toBeLessThanOrEqual(1.0);
      expect(result.channels[1][i]).toBeGreaterThanOrEqual(-1.0);
    }
  });

  it('rejects empty files (0 bytes) during validation', () => {
    const emptyFile = new File([], 'empty.wav', { type: 'audio/wav' });
    const validation = validateAudioFile(emptyFile);
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('empty');
  });

  it('validates supported extensions (WAV, MP3, FLAC, M4A, OGG) and rejects unsupported formats', () => {
    const validWav = new File(['123456'], 'track.wav', { type: 'audio/wav' });
    const validMp3 = new File(['123456'], 'track.mp3', { type: 'audio/mpeg' });
    const validFlac = new File(['123456'], 'track.flac', { type: 'audio/flac' });
    const validM4a = new File(['123456'], 'track.m4a', { type: 'audio/mp4' });
    const validOgg = new File(['123456'], 'track.ogg', { type: 'audio/ogg' });
    const invalidExe = new File(['123456'], 'malware.exe', { type: 'application/octet-stream' });
    const invalidDoc = new File(['123456'], 'notes.txt', { type: 'text/plain' });

    expect(validateAudioFile(validWav).valid).toBe(true);
    expect(validateAudioFile(validMp3).valid).toBe(true);
    expect(validateAudioFile(validFlac).valid).toBe(true);
    expect(validateAudioFile(validM4a).valid).toBe(true);
    expect(validateAudioFile(validOgg).valid).toBe(true);
    expect(validateAudioFile(invalidExe).valid).toBe(false);
    expect(validateAudioFile(invalidDoc).valid).toBe(false);
  });

  it('reports progressive execution percentages in async mode', async () => {
    const sampleRate = 48000;
    const numSamples = 300000;
    const left = new Float32Array(numSamples);
    const right = new Float32Array(numSamples);

    const progressValues: number[] = [];
    const result = await applyVocalReductionAsync(
      [left, right],
      sampleRate,
      { strength: 0.9 },
      (pct) => progressValues.push(pct)
    );

    expect(progressValues.length).toBeGreaterThanOrEqual(2);
    expect(progressValues[progressValues.length - 1]).toBe(100);
    expect(result.duration).toBeCloseTo(300000 / 48000, 4);
  });
});

