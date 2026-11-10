import type { AudioMetadata } from '../types';

export const SUPPORTED_EXTENSIONS = ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg'];
export const SUPPORTED_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/flac',
  'audio/x-flac',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'audio/aac',
  'audio/ogg',
  'audio/webm',
];

export const MAX_FILE_SIZE_BYTES = 150 * 1024 * 1024; // 150MB

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  format?: string;
}

export function validateAudioFile(file: File, maxSizeBytes: number = MAX_FILE_SIZE_BYTES): FileValidationResult {
  if (!file) {
    return { valid: false, error: 'No file selected' };
  }

  // Size validation
  if (file.size > maxSizeBytes) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    const maxMb = (maxSizeBytes / (1024 * 1024)).toFixed(0);
    return {
      valid: false,
      error: `File size (${sizeMb} MB) exceeds maximum allowed limit of ${maxMb} MB for local processing.`,
    };
  }

  if (file.size === 0) {
    return { valid: false, error: 'Selected file is empty (0 bytes).' };
  }

  // Extension validation
  const lowerName = file.name.toLowerCase();
  const hasValidExt = SUPPORTED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  const hasValidMime = SUPPORTED_MIME_TYPES.includes(file.type.toLowerCase()) || file.type.startsWith('audio/');

  if (!hasValidExt && !hasValidMime) {
    return {
      valid: false,
      error: 'Unsupported audio format. Please upload MP3, WAV, FLAC, M4A, AAC, or OGG audio files.',
    };
  }

  let format = 'UNKNOWN';
  if (lowerName.endsWith('.mp3')) format = 'MP3';
  else if (lowerName.endsWith('.wav')) format = 'WAV';
  else if (lowerName.endsWith('.flac')) format = 'FLAC';
  else if (lowerName.endsWith('.m4a')) format = 'M4A';
  else if (lowerName.endsWith('.aac')) format = 'AAC';
  else if (lowerName.endsWith('.ogg')) format = 'OGG';
  else if (file.type.includes('mpeg')) format = 'MP3';
  else if (file.type.includes('wav')) format = 'WAV';
  else if (file.type.includes('flac')) format = 'FLAC';

  return { valid: true, format };
}

/**
 * Extracts duration and metadata using lightweight HTML5 Audio element.
 * This is extremely memory-friendly for low-end PCs (no uncompressed PCM in RAM).
 */
export async function extractAudioMetadata(file: File): Promise<AudioMetadata> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const duration = await new Promise<number>((resolve, reject) => {
      const audio = new Audio();
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Audio metadata loading timed out.'));
      }, 10000);

      const cleanup = () => {
        clearTimeout(timeout);
        audio.removeEventListener('loadedmetadata', onLoaded);
        audio.removeEventListener('error', onError);
        audio.src = '';
      };

      const onLoaded = () => {
        const d = audio.duration;
        cleanup();
        if (isNaN(d) || !isFinite(d)) {
          resolve(0);
        } else {
          resolve(d);
        }
      };

      const onError = () => {
        cleanup();
        reject(new Error('Could not decode audio metadata. File might be corrupted or format not supported by browser.'));
      };

      audio.addEventListener('loadedmetadata', onLoaded);
      audio.addEventListener('error', onError);
      audio.preload = 'metadata';
      audio.src = objectUrl;
    });

    const validation = validateAudioFile(file);
    const format = validation.format || 'AUDIO';

    // Calculate approximate bitrate if duration is known
    let bitrateKbps: number | undefined;
    if (duration > 0) {
      bitrateKbps = Math.round((file.size * 8) / duration / 1000);
    }

    // Generate lightweight visual peak approximation based on file size and hash
    // Avoids massive WebAudio full buffer decode on 4GB RAM machines
    const peaks = generateLightweightPeaks(duration, file.size);

    return {
      duration,
      sampleRate: 44100, // Standard default for preview
      channels: 2, // Standard stereo representation
      format,
      fileSize: file.size,
      bitrateKbps,
      peaks,
    };
  } finally {
    // Crucial for low-end memory optimization: immediately release URL when done
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Generates an organic, consistent pseudo-waveform for instant visual feedback
 * without stalling the browser main thread or consuming 400MB RAM decoding PCM.
 */
function generateLightweightPeaks(duration: number, fileSize: number, barCount: number = 80): number[] {
  const peaks: number[] = [];
  const seed = (duration * 1000 + fileSize) % 100000;
  
  for (let i = 0; i < barCount; i++) {
    const phase = (i / barCount) * Math.PI * 4;
    // Layered sines with noise seed for natural music energy contours (intro, chorus swell, outro)
    const contour = Math.sin(phase * 0.5) * 0.3 + 0.5;
    const micro = Math.abs(Math.sin((i * 13 + seed) * 0.7));
    const dynamic = Math.max(0.12, Math.min(0.95, contour * 0.6 + micro * 0.4));
    peaks.push(parseFloat(dynamic.toFixed(3)));
  }
  return peaks;
}

export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

