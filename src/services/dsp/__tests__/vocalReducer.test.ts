import { describe, it, expect } from 'vitest';
import {
  applyVocalReductionSync,
  applyVocalReductionAsync,
  analyzeAudioChannels,
} from '../vocalReducer';

describe('DSP Vocal Reduction Engine', () => {
  it('should completely eliminate identical center channel content at 100% strength', () => {
    const sampleRate = 44100;
    const numSamples = 100;

    // Center content (identical on Left and Right)
    const leftIn = new Float32Array(numSamples);
    const rightIn = new Float32Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      const centerSignal = Math.sin(i * 0.1) * 0.8;
      leftIn[i] = centerSignal;
      rightIn[i] = centerSignal;
    }

    const result = applyVocalReductionSync([leftIn, rightIn], sampleRate, { strength: 1.0 });

    expect(result.channels.length).toBe(2);
    expect(result.duration).toBeCloseTo(numSamples / sampleRate);
    expect(result.isMono).toBe(false);

    // Because Left == Right, (Left - Right) == 0 everywhere!
    for (let i = 0; i < numSamples; i++) {
      expect(result.channels[0][i]).toBe(0);
      expect(result.channels[1][i]).toBe(0);
    }

    expect(result.peakAmplitude).toBe(0);
    expect(result.rmsLevel).toBe(0);
  });

  it('should isolate side content and cancel center in mixed audio', () => {
    const sampleRate = 44100;
    const numSamples = 50;

    const leftIn = new Float32Array(numSamples);
    const rightIn = new Float32Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      const centerVocals = 0.6; // Common lead vocal
      const leftGuitars = 0.4; // Panned hard left
      const rightKeyboards = -0.4; // Panned hard right

      leftIn[i] = centerVocals + leftGuitars; // 1.0
      rightIn[i] = centerVocals + rightKeyboards; // 0.2
    }

    const result = applyVocalReductionSync([leftIn, rightIn], sampleRate, { strength: 1.0 });

    // At 100% reduction:
    // Left_out = (1.0 - 0.2) * 0.5 = 0.4 (Center vocals cancelled!)
    // Right_out = (0.2 - 1.0) * 0.5 = -0.4
    for (let i = 0; i < numSamples; i++) {
      expect(result.channels[0][i]).toBeCloseTo(0.4);
      expect(result.channels[1][i]).toBeCloseTo(-0.4);
    }
  });

  it('should preserve original audio when strength is 0.0', () => {
    const sampleRate = 44100;
    const numSamples = 60;
    const leftIn = new Float32Array(numSamples);
    const rightIn = new Float32Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      leftIn[i] = 0.3 * Math.sin(i);
      rightIn[i] = 0.5 * Math.cos(i);
    }

    const result = applyVocalReductionSync([leftIn, rightIn], sampleRate, { strength: 0.0 });

    for (let i = 0; i < numSamples; i++) {
      expect(result.channels[0][i]).toBeCloseTo(leftIn[i]);
      expect(result.channels[1][i]).toBeCloseTo(rightIn[i]);
    }
  });

  it('should blend proportionally when strength is 0.5', () => {
    const sampleRate = 44100;
    const leftIn = new Float32Array([1.0]);
    const rightIn = new Float32Array([0.0]);

    // diffL = (1.0 - 0.0) * 0.5 = 0.5
    // at strength 0.5: outL = 0.5 * 1.0 + 0.5 * 0.5 = 0.75
    const result = applyVocalReductionSync([leftIn, rightIn], sampleRate, { strength: 0.5 });
    expect(result.channels[0][0]).toBeCloseTo(0.75);
  });

  it('should safely handle mono input without crashing', () => {
    const sampleRate = 44100;
    const monoIn = new Float32Array([0.2, 0.4, 0.6, 0.8]);

    const result = applyVocalReductionSync([monoIn], sampleRate, { strength: 1.0 });

    expect(result.isMono).toBe(true);
    expect(result.warning).toContain('Mono audio detected');
    expect(result.channels.length).toBe(1);
    expect(result.channels[0][0]).toBeCloseTo(0.2);
    expect(result.duration).toBeCloseTo(4 / 44100);
  });

  it('should perform non-blocking chunked async processing with progress callback', async () => {
    const sampleRate = 44100;
    const numSamples = 200000; // ~4.5 seconds of audio
    const leftIn = new Float32Array(numSamples).fill(0.3);
    const rightIn = new Float32Array(numSamples).fill(0.1);

    const progressUpdates: number[] = [];
    const result = await applyVocalReductionAsync(
      [leftIn, rightIn],
      sampleRate,
      { strength: 0.8 },
      (pct) => progressUpdates.push(pct)
    );

    expect(progressUpdates.length).toBeGreaterThan(0);
    expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
    expect(result.channels[0].length).toBe(numSamples);
    expect(result.duration).toBeCloseTo(numSamples / sampleRate);
  });

  it('should correctly analyze peak amplitude and RMS levels', () => {
    const sampleRate = 48000;
    const numSamples = 1000;
    const channel = new Float32Array(numSamples);

    // Peak = 0.5
    channel[500] = 0.5;

    const stats = analyzeAudioChannels([channel], sampleRate);

    expect(stats.peakLinear).toBe(0.5);
    expect(stats.peakDb).toBeCloseTo(-6.0, 1);
    expect(stats.duration).toBeCloseTo(1000 / 48000);
  });
});
