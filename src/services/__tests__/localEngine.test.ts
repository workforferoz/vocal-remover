import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { localEngineService, DEFAULT_ENGINE_HOST } from '../localEngine';

describe('LocalEngineService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localEngineService.setBaseUrl(DEFAULT_ENGINE_HOST);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default loopback URL', () => {
    expect(localEngineService.getBaseUrl()).toBe('http://127.0.0.1:8524');
  });

  it('updates base URL cleanly without trailing slashes', () => {
    localEngineService.setBaseUrl('http://127.0.0.1:8524///');
    expect(localEngineService.getBaseUrl()).toBe('http://127.0.0.1:8524');
  });

  it('detects engine running and parses health + capabilities', async () => {
    const mockHealth = {
      status: 'ok',
      version: '1.0.0',
      python_version: '3.11.9',
      pytorch_version: '2.15.0+cpu',
      demucs_version: '4.1.0',
      device: 'CPU Multithread',
      cuda_available: false,
      cpu_threads: 4,
      system_memory_gb: 16.0,
    };

    const mockCapabilities = {
      supported_formats: ['.flac', '.m4a', '.mp3', '.ogg', '.wav'],
      available_models: ['htdemucs'],
      default_model: 'htdemucs',
      available_stems: ['vocals', 'drums', 'bass', 'other'],
      device: 'CPU Multithread',
      cuda_available: false,
      model_cached: true,
      max_upload_size_mb: 150,
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = url.toString();
      if (urlStr.endsWith('/health')) {
        return {
          ok: true,
          status: 200,
          json: async () => mockHealth,
        } as Response;
      }
      if (urlStr.endsWith('/capabilities')) {
        return {
          ok: true,
          status: 200,
          json: async () => mockCapabilities,
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    const status = await localEngineService.checkEngine();
    expect(status.state).toBe('connected');
    expect(status.statusText).toBe('Engine Connected');
    expect(status.health?.demucs_version).toBe('4.1.0');
    expect(status.capabilities?.available_stems).toEqual(['vocals', 'drums', 'bass', 'other']);
  });

  it('handles offline engine gracefully without throwing unhandled exceptions', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    const status = await localEngineService.checkEngine();
    expect(status.state).toBe('engine-not-running');
    expect(status.statusText).toBe('Engine Not Running');
    expect(status.health).toBeNull();
  });

  it('handles engine returning HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    } as Response);

    const status = await localEngineService.checkEngine();
    expect(status.state).toBe('connection-error');
    expect(status.statusText).toContain('503');
  });

  it('formats stem URLs properly with clean lowercased stem names', () => {
    const url = localEngineService.getStemUrl('test-uuid-1234', 'Vocals.wav');
    expect(url).toBe('http://127.0.0.1:8524/jobs/test-uuid-1234/stems/vocals');
  });

  it('gets job status correctly', async () => {
    const mockStatus = {
      job_id: 'job-1',
      status: 'processing',
      stage: 'Running Demucs neural inference',
      progress: 45,
      created_at: '2026-11-10T12:00:00Z',
      started_at: '2026-11-10T12:00:01Z',
      completed_at: null,
      duration_seconds: null,
      error: null,
      model_used: 'htdemucs',
      stems: {},
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockStatus,
    } as Response);

    const res = await localEngineService.getJobStatus('job-1');
    expect(res.job_id).toBe('job-1');
    expect(res.progress).toBe(45);
    expect(res.stage).toBe('Running Demucs neural inference');
  });

  it('cancels job successfully', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ job_id: 'job-1', deleted: true, message: 'Job deleted' }),
    } as Response);

    const res = await localEngineService.cancelJob('job-1');
    expect(res.deleted).toBe(true);
  });

  it('fetches model list from engine', async () => {
    const mockModels = [
      {
        name: 'htdemucs',
        label: 'Demucs v4',
        description: 'Default model',
        status: 'installed',
        size_mb: 80.1,
        estimated_size_mb: 80.0,
        storage_path: 'local-engine/models/htdemucs',
        sources: ['vocals', 'drums', 'bass', 'other'],
        device_support: 'CPU Multithread & NVIDIA CUDA GPU',
        is_default: true,
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockModels,
    } as Response);

    const res = await localEngineService.getModels();
    expect(res).toHaveLength(1);
    expect(res[0].name).toBe('htdemucs');
    expect(res[0].status).toBe('installed');
  });

  it('triggers model download', async () => {
    const mockDownload = {
      name: 'htdemucs_ft',
      status: 'downloading',
      progress: 0,
      message: 'Download initiated',
      error: null,
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockDownload,
    } as Response);

    const res = await localEngineService.downloadModel('htdemucs_ft');
    expect(res.name).toBe('htdemucs_ft');
    expect(res.status).toBe('downloading');
  });

  it('gets model download status', async () => {
    const mockStatus = {
      name: 'htdemucs_ft',
      status: 'installed',
      progress: 100,
      message: 'Installed',
      error: null,
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockStatus,
    } as Response);

    const res = await localEngineService.getModelDownloadStatus('htdemucs_ft');
    expect(res.status).toBe('installed');
    expect(res.progress).toBe(100);
  });
});

