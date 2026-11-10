/**
 * DSP Center-Channel Cancellation Engine.
 * 
 * Traditional DSP stereo vocal reduction:
 * Left_output = Left_input - Right_input
 * Right_output = Right_input - Left_input
 * 
 * Blends between original stereo and centre-cancelled audio according to configurable strength.
 */

export interface ReductionConfig {
  strength: number; // 0.0 (original) to 1.0 (full reduction)
  preserveBass?: boolean; // Optional low-frequency retention
  bassCutoffHz?: number; // Cutoff for bass retention (default ~180Hz)
  sampleRate?: number;
}

export interface ReductionResult {
  channels: Float32Array[];
  vocalChannels?: Float32Array[];
  sampleRate: number;
  duration: number;
  isMono: boolean;
  warning?: string;
  peakAmplitude: number;
  rmsLevel: number;
}

export interface AudioAnalysisStats {
  duration: number;
  sampleRate: number;
  channels: number;
  isMono: boolean;
  peakLinear: number;
  peakDb: number;
  rmsLinear: number;
  rmsDb: number;
  bitDepthEstimate: string;
}

/**
 * Calculates peak amplitude, RMS level, and audio stats for given channels.
 */
export function analyzeAudioChannels(channels: Float32Array[], sampleRate: number): AudioAnalysisStats {
  if (!channels || channels.length === 0) {
    return {
      duration: 0,
      sampleRate,
      channels: 0,
      isMono: false,
      peakLinear: 0,
      peakDb: -96,
      rmsLinear: 0,
      rmsDb: -96,
      bitDepthEstimate: 'Unknown',
    };
  }

  const numChannels = channels.length;
  const numSamples = channels[0].length;
  const duration = numSamples / sampleRate;

  let peak = 0;
  let sumSquares = 0;
  const totalSampleCount = numSamples * numChannels;

  for (let ch = 0; ch < numChannels; ch++) {
    const data = channels[ch];
    for (let i = 0; i < numSamples; i++) {
      const absVal = Math.abs(data[i]);
      if (absVal > peak) peak = absVal;
      sumSquares += data[i] * data[i];
    }
  }

  const rms = totalSampleCount > 0 ? Math.sqrt(sumSquares / totalSampleCount) : 0;
  const peakDb = peak > 0 ? Math.max(-96, Math.round(20 * Math.log10(peak) * 10) / 10) : -96;
  const rmsDb = rms > 0 ? Math.max(-96, Math.round(20 * Math.log10(rms) * 10) / 10) : -96;

  return {
    duration,
    sampleRate,
    channels: numChannels,
    isMono: numChannels === 1,
    peakLinear: parseFloat(peak.toFixed(4)),
    peakDb,
    rmsLinear: parseFloat(rms.toFixed(4)),
    rmsDb,
    bitDepthEstimate: '32-bit Float (Internal PCM)',
  };
}

/**
 * Synchronous DSP centre-channel reduction algorithm.
 * Safe for mono, stereo, and variable mix strengths.
 */
export function applyVocalReductionSync(
  inputChannels: Float32Array[],
  sampleRate: number,
  config: ReductionConfig
): ReductionResult {
  const strength = Math.max(0.0, Math.min(1.0, config.strength));
  const numChannels = inputChannels.length;

  if (numChannels === 0) {
    throw new Error('DSP Engine: No audio channels provided for processing.');
  }

  const numSamples = inputChannels[0].length;
  const duration = numSamples / sampleRate;

  // Handle Mono Audio safely without crashing
  if (numChannels === 1) {
    const monoOut = new Float32Array(inputChannels[0]);
    const stats = analyzeAudioChannels([monoOut], sampleRate);
    return {
      channels: [monoOut],
      sampleRate,
      duration,
      isMono: true,
      warning:
        'Mono audio detected. Centre-channel cancellation requires stereo audio with distinct left and right channels.',
      peakAmplitude: stats.peakLinear,
      rmsLevel: stats.rmsLinear,
    };
  }

  const leftIn = inputChannels[0];
  const rightIn = inputChannels[1];

  const leftOut = new Float32Array(numSamples);
  const rightOut = new Float32Array(numSamples);
  const vocalLeft = new Float32Array(numSamples);
  const vocalRight = new Float32Array(numSamples);

  let peak = 0;
  let sumSquares = 0;

  // Single-pass processing: computes centre cancellation and blends with original stereo
  for (let i = 0; i < numSamples; i++) {
    const l = leftIn[i];
    const r = rightIn[i];

    // Centre-channel cancellation (L - R, R - L) normalized by 0.5 to prevent clipping
    const diffL = (l - r) * 0.5;
    const diffR = (r - l) * 0.5;

    // Linear interpolation between original stereo and centre-cancelled audio
    let outL = (1.0 - strength) * l + strength * diffL;
    let outR = (1.0 - strength) * r + strength * diffR;

    // Soft clamp protection to prevent accidental clipping
    if (outL > 1.0) outL = 1.0;
    else if (outL < -1.0) outL = -1.0;

    if (outR > 1.0) outR = 1.0;
    else if (outR < -1.0) outR = -1.0;

    leftOut[i] = outL;
    rightOut[i] = outR;

    // Vocal extraction (centre-channel frequency difference)
    let vL = l - outL;
    let vR = r - outR;
    if (vL > 1.0) vL = 1.0; else if (vL < -1.0) vL = -1.0;
    if (vR > 1.0) vR = 1.0; else if (vR < -1.0) vR = -1.0;
    vocalLeft[i] = vL;
    vocalRight[i] = vR;

    const absL = Math.abs(outL);
    const absR = Math.abs(outR);
    if (absL > peak) peak = absL;
    if (absR > peak) peak = absR;
    sumSquares += outL * outL + outR * outR;
  }

  const rms = numSamples > 0 ? Math.sqrt(sumSquares / (numSamples * 2)) : 0;

  return {
    channels: [leftOut, rightOut],
    vocalChannels: [vocalLeft, vocalRight],
    sampleRate,
    duration,
    isMono: false,
    peakAmplitude: parseFloat(peak.toFixed(4)),
    rmsLevel: parseFloat(rms.toFixed(4)),
  };
}

/**
 * Asynchronous, non-blocking chunked DSP vocal reduction.
 * Processes audio in chunks and invokes onProgress callback with real percentage (0 to 100).
 */
export async function applyVocalReductionAsync(
  inputChannels: Float32Array[],
  sampleRate: number,
  config: ReductionConfig,
  onProgress?: (progressPercent: number) => void
): Promise<ReductionResult> {
  const strength = Math.max(0.0, Math.min(1.0, config.strength));
  const numChannels = inputChannels.length;

  if (numChannels === 0) {
    throw new Error('DSP Engine: No audio channels provided for processing.');
  }

  const numSamples = inputChannels[0].length;
  const duration = numSamples / sampleRate;

  // Mono handling
  if (numChannels === 1) {
    if (onProgress) onProgress(100);
    const monoOut = new Float32Array(inputChannels[0]);
    const stats = analyzeAudioChannels([monoOut], sampleRate);
    return {
      channels: [monoOut],
      sampleRate,
      duration,
      isMono: true,
      warning:
        'Mono audio detected. Centre-channel cancellation requires stereo audio with distinct left and right channels.',
      peakAmplitude: stats.peakLinear,
      rmsLevel: stats.rmsLinear,
    };
  }

  const leftIn = inputChannels[0];
  const rightIn = inputChannels[1];

  const leftOut = new Float32Array(numSamples);
  const rightOut = new Float32Array(numSamples);
  const vocalLeft = new Float32Array(numSamples);
  const vocalRight = new Float32Array(numSamples);

  let peak = 0;
  let sumSquares = 0;

  const chunkSize = 131072; // ~131k samples (~2.7s @ 48kHz) per tick
  let currentSample = 0;

  return new Promise<ReductionResult>((resolve) => {
    function processNextChunk() {
      const endSample = Math.min(currentSample + chunkSize, numSamples);

      for (let i = currentSample; i < endSample; i++) {
        const l = leftIn[i];
        const r = rightIn[i];

        const diffL = (l - r) * 0.5;
        const diffR = (r - l) * 0.5;

        let outL = (1.0 - strength) * l + strength * diffL;
        let outR = (1.0 - strength) * r + strength * diffR;

        if (outL > 1.0) outL = 1.0;
        else if (outL < -1.0) outL = -1.0;

        if (outR > 1.0) outR = 1.0;
        else if (outR < -1.0) outR = -1.0;

        leftOut[i] = outL;
        rightOut[i] = outR;

        // Vocal extraction
        let vL = l - outL;
        let vR = r - outR;
        if (vL > 1.0) vL = 1.0; else if (vL < -1.0) vL = -1.0;
        if (vR > 1.0) vR = 1.0; else if (vR < -1.0) vR = -1.0;
        vocalLeft[i] = vL;
        vocalRight[i] = vR;

        const absL = Math.abs(outL);
        const absR = Math.abs(outR);
        if (absL > peak) peak = absL;
        if (absR > peak) peak = absR;
        sumSquares += outL * outL + outR * outR;
      }

      currentSample = endSample;
      const progress = Math.min(100, Math.round((currentSample / numSamples) * 100));
      if (onProgress) {
        onProgress(progress);
      }

      if (currentSample < numSamples) {
        setTimeout(processNextChunk, 0);
      } else {
        const rms = numSamples > 0 ? Math.sqrt(sumSquares / (numSamples * 2)) : 0;
        resolve({
          channels: [leftOut, rightOut],
          vocalChannels: [vocalLeft, vocalRight],
          sampleRate,
          duration,
          isMono: false,
          peakAmplitude: parseFloat(peak.toFixed(4)),
          rmsLevel: parseFloat(rms.toFixed(4)),
        });
      }
    }

    processNextChunk();
  });
}

