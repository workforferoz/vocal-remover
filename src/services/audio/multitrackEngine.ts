/**
 * Vocal Studio AI - Multitrack Audio Engine (Stage 5)
 * Centralized, drift-free, Web Audio API multitrack playback, mixing, and offline rendering engine.
 */

import { encodeWavBlob } from '../dsp/wavEncoder';

export interface StemTrackConfig {
  id: string;
  name: string; // 'vocals' | 'drums' | 'bass' | 'other' | 'original'
  label: string;
  url?: string;
  blob?: Blob;
  initialVolume?: number; // 0.0 to 1.0
  initialMuted?: boolean;
  initialSolo?: boolean;
}

export interface TrackRuntimeState {
  id: string;
  name: string;
  label: string;
  volume: number; // 0.0 to 1.0 (default 1.0)
  muted: boolean;
  solo: boolean;
  isLoaded: boolean;
  isLoading: boolean;
  error?: string;
  duration: number;
}

export type PlaybackState = 'stopped' | 'playing' | 'paused';
export type StudioPreset = 'original-balance' | 'karaoke' | 'instrumental' | 'vocals-only' | 'custom';

export interface MultitrackEngineCallbacks {
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onStateChange?: (state: PlaybackState) => void;
  onTrackStateChange?: (tracks: Record<string, TrackRuntimeState>) => void;
  onEnded?: () => void;
  onError?: (error: string) => void;
}

export class MultitrackAudioEngine {
  private audioContext: AudioContext | null = null;
  private tracks: Map<
    string,
    {
      config: StemTrackConfig;
      state: TrackRuntimeState;
      buffer: AudioBuffer | null;
      gainNode: GainNode | null;
      sourceNode: AudioBufferSourceNode | null;
    }
  > = new Map();

  private masterGainNode: GainNode | null = null;
  private playbackState: PlaybackState = 'stopped';
  private playbackSpeed: number = 1.0;
  private isLooping: boolean = false;
  private isABOriginalMode: boolean = false; // When true, listens exclusively to Original track

  // Timing coordinates
  private startTime: number = 0; // audioContext.currentTime when playback began
  private pauseOffset: number = 0; // audio offset in seconds when paused
  private totalDuration: number = 0;
  private animationFrameId: number | null = null;

  private callbacks: MultitrackEngineCallbacks = {};

  constructor(callbacks?: MultitrackEngineCallbacks) {
    if (callbacks) {
      this.callbacks = callbacks;
    }
  }

  public setCallbacks(callbacks: MultitrackEngineCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Initializes or resumes the Web Audio context.
   */
  private getOrCreateAudioContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      const AudioCtx =
        (typeof window !== 'undefined' &&
          (window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)) ||
        (typeof globalThis !== 'undefined' && (globalThis as any).AudioContext);

      if (!AudioCtx) {
        throw new Error('Web Audio API is not supported in this environment.');
      }
      this.audioContext = new AudioCtx();
    }
    const ctx = this.audioContext!;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  /**
   * Loads and registers a set of stem tracks.
   */
  public async loadTracks(configs: StemTrackConfig[]): Promise<void> {
    this.stop();
    this.tracks.clear();
    this.totalDuration = 0;
    this.pauseOffset = 0;

    const ctx = this.getOrCreateAudioContext();

    // Master gain
    if (!this.masterGainNode) {
      this.masterGainNode = ctx.createGain();
      this.masterGainNode.connect(ctx.destination);
    }

    // Initialize track records
    configs.forEach((cfg) => {
      this.tracks.set(cfg.id, {
        config: cfg,
        state: {
          id: cfg.id,
          name: cfg.name,
          label: cfg.label,
          volume: cfg.initialVolume !== undefined ? cfg.initialVolume : 1.0,
          muted: cfg.initialMuted || false,
          solo: cfg.initialSolo || false,
          isLoaded: false,
          isLoading: true,
          duration: 0,
        },
        buffer: null,
        gainNode: null,
        sourceNode: null,
      });
    });

    this.notifyTrackStates();

    // Load each track's audio data in parallel
    const loadPromises = Array.from(this.tracks.values()).map(async (entry) => {
      try {
        let arrayBuffer: ArrayBuffer;

        if (entry.config.blob) {
          arrayBuffer = await entry.config.blob.arrayBuffer();
        } else if (entry.config.url) {
          const res = await fetch(entry.config.url);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          arrayBuffer = await res.arrayBuffer();
        } else {
          throw new Error('No audio source provided for stem track');
        }

        const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
        entry.buffer = decodedBuffer;
        entry.state.isLoaded = true;
        entry.state.isLoading = false;
        entry.state.duration = decodedBuffer.duration;

        if (decodedBuffer.duration > this.totalDuration) {
          this.totalDuration = decodedBuffer.duration;
        }

        // Create per-track gain node
        const gain = ctx.createGain();
        gain.connect(this.masterGainNode!);
        entry.gainNode = gain;
      } catch (err: unknown) {
        entry.state.isLoading = false;
        entry.state.isLoaded = false;
        entry.state.error = err instanceof Error ? err.message : 'Failed to decode audio';
      }
    });

    await Promise.all(loadPromises);

    this.recomputeAllGains();
    this.notifyTrackStates();
    this.callbacks.onTimeUpdate?.(0, this.totalDuration);
  }

  /**
   * Recalculates effective gain for each track accounting for volume, mute, solo, and A/B mode.
   */
  private recomputeAllGains(): void {
    if (!this.audioContext) return;
    const now = this.audioContext.currentTime;

    // Check if any track has solo enabled (excluding original unless it's soloed)
    const activeSoloTracks = Array.from(this.tracks.values()).filter((t) => t.state.solo && t.state.isLoaded);
    const hasSolo = activeSoloTracks.length > 0;

    this.tracks.forEach((entry) => {
      if (!entry.gainNode) return;

      let targetGain = 0;

      if (this.isABOriginalMode) {
        // In A/B Original mode, only the 'original' stem sounds
        targetGain = entry.config.name === 'original' ? entry.state.volume : 0;
      } else if (entry.config.name === 'original') {
        // By default, original is muted during stem mix unless explicitly soloed
        targetGain = entry.state.solo ? entry.state.volume : 0;
      } else {
        // Standard stems (vocals, drums, bass, other)
        if (entry.state.muted) {
          targetGain = 0;
        } else if (hasSolo) {
          targetGain = entry.state.solo ? entry.state.volume : 0;
        } else {
          targetGain = entry.state.volume;
        }
      }

      // Smooth gain ramp to prevent audio clicks/pops
      entry.gainNode.gain.cancelScheduledValues(now);
      entry.gainNode.gain.setValueAtTime(entry.gainNode.gain.value, now);
      entry.gainNode.gain.linearRampToValueAtTime(targetGain, now + 0.02);
    });
  }

  /**
   * Starts synchronized playback across all loaded stem tracks.
   */
  public play(): void {
    if (this.playbackState === 'playing') return;

    const ctx = this.getOrCreateAudioContext();
    const readyTracks = Array.from(this.tracks.values()).filter((t) => t.state.isLoaded && t.buffer);
    if (readyTracks.length === 0) return;

    // Microsecond synchronized launch time
    const scheduleTime = ctx.currentTime + 0.03;
    const offset = Math.min(this.pauseOffset, this.totalDuration);

    readyTracks.forEach((entry) => {
      // Disconnect old source node if present
      if (entry.sourceNode) {
        try {
          entry.sourceNode.stop();
          entry.sourceNode.disconnect();
        } catch {
          // Ignore
        }
      }

      const source = ctx.createBufferSource();
      source.buffer = entry.buffer;
      source.playbackRate.value = this.playbackSpeed;
      source.loop = this.isLooping;

      source.connect(entry.gainNode!);

      // Synchronously schedule all active tracks
      source.start(scheduleTime, offset);
      entry.sourceNode = source;
    });

    this.startTime = scheduleTime;
    this.playbackState = 'playing';
    this.callbacks.onStateChange?.('playing');

    this.startProgressLoop();
  }

  /**
   * Pauses multitrack playback preserving current playback position.
   */
  public pause(): void {
    if (this.playbackState !== 'playing') return;

    this.pauseOffset = this.getCurrentTime();
    this.stopSourceNodes();

    this.playbackState = 'paused';
    this.callbacks.onStateChange?.('paused');
    this.stopProgressLoop();
  }

  /**
   * Stops playback and resets timeline position to 0.
   */
  public stop(): void {
    this.stopSourceNodes();
    this.pauseOffset = 0;
    this.playbackState = 'stopped';
    this.callbacks.onStateChange?.('stopped');
    this.callbacks.onTimeUpdate?.(0, this.totalDuration);
    this.stopProgressLoop();
  }

  /**
   * Restarts playback from beginning.
   */
  public restart(): void {
    const wasPlaying = this.playbackState === 'playing';
    this.stop();
    if (wasPlaying) {
      this.play();
    }
  }

  /**
   * Seeks all tracks to a specific timestamp in seconds.
   */
  public seek(targetSeconds: number): void {
    const clampedTime = Math.max(0, Math.min(targetSeconds, this.totalDuration));
    const wasPlaying = this.playbackState === 'playing';

    if (wasPlaying) {
      this.pauseOffset = clampedTime;
      this.play();
    } else {
      this.pauseOffset = clampedTime;
      this.callbacks.onTimeUpdate?.(clampedTime, this.totalDuration);
    }
  }

  /**
   * Sets the playback speed (0.75x, 1x, 1.25x, 1.5x).
   */
  public setSpeed(speed: number): void {
    this.playbackSpeed = Math.max(0.25, Math.min(speed, 4.0));
    this.tracks.forEach((entry) => {
      if (entry.sourceNode) {
        entry.sourceNode.playbackRate.setValueAtTime(
          this.playbackSpeed,
          this.audioContext?.currentTime || 0
        );
      }
    });
  }

  /**
   * Toggles playback looping.
   */
  public setLoop(loop: boolean): void {
    this.isLooping = loop;
    this.tracks.forEach((entry) => {
      if (entry.sourceNode) {
        entry.sourceNode.loop = loop;
      }
    });
  }

  /**
   * Calculates current playback position based on Web Audio clock.
   */
  public getCurrentTime(): number {
    if (this.playbackState === 'playing' && this.audioContext) {
      const elapsedCtxTime = (this.audioContext.currentTime - this.startTime) * this.playbackSpeed;
      const current = this.pauseOffset + elapsedCtxTime;

      if (this.isLooping && this.totalDuration > 0) {
        return current % this.totalDuration;
      }

      if (current >= this.totalDuration && this.totalDuration > 0) {
        return this.totalDuration;
      }

      return Math.max(0, current);
    }
    return this.pauseOffset;
  }

  public getTotalDuration(): number {
    return this.totalDuration;
  }

  public getPlaybackState(): PlaybackState {
    return this.playbackState;
  }

  public getPlaybackSpeed(): number {
    return this.playbackSpeed;
  }

  public getIsLooping(): boolean {
    return this.isLooping;
  }

  public getIsABOriginalMode(): boolean {
    return this.isABOriginalMode;
  }

  /**
   * Toggles A/B mode between the Original track and the Demucs stems mix.
   */
  public toggleABOriginalMode(enable?: boolean): boolean {
    this.isABOriginalMode = enable !== undefined ? enable : !this.isABOriginalMode;
    this.recomputeAllGains();
    return this.isABOriginalMode;
  }

  // -------------------------------------------------------------
  // Track Mixer Controls
  // -------------------------------------------------------------

  public setTrackVolume(trackId: string, volume: number): void {
    const entry = this.tracks.get(trackId);
    if (!entry) return;

    entry.state.volume = Math.max(0, Math.min(volume, 1.0));
    this.recomputeAllGains();
    this.notifyTrackStates();
  }

  public setTrackMute(trackId: string, muted?: boolean): void {
    const entry = this.tracks.get(trackId);
    if (!entry) return;

    entry.state.muted = muted !== undefined ? muted : !entry.state.muted;
    this.recomputeAllGains();
    this.notifyTrackStates();
  }

  public setTrackSolo(trackId: string, solo?: boolean): void {
    const entry = this.tracks.get(trackId);
    if (!entry) return;

    entry.state.solo = solo !== undefined ? solo : !entry.state.solo;
    this.recomputeAllGains();
    this.notifyTrackStates();
  }

  /**
   * Applies an audio mixer preset across all stem tracks.
   */
  public applyPreset(preset: StudioPreset): void {
    this.tracks.forEach((entry) => {
      const name = entry.config.name.toLowerCase();

      // Reset mute and solo
      entry.state.muted = false;
      entry.state.solo = false;

      switch (preset) {
        case 'karaoke':
        case 'instrumental':
          // Vocals muted / zeroed, backing stems at 100%
          if (name === 'vocals') {
            entry.state.volume = 0;
            entry.state.muted = true;
          } else if (name !== 'original') {
            entry.state.volume = 1.0;
          }
          break;

        case 'vocals-only':
          // Vocals soloed / 100%, others zeroed
          if (name === 'vocals') {
            entry.state.volume = 1.0;
            entry.state.solo = true;
          } else {
            entry.state.volume = 0;
          }
          break;

        case 'original-balance':
        default:
          // Default: all stems active at 100%
          entry.state.volume = 1.0;
          entry.state.muted = false;
          entry.state.solo = false;
          break;
      }
    });

    this.recomputeAllGains();
    this.notifyTrackStates();
  }

  public getTrackStates(): Record<string, TrackRuntimeState> {
    const res: Record<string, TrackRuntimeState> = {};
    this.tracks.forEach((entry, key) => {
      res[key] = { ...entry.state };
    });
    return res;
  }

  // -------------------------------------------------------------
  // Offline Audio Rendering ("Export My Mix")
  // -------------------------------------------------------------

  /**
   * Renders the current custom stem mix offline to a pristine 16-bit PCM WAV Blob.
   * Handles volume, mute, solo, and dynamic peak limiting to prevent clipping.
   */
  public async exportMix(options: {
    normalize?: boolean;
    sampleRate?: number;
  } = {}): Promise<Blob> {
    const activeTracks = Array.from(this.tracks.values()).filter(
      (t) => t.state.isLoaded && t.buffer && t.config.name !== 'original'
    );

    if (activeTracks.length === 0) {
      throw new Error('No loaded stem tracks available to render mix.');
    }

    const sampleRate = options.sampleRate || activeTracks[0].buffer!.sampleRate || 44100;
    const duration = this.totalDuration;
    const totalFrames = Math.ceil(duration * sampleRate);

    // Create OfflineAudioContext for high-speed hardware rendering
    const OfflineCtx =
      (typeof window !== 'undefined' &&
        (window.OfflineAudioContext ||
          (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext })
            .webkitOfflineAudioContext)) ||
      (typeof globalThis !== 'undefined' && (globalThis as any).OfflineAudioContext);

    if (!OfflineCtx) {
      throw new Error('OfflineAudioContext is not supported in this environment.');
    }

    const offlineCtx = new OfflineCtx(2, totalFrames, sampleRate);

    // Determine solo status
    const hasSolo = activeTracks.some((t) => t.state.solo);

    activeTracks.forEach((entry) => {
      if (!entry.buffer) return;

      let gainVal = entry.state.volume;
      if (entry.state.muted || (hasSolo && !entry.state.solo)) {
        gainVal = 0;
      }

      if (gainVal <= 0.0001) return; // Skip silent tracks

      const source = offlineCtx.createBufferSource();
      source.buffer = entry.buffer;

      const gainNode = offlineCtx.createGain();
      gainNode.gain.setValueAtTime(gainVal, 0);

      source.connect(gainNode);
      gainNode.connect(offlineCtx.destination);
      source.start(0);
    });

    // Execute offline render
    const renderedBuffer = await offlineCtx.startRendering();

    // Extract Float32Array channel data
    const leftChannel = renderedBuffer.getChannelData(0);
    const rightChannel =
      renderedBuffer.numberOfChannels > 1
        ? renderedBuffer.getChannelData(1)
        : leftChannel; // Mono-to-stereo fallback

    // Peak analysis to prevent digital clipping
    let peak = 0;
    for (let i = 0; i < leftChannel.length; i++) {
      const absL = Math.abs(leftChannel[i]);
      const absR = Math.abs(rightChannel[i]);
      if (absL > peak) peak = absL;
      if (absR > peak) peak = absR;
    }

    const finalChannels: Float32Array[] = [
      new Float32Array(leftChannel.length),
      new Float32Array(rightChannel.length),
    ];

    // If sum exceeds 1.0 (clipping) or normalize requested, scale safely
    let scale = 1.0;
    if (options.normalize && peak > 0.01) {
      scale = 0.98 / peak; // Normalize to -0.2 dBFS
    } else if (peak > 1.0) {
      scale = 0.99 / peak; // Soft-limit to prevent harsh digital wrapping
    }

    for (let i = 0; i < leftChannel.length; i++) {
      finalChannels[0][i] = leftChannel[i] * scale;
      finalChannels[1][i] = rightChannel[i] * scale;
    }

    // Encode to standard 16-bit PCM WAV
    return encodeWavBlob(finalChannels, sampleRate);
  }

  // -------------------------------------------------------------
  // Internal Helpers & Loops
  // -------------------------------------------------------------

  private stopSourceNodes(): void {
    this.tracks.forEach((entry) => {
      if (entry.sourceNode) {
        try {
          entry.sourceNode.stop();
          entry.sourceNode.disconnect();
        } catch {
          // Ignore
        }
        entry.sourceNode = null;
      }
    });
  }

  private startProgressLoop(): void {
    this.stopProgressLoop();

    const requestFrame =
      typeof requestAnimationFrame !== 'undefined'
        ? requestAnimationFrame
        : (cb: () => void) => (setTimeout(cb, 16) as unknown as number);

    const loop = () => {
      const current = this.getCurrentTime();
      this.callbacks.onTimeUpdate?.(current, this.totalDuration);

      if (current >= this.totalDuration && !this.isLooping && this.totalDuration > 0) {
        this.stop();
        this.callbacks.onEnded?.();
        return;
      }

      this.animationFrameId = requestFrame(loop);
    };

    this.animationFrameId = requestFrame(loop);
  }

  private stopProgressLoop(): void {
    if (this.animationFrameId !== null) {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(this.animationFrameId);
      } else {
        clearTimeout(this.animationFrameId as unknown as any);
      }
      this.animationFrameId = null;
    }
  }

  private notifyTrackStates(): void {
    this.callbacks.onTrackStateChange?.(this.getTrackStates());
  }

  /**
   * Complete engine teardown and resource release.
   */
  public destroy(): void {
    this.stop();
    this.tracks.clear();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }
}
