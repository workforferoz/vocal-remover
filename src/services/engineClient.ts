import type { EngineHealth, SystemDiagnostics } from '../types';
import { localEngineService, DEFAULT_ENGINE_HOST } from './localEngine';

export const DEFAULT_PYTHON_ENGINE_URL = DEFAULT_ENGINE_HOST;

/**
 * Pings the local Python backend engine using localEngineService.
 * Returns honest status based on real HTTP response from Stage 3 backend.
 */
export async function checkPythonEngineHealth(baseUrl: string = DEFAULT_PYTHON_ENGINE_URL): Promise<EngineHealth> {
  // If hosted online (e.g. on Vercel, Netlify, custom domain), use browser engine directly
  if (
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    return {
      connected: false,
      state: 'engine-not-running',
      statusText: 'In-Browser Engine Active',
      device: 'Client Web Audio API',
      lastChecked: Date.now(),
      errorMessage: 'High-speed browser audio processing active. Audio stays 100% on your device.',
    };
  }

  localEngineService.setBaseUrl(baseUrl);
  const statusInfo = await localEngineService.checkEngine(2500);

  if (statusInfo.state === 'connected' && statusInfo.health) {
    const health = statusInfo.health;
    const caps = statusInfo.capabilities;

    return {
      connected: true,
      state: 'connected',
      statusText: 'Engine Connected',
      version: health.version,
      pythonVersion: health.python_version,
      pytorchVersion: health.pytorch_version,
      demucsVersion: health.demucs_version,
      device: health.device,
      cudaAvailable: health.cuda_available,
      cpuThreads: health.cpu_threads,
      systemMemoryGb: health.system_memory_gb,
      availableModels: caps?.available_models || ['htdemucs'],
      defaultModel: caps?.default_model || 'htdemucs',
      supportedFormats: caps?.supported_formats || ['.wav', '.mp3', '.flac', '.ogg', '.m4a'],
      modelCached: caps?.model_cached,
      maxUploadSizeMb: caps?.max_upload_size_mb || 150,
      latencyMs: statusInfo.latencyMs,
      lastChecked: statusInfo.lastChecked,
    };
  }

  return {
    connected: false,
    state: statusInfo.state,
    statusText: statusInfo.statusText,
    latencyMs: statusInfo.latencyMs,
    lastChecked: statusInfo.lastChecked,
    errorMessage: statusInfo.errorMessage || 'Local AI engine offline. Start via start.bat.',
  };
}

/**
 * Collects runtime system specifications and browser capabilities.
 */
export function getSystemDiagnostics(): SystemDiagnostics {
  const userAgent = navigator.userAgent;
  let browser = 'Unknown Browser';

  if (userAgent.indexOf('Edg') > -1) {
    browser = 'Microsoft Edge';
  } else if (userAgent.indexOf('Chrome') > -1) {
    browser = 'Google Chrome';
  } else if (userAgent.indexOf('Firefox') > -1) {
    browser = 'Mozilla Firefox';
  } else if (userAgent.indexOf('Safari') > -1) {
    browser = 'Apple Safari';
  }

  // Detect Chromium deviceMemory API if supported
  const nav = navigator as unknown as { deviceMemory?: number };
  const deviceMemoryGB = nav.deviceMemory;

  const webAudioSupported = typeof window !== 'undefined' && ('AudioContext' in window || 'webkitAudioContext' in window);
  const indexedDbSupported = typeof window !== 'undefined' && 'indexedDB' in window;

  return {
    browser,
    webAudioSupported,
    indexedDbSupported,
    hardwareConcurrency: navigator.hardwareConcurrency || 4,
    deviceMemoryGB,
    isOnline: navigator.onLine,
  };
}
