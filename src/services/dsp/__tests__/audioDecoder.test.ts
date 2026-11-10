import { describe, it, expect } from 'vitest';
import { detectBitDepthFromBuffer, generateCanvasPeaks } from '../audioDecoder';

describe('Audio Analysis & Header Parsing', () => {
  it('should detect 16-bit PCM bit depth from a standard WAV header', () => {
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);

    view.setUint8(0, 'R'.charCodeAt(0));
    view.setUint8(1, 'I'.charCodeAt(0));
    view.setUint8(2, 'F'.charCodeAt(0));
    view.setUint8(3, 'F'.charCodeAt(0));

    view.setUint8(8, 'W'.charCodeAt(0));
    view.setUint8(9, 'A'.charCodeAt(0));
    view.setUint8(10, 'V'.charCodeAt(0));
    view.setUint8(11, 'E'.charCodeAt(0));

    view.setUint8(12, 'f'.charCodeAt(0));
    view.setUint8(13, 'm'.charCodeAt(0));
    view.setUint8(14, 't'.charCodeAt(0));
    view.setUint8(15, ' '.charCodeAt(0));

    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 2, true); // 2 channels
    view.setUint32(24, 44100, true);
    view.setUint16(34, 16, true); // 16-bit

    const result = detectBitDepthFromBuffer(buffer);
    expect(result).toBe('16-bit PCM WAV');
  });

  it('should detect FLAC header signature', () => {
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);

    view.setUint8(0, 'f'.charCodeAt(0));
    view.setUint8(1, 'L'.charCodeAt(0));
    view.setUint8(2, 'a'.charCodeAt(0));
    view.setUint8(3, 'C'.charCodeAt(0));

    const result = detectBitDepthFromBuffer(buffer);
    expect(result).toBe('Lossless FLAC');
  });

  it('should generate downsampled canvas peaks efficiently', () => {
    const numSamples = 10000;
    const channel1 = new Float32Array(numSamples);
    const channel2 = new Float32Array(numSamples);

    channel1[2500] = 0.95;
    channel2[7500] = 0.88;

    const peaks = generateCanvasPeaks([channel1, channel2], 100);

    expect(peaks.length).toBe(100);
    expect(Math.max(...peaks)).toBeCloseTo(0.95, 2);
  });
});

