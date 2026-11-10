export type ProcessingMode = 'quick-local' | 'ai-pro' | 'multi-stem';

export type StemType = 'vocals' | 'instrumental' | 'drums' | 'bass' | 'other';

export type JobStatus = 'draft' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export type ProcessingStage = 'ready' | 'loading' | 'analyzing' | 'processing' | 'completed' | 'failed';

export type OutputAudioFormat = 'wav' | 'mp3' | 'flac';

export type QualityPreset = 'fast' | 'high' | 'ultra';

export interface AudioMetadata {
  duration: number; // in seconds
  sampleRate: number; // e.g. 44100, 48000
  channels: number; // 1 (mono), 2 (stereo)
  format: string; // 'MP3', 'WAV', 'FLAC', etc.
  fileSize: number; // in bytes
  bitrateKbps?: number;
  bitDepth?: number | string; // e.g. 16, 24, or "32-bit Float"
  peakAmplitude?: number; // Linear peak (0.0 to 1.0)
  peakDb?: number; // Peak dBFS (e.g. -0.2 dBFS)
  rmsLevel?: number; // Linear RMS (0.0 to 1.0)
  rmsDb?: number; // RMS dBFS (e.g. -14.5 dBFS)
  peaks?: number[]; // Normalized waveform peak heights (0.0 to 1.0)
  isMono?: boolean;
}

export interface SeparationConfig {
  mode: ProcessingMode;
  stems: StemType[];
  outputFormat: OutputAudioFormat;
  quality: QualityPreset;
  applyNoiseReduction: boolean;
  normalizeLoudness: boolean;
}

export type EngineConnectionState =
  | 'connected'
  | 'engine-not-running'
  | 'connecting'
  | 'model-not-installed'
  | 'model-unavailable'
  | 'processing-unavailable'
  | 'connection-error';

export interface GeneratedStem {
  id: string;
  type: StemType;
  label: string;
  format: OutputAudioFormat;
  available: boolean;
  fileSize?: number;
  url?: string;
  notes?: string;
  downloadUrl?: string;
}

export interface StemMixerSettings {
  volume: number; // 0.0 to 1.0
  muted: boolean;
  solo: boolean;
}

export interface ProjectMixerState {
  stems: Record<string, StemMixerSettings>;
  preset: string;
  playbackSpeed: number;
  isLooping: boolean;
  lastPosition?: number;
}

export interface Project {
  id: string;
  name: string;
  originalFileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
  duration: number;
  metadata: AudioMetadata;
  config: SeparationConfig;
  status: JobStatus;
  stems: GeneratedStem[];
  notes?: string;
  backendJobId?: string;
  deviceUsed?: string;
  modelUsed?: string;
  processingTimeSeconds?: number;
  mixerState?: ProjectMixerState;
}

export interface ProcessingJob {
  id: string;
  projectId: string;
  projectName: string;
  fileName: string;
  mode: ProcessingMode;
  status: JobStatus;
  startedAt: string;
  completedAt?: string;
  durationSeconds?: number;
  errorMessage?: string;
  progress: number;
  engine: string;
  logs: string[];
  backendJobId?: string;
  stage?: string;
  deviceUsed?: string;
}

export interface AppSettings {
  accentColor: 'purple' | 'blue' | 'emerald';
  defaultFormat: OutputAudioFormat;
  defaultQuality: QualityPreset;
  normalizeOutput: boolean;
  pythonEngineUrl: string;
  devicePreference: 'auto' | 'cuda' | 'cpu' | 'directml';
  autoPingEngine: boolean;
  lowMemoryMode: boolean;
  maxUploadSizeBytes: number;
}

export interface EngineHealth {
  connected: boolean;
  state: EngineConnectionState;
  statusText: string;
  version?: string;
  pythonVersion?: string;
  pytorchVersion?: string;
  demucsVersion?: string;
  device?: string;
  cudaAvailable?: boolean;
  cpuThreads?: number;
  systemMemoryGb?: number | null;
  availableModels?: string[];
  defaultModel?: string;
  supportedFormats?: string[];
  modelCached?: boolean;
  maxUploadSizeMb?: number;
  latencyMs?: number;
  lastChecked: number;
  errorMessage?: string;
}

export interface SystemDiagnostics {
  browser: string;
  webAudioSupported: boolean;
  indexedDbSupported: boolean;
  hardwareConcurrency: number;
  deviceMemoryGB?: number;
  isOnline: boolean;
  storageUsedBytes?: number;
  storageQuotaBytes?: number;
}

export interface NotificationItem {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  timestamp: number;
  durationMs?: number;
}

