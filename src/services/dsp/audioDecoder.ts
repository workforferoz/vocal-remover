import { analyzeAudioChannels, type AudioAnalysisStats } from './vocalReducer';

export interface DecodedAudioPayload {
  channels: Float32Array[];
  sampleRate: number;
  duration: number;
  numberOfChannels: number;
  format: string;
  bitDepth: string;
  stats: AudioAnalysisStats;
  waveformPeaks: Float32Array; // Decimated peaks for canvas rendering
}

let sharedAudioContext: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedAudioContext = new AudioCtx();
  }
  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume().catch(() => {});
  }
  return sharedAudioContext;
}

/**
 * Attempts to parse bit depth directly from WAV headers.
 */
export function detectBitDepthFromBuffer(arrayBuffer: ArrayBuffer): string {
  if (arrayBuffer.byteLength < 44) return '16-bit / Compressed';
  const view = new DataView(arrayBuffer);

  // Check for "RIFF" and "WAVE"
  const isRiff =
    view.getUint8(0) === 0x52 && // 'R'
    view.getUint8(1) === 0x49 && // 'I'
    view.getUint8(2) === 0x46 && // 'F'
    view.getUint8(3) === 0x46; // 'F'

  const isWave =
    view.getUint8(8) === 0x57 && // 'W'
    view.getUint8(9) === 0x41 && // 'A'
    view.getUint8(10) === 0x56 && // 'V'
    view.getUint8(11) === 0x45; // 'E'

  if (isRiff && isWave) {
    // Locate "fmt " chunk
    let offset = 12;
    while (offset < arrayBuffer.byteLength - 8) {
      const chunkId =
        String.fromCharCode(view.getUint8(offset)) +
        String.fromCharCode(view.getUint8(offset + 1)) +
        String.fromCharCode(view.getUint8(offset + 2)) +
        String.fromCharCode(view.getUint8(offset + 3));

      const chunkSize = view.getUint32(offset + 4, true);

      if (chunkId === 'fmt ') {
        const audioFormat = view.getUint16(offset + 8, true);
        const bitsPerSample = view.getUint16(offset + 22, true);
        if (audioFormat === 3) {
          return `${bitsPerSample}-bit IEEE Float WAV`;
        }
        return `${bitsPerSample}-bit PCM WAV`;
      }
      offset += 8 + chunkSize;
    }
  }

  // Check for FLAC
  if (
    view.getUint8(0) === 0x66 && // 'f'
    view.getUint8(1) === 0x4c && // 'L'
    view.getUint8(2) === 0x61 && // 'a'
    view.getUint8(3) === 0x43 // 'C'
  ) {
    return 'Lossless FLAC';
  }

  return '16-bit / Compressed (Decoded to 32-bit Float)';
}

/**
 * Generates an efficient decimated peak array for instant canvas rendering.
 * Keeps memory low by downsampling to targetPeakCount (default 1000 points).
 */
export function generateCanvasPeaks(channels: Float32Array[], targetPeakCount: number = 1000): Float32Array {
  if (channels.length === 0 || channels[0].length === 0) {
    return new Float32Array(targetPeakCount);
  }

  const numSamples = channels[0].length;
  const numChannels = channels.length;
  const step = Math.max(1, Math.floor(numSamples / targetPeakCount));
  const outputLength = Math.min(targetPeakCount, Math.ceil(numSamples / step));
  const peaks = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const start = i * step;
    const end = Math.min(start + step, numSamples);
    let maxVal = 0;

    for (let s = start; s < end; s++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const val = Math.abs(channels[ch][s]);
        if (val > maxVal) maxVal = val;
      }
    }
    peaks[i] = maxVal;
  }

  return peaks;
}

/**
 * Decodes an audio file or blob into native Float32Array audio channels using Web Audio API.
 * Validates actual decoding success and reports errors.
 */
export async function decodeAudioFile(
  file: File | Blob,
  fileName: string = 'audio',
  onProgress?: (stage: string) => void
): Promise<DecodedAudioPayload> {
  if (file.size === 0) {
    throw new Error('Selected audio file is empty (0 bytes).');
  }

  if (onProgress) onProgress('Reading file into memory buffer...');
  const arrayBuffer = await file.arrayBuffer();

  // Detect bit depth from headers if WAV/FLAC
  const bitDepth = detectBitDepthFromBuffer(arrayBuffer);

  if (onProgress) onProgress('Decoding audio stream with Web Audio API...');
  const audioCtx = getAudioContext();

  // Clone buffer to avoid detach issues on older Web Audio implementations
  const bufferCopy = arrayBuffer.slice(0);

  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await audioCtx.decodeAudioData(bufferCopy);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Web Audio decoding failed for "${fileName}". The file may be corrupt or encoded with a format unsupported by your browser: ${msg}`
    );
  }

  if (onProgress) onProgress('Extracting channel data and analyzing peaks...');
  const numChannels = audioBuffer.numberOfChannels;
  const channels: Float32Array[] = [];

  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(audioBuffer.getChannelData(ch));
  }

  const stats = analyzeAudioChannels(channels, audioBuffer.sampleRate);
  stats.bitDepthEstimate = bitDepth;

  if (onProgress) onProgress('Generating lightweight waveform preview...');
  const waveformPeaks = generateCanvasPeaks(channels, 1000);

  let format = 'UNKNOWN';
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith('.wav')) format = 'WAV';
  else if (lowerName.endsWith('.mp3')) format = 'MP3';
  else if (lowerName.endsWith('.flac')) format = 'FLAC';
  else if (lowerName.endsWith('.m4a')) format = 'M4A';
  else if (lowerName.endsWith('.aac')) format = 'AAC';
  else if (lowerName.endsWith('.ogg')) format = 'OGG';
  else if (file.type.includes('wav')) format = 'WAV';
  else if (file.type.includes('mpeg')) format = 'MP3';
  else if (file.type.includes('flac')) format = 'FLAC';

  return {
    channels,
    sampleRate: audioBuffer.sampleRate,
    duration: audioBuffer.duration,
    numberOfChannels: numChannels,
    format,
    bitDepth,
    stats,
    waveformPeaks,
  };
}

