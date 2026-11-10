import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MultitrackAudioEngine, type StemTrackConfig } from '../multitrackEngine';

// Mock Web Audio API for Node.js Vitest environment
class MockAudioBuffer {
  duration = 1.5;
  sampleRate = 44100;
  numberOfChannels = 2;
  private data = new Float32Array(44100 * 1.5);

  getChannelData(_channel?: number) {
    return this.data;
  }
}

class MockGainNode {
  gain = {
    value: 1.0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  };
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockAudioBufferSourceNode {
  buffer: any = null;
  playbackRate = {
    value: 1.0,
    setValueAtTime: vi.fn(),
  };
  loop = false;
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class MockAudioContext {
  state: 'running' | 'closed' | 'suspended' = 'running';
  currentTime = 0;
  destination = {};

  createGain() {
    return new MockGainNode();
  }

  createBufferSource() {
    return new MockAudioBufferSourceNode();
  }

  async decodeAudioData(_buffer: ArrayBuffer) {
    return new MockAudioBuffer();
  }

  async resume() {
    this.state = 'running';
  }

  async close() {
    this.state = 'closed';
  }
}

class MockOfflineAudioContext {
  destination = {};

  numberOfChannels: number;
  length: number;
  sampleRate: number;

  constructor(numberOfChannels: number, length: number, sampleRate: number) {
    this.numberOfChannels = numberOfChannels;
    this.length = length;
    this.sampleRate = sampleRate;
  }

  createGain() {
    return new MockGainNode();
  }

  createBufferSource() {
    return new MockAudioBufferSourceNode();
  }

  async startRendering() {
    return new MockAudioBuffer();
  }
}

// Helper to create a valid 16-bit PCM WAV Blob in test environment
function createSyntheticWav(durationSeconds = 1.0, sampleRate = 44100, freq = 440): Blob {
  const numChannels = 2;
  const numSamples = Math.floor(durationSeconds * sampleRate);
  const blockAlign = numChannels * 2;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  view.setUint8(0, 'R'.charCodeAt(0));
  view.setUint8(1, 'I'.charCodeAt(0));
  view.setUint8(2, 'F'.charCodeAt(0));
  view.setUint8(3, 'F'.charCodeAt(0));
  view.setUint32(4, 36 + dataSize, true);
  view.setUint8(8, 'W'.charCodeAt(0));
  view.setUint8(9, 'A'.charCodeAt(0));
  view.setUint8(10, 'V'.charCodeAt(0));
  view.setUint8(11, 'E'.charCodeAt(0));

  // fmt subchunk
  view.setUint8(12, 'f'.charCodeAt(0));
  view.setUint8(13, 'm'.charCodeAt(0));
  view.setUint8(14, 't'.charCodeAt(0));
  view.setUint8(15, ' '.charCodeAt(0));
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);

  // data subchunk
  view.setUint8(36, 'd'.charCodeAt(0));
  view.setUint8(37, 'a'.charCodeAt(0));
  view.setUint8(38, 't'.charCodeAt(0));
  view.setUint8(39, 'a'.charCodeAt(0));
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const val = Math.sin(2 * Math.PI * freq * t) * 0.5;
    const intVal = Math.floor(val * 32767);
    view.setInt16(offset, intVal, true);
    view.setInt16(offset + 2, intVal, true);
    offset += 4;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

describe('MultitrackAudioEngine', () => {
  let engine: MultitrackAudioEngine;
  let originalAudioContext: any;
  let originalOfflineAudioContext: any;

  beforeEach(() => {
    originalAudioContext = (globalThis as any).AudioContext;
    originalOfflineAudioContext = (globalThis as any).OfflineAudioContext;

    (globalThis as any).AudioContext = MockAudioContext;
    (globalThis as any).OfflineAudioContext = MockOfflineAudioContext;

    engine = new MultitrackAudioEngine();
  });

  afterEach(() => {
    engine.destroy();
    (globalThis as any).AudioContext = originalAudioContext;
    (globalThis as any).OfflineAudioContext = originalOfflineAudioContext;
  });

  it('1. initializes in stopped state with zero duration', () => {
    expect(engine.getPlaybackState()).toBe('stopped');
    expect(engine.getTotalDuration()).toBe(0);
    expect(engine.getPlaybackSpeed()).toBe(1.0);
    expect(engine.getIsLooping()).toBe(false);
  });

  it('2. registers and configures stem tracks properly', async () => {
    const configs: StemTrackConfig[] = [
      { id: 'v', name: 'vocals', label: 'Vocals', blob: createSyntheticWav(1.5, 44100, 440) },
      { id: 'd', name: 'drums', label: 'Drums', blob: createSyntheticWav(1.5, 44100, 220) },
      { id: 'b', name: 'bass', label: 'Bass', blob: createSyntheticWav(1.5, 44100, 110) },
      { id: 'o', name: 'other', label: 'Other', blob: createSyntheticWav(1.5, 44100, 880) },
    ];

    await engine.loadTracks(configs);
    const tracks = engine.getTrackStates();

    expect(Object.keys(tracks)).toHaveLength(4);
    expect(tracks['v'].name).toBe('vocals');
    expect(tracks['d'].name).toBe('drums');
    expect(tracks['b'].name).toBe('bass');
    expect(tracks['o'].name).toBe('other');

    // Default volume is 1.0 (100%), unmuted, unsoloed
    expect(tracks['v'].volume).toBe(1.0);
    expect(tracks['v'].muted).toBe(false);
    expect(tracks['v'].solo).toBe(false);
    expect(engine.getTotalDuration()).toBe(1.5);
  });

  it('3. updates individual track volume smoothly', async () => {
    const configs: StemTrackConfig[] = [
      { id: 'v', name: 'vocals', label: 'Vocals', blob: createSyntheticWav(1.0, 44100) },
    ];
    await engine.loadTracks(configs);

    engine.setTrackVolume('v', 0.65);
    const tracks = engine.getTrackStates();
    expect(tracks['v'].volume).toBe(0.65);

    // Clamps out-of-bound volume safely
    engine.setTrackVolume('v', 1.5);
    expect(engine.getTrackStates()['v'].volume).toBe(1.0);
    engine.setTrackVolume('v', -0.2);
    expect(engine.getTrackStates()['v'].volume).toBe(0);
  });

  it('4. toggles track mute', async () => {
    const configs: StemTrackConfig[] = [
      { id: 'v', name: 'vocals', label: 'Vocals', blob: createSyntheticWav(1.0, 44100) },
    ];
    await engine.loadTracks(configs);

    engine.setTrackMute('v', true);
    expect(engine.getTrackStates()['v'].muted).toBe(true);

    engine.setTrackMute('v', false);
    expect(engine.getTrackStates()['v'].muted).toBe(false);
  });

  it('5. handles solo and multi-solo logic properly', async () => {
    const configs: StemTrackConfig[] = [
      { id: 'v', name: 'vocals', label: 'Vocals', blob: createSyntheticWav(1.0, 44100) },
      { id: 'd', name: 'drums', label: 'Drums', blob: createSyntheticWav(1.0, 44100) },
      { id: 'b', name: 'bass', label: 'Bass', blob: createSyntheticWav(1.0, 44100) },
    ];
    await engine.loadTracks(configs);

    // Solo vocals only
    engine.setTrackSolo('v', true);
    expect(engine.getTrackStates()['v'].solo).toBe(true);
    expect(engine.getTrackStates()['d'].solo).toBe(false);

    // Multi-solo: Solo drums simultaneously
    engine.setTrackSolo('d', true);
    expect(engine.getTrackStates()['v'].solo).toBe(true);
    expect(engine.getTrackStates()['d'].solo).toBe(true);
    expect(engine.getTrackStates()['b'].solo).toBe(false);

    // Clear solo
    engine.setTrackSolo('v', false);
    engine.setTrackSolo('d', false);
    expect(engine.getTrackStates()['v'].solo).toBe(false);
    expect(engine.getTrackStates()['d'].solo).toBe(false);
  });

  it('6. applies Karaoke and Instrumental presets accurately', async () => {
    const configs: StemTrackConfig[] = [
      { id: 'v', name: 'vocals', label: 'Vocals', blob: createSyntheticWav(1.0, 44100) },
      { id: 'd', name: 'drums', label: 'Drums', blob: createSyntheticWav(1.0, 44100) },
      { id: 'b', name: 'bass', label: 'Bass', blob: createSyntheticWav(1.0, 44100) },
      { id: 'o', name: 'other', label: 'Other', blob: createSyntheticWav(1.0, 44100) },
    ];
    await engine.loadTracks(configs);

    // Apply Karaoke Preset
    engine.applyPreset('karaoke');
    let states = engine.getTrackStates();
    expect(states['v'].volume).toBe(0);
    expect(states['v'].muted).toBe(true);
    expect(states['d'].volume).toBe(1.0);
    expect(states['b'].volume).toBe(1.0);
    expect(states['o'].volume).toBe(1.0);

    // Apply Vocals Only Preset
    engine.applyPreset('vocals-only');
    states = engine.getTrackStates();
    expect(states['v'].volume).toBe(1.0);
    expect(states['v'].solo).toBe(true);
    expect(states['d'].volume).toBe(0);
    expect(states['b'].volume).toBe(0);

    // Apply Original Balance Preset
    engine.applyPreset('original-balance');
    states = engine.getTrackStates();
    expect(states['v'].volume).toBe(1.0);
    expect(states['v'].muted).toBe(false);
    expect(states['v'].solo).toBe(false);
    expect(states['d'].volume).toBe(1.0);
  });

  it('7. controls playback speed, loop and A/B comparison mode', async () => {
    engine.setSpeed(1.25);
    expect(engine.getPlaybackSpeed()).toBe(1.25);

    engine.setLoop(true);
    expect(engine.getIsLooping()).toBe(true);

    expect(engine.getIsABOriginalMode()).toBe(false);
    engine.toggleABOriginalMode();
    expect(engine.getIsABOriginalMode()).toBe(true);
    engine.toggleABOriginalMode();
    expect(engine.getIsABOriginalMode()).toBe(false);
  });

  it('8. renders custom mix offline to valid 16-bit PCM WAV ("Export My Mix")', async () => {
    const configs: StemTrackConfig[] = [
      { id: 'v', name: 'vocals', label: 'Vocals', blob: createSyntheticWav(1.0, 44100, 440) },
      { id: 'd', name: 'drums', label: 'Drums', blob: createSyntheticWav(1.0, 44100, 220) },
      { id: 'b', name: 'bass', label: 'Bass', blob: createSyntheticWav(1.0, 44100, 110) },
    ];
    await engine.loadTracks(configs);

    // Set custom mix: 50% vocals, 80% drums, 100% bass
    engine.setTrackVolume('v', 0.5);
    engine.setTrackVolume('d', 0.8);
    engine.setTrackVolume('b', 1.0);

    const mixBlob = await engine.exportMix({ normalize: true });
    expect(mixBlob).toBeDefined();
    expect(mixBlob.type).toBe('audio/wav');
    expect(mixBlob.size).toBeGreaterThan(10000);

    // Verify WAV container
    const headerBuffer = await mixBlob.slice(0, 12).arrayBuffer();
    const bytes = new Uint8Array(headerBuffer);
    const riff = String.fromCharCode(...bytes.slice(0, 4));
    const wave = String.fromCharCode(...bytes.slice(8, 12));
    expect(riff).toBe('RIFF');
    expect(wave).toBe('WAVE');
  });

  it('9. handles playback lifecycle (play, pause, stop, restart, seek)', async () => {
    const configs: StemTrackConfig[] = [
      { id: 'v', name: 'vocals', label: 'Vocals', blob: createSyntheticWav(2.0, 44100) },
    ];
    await engine.loadTracks(configs);

    engine.play();
    expect(engine.getPlaybackState()).toBe('playing');

    engine.pause();
    expect(engine.getPlaybackState()).toBe('paused');

    engine.seek(1.2);
    expect(engine.getCurrentTime()).toBe(1.2);

    engine.stop();
    expect(engine.getPlaybackState()).toBe('stopped');
    expect(engine.getCurrentTime()).toBe(0);

    engine.restart();
    expect(engine.getPlaybackState()).toBe('stopped');
  });
});
