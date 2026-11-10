import { describe, it, expect } from 'vitest';
import { encodeWavArrayBuffer, encodeWavBlob } from '../wavEncoder';

describe('WAV Encoder (16-bit PCM RIFF)', () => {
  it('should encode a valid 16-bit stereo WAV with correct RIFF headers', () => {
    const sampleRate = 44100;
    const numSamples = 1000;
    const left = new Float32Array(numSamples);
    const right = new Float32Array(numSamples);

    // Fill with simple test tones
    for (let i = 0; i < numSamples; i++) {
      left[i] = Math.sin((i / 44100) * 440 * 2 * Math.PI) * 0.8;
      right[i] = Math.cos((i / 44100) * 440 * 2 * Math.PI) * 0.8;
    }

    const arrayBuffer = encodeWavArrayBuffer([left, right], sampleRate);
    const view = new DataView(arrayBuffer);

    // Verify RIFF chunk descriptor
    const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    expect(riff).toBe('RIFF');

    const expectedDataSize = numSamples * 2 * 2; // samples * 2 channels * 2 bytes
    const expectedChunkSize = 36 + expectedDataSize;
    expect(view.getUint32(4, true)).toBe(expectedChunkSize);

    const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
    expect(wave).toBe('WAVE');

    // Verify "fmt " subchunk
    const fmt = String.fromCharCode(view.getUint8(12), view.getUint8(13), view.getUint8(14), view.getUint8(15));
    expect(fmt).toBe('fmt ');
    expect(view.getUint32(16, true)).toBe(16); // Subchunk1Size
    expect(view.getUint16(20, true)).toBe(1); // AudioFormat = 1 (PCM)
    expect(view.getUint16(22, true)).toBe(2); // NumChannels = 2
    expect(view.getUint32(24, true)).toBe(44100); // SampleRate
    expect(view.getUint32(28, true)).toBe(44100 * 2 * 2); // ByteRate = 176400
    expect(view.getUint16(32, true)).toBe(4); // BlockAlign = 4
    expect(view.getUint16(34, true)).toBe(16); // BitsPerSample = 16

    // Verify "data" subchunk
    const data = String.fromCharCode(view.getUint8(36), view.getUint8(37), view.getUint8(38), view.getUint8(39));
    expect(data).toBe('data');
    expect(view.getUint32(40, true)).toBe(expectedDataSize);

    // Total byte length should equal 44 + dataSize
    expect(arrayBuffer.byteLength).toBe(44 + expectedDataSize);
  });

  it('should encode mono audio correctly with 1 channel BlockAlign', () => {
    const sampleRate = 48000;
    const numSamples = 480;
    const mono = new Float32Array(numSamples).fill(0.5);

    const buffer = encodeWavArrayBuffer([mono], sampleRate);
    const view = new DataView(buffer);

    expect(view.getUint16(22, true)).toBe(1); // NumChannels = 1
    expect(view.getUint32(24, true)).toBe(48000); // SampleRate
    expect(view.getUint16(32, true)).toBe(2); // BlockAlign = 2
    expect(view.getUint32(40, true)).toBe(numSamples * 2); // Subchunk2Size
  });

  it('should prevent clipping and clamp extreme sample values', () => {
    const sampleRate = 44100;
    // Samples with overshoot (+2.5, -3.0)
    const left = new Float32Array([1.5, -2.0, 0.0]);
    const buffer = encodeWavArrayBuffer([left], sampleRate);
    const view = new DataView(buffer);

    const s1 = view.getInt16(44, true);
    const s2 = view.getInt16(46, true);
    const s3 = view.getInt16(48, true);

    expect(s1).toBe(32767); // Clamped at positive max
    expect(s2).toBe(-32768); // Clamped at negative max
    expect(s3).toBe(0);
  });

  it('should support high sample rates like 96 kHz', () => {
    const sampleRate = 96000;
    const left = new Float32Array(960);
    const right = new Float32Array(960);

    const buffer = encodeWavArrayBuffer([left, right], sampleRate);
    const view = new DataView(buffer);

    expect(view.getUint32(24, true)).toBe(96000);
    expect(view.getUint32(28, true)).toBe(96000 * 4);
  });

  it('should generate a valid audio/wav Blob', () => {
    const left = new Float32Array(100);
    const blob = encodeWavBlob([left], 44100);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('audio/wav');
    expect(blob.size).toBe(44 + 100 * 2);
  });

  it('should throw when empty or mismatched channel arrays are provided', () => {
    expect(() => encodeWavArrayBuffer([], 44100)).toThrow('No audio channels provided');

    const ch1 = new Float32Array(100);
    const ch2 = new Float32Array(50);
    expect(() => encodeWavArrayBuffer([ch1, ch2], 44100)).toThrow('mismatch');
  });
});

