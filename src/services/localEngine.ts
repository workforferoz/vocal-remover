/**
 * Vocal Studio AI - Local AI Engine Client Service (Stage 4)
 * Communicates strictly via loopback HTTP with the local Python Demucs backend.
 */

export const DEFAULT_ENGINE_HOST =
  typeof window !== 'undefined' && window.location.port !== '5173' && window.location.origin.startsWith('http')
    ? window.location.origin
    : 'http://127.0.0.1:8524';

export type EngineConnectionState =
  | 'connected'
  | 'engine-not-running'
  | 'connecting'
  | 'model-not-installed'
  | 'model-unavailable'
  | 'processing-unavailable'
  | 'connection-error';

export interface BackendHealthResponse {
  status: string;
  version: string;
  python_version: string;
  pytorch_version: string;
  demucs_version: string;
  device: string;
  cuda_available: boolean;
  cpu_threads: number;
  system_memory_gb: number | null;
}

export interface BackendCapabilitiesResponse {
  supported_formats: string[];
  available_models: string[];
  default_model: string;
  available_stems: string[];
  device: string;
  cuda_available: boolean;
  model_cached: boolean;
  max_upload_size_mb: number;
}

export interface BackendStemResult {
  name: string;
  filename: string;
  file_size_bytes: number;
  download_url: string;
}

export interface BackendJobCreateResponse {
  job_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  filename: string;
  model: string;
  message: string;
  created_at: string;
}

export interface BackendJobStatusResponse {
  job_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  stage: string;
  progress: number; // 0 to 100
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  error: string | null;
  model_used: string | null;
  stems: Record<string, BackendStemResult>;
}

export interface BackendJobResultsResponse {
  job_id: string;
  status: 'completed';
  duration_seconds: number | null;
  model: string;
  stems: Record<string, BackendStemResult>;
}

export type BackendModelStatus =
  | 'installed'
  | 'downloading'
  | 'not_installed'
  | 'error'
  | 'verification_failed';

export interface BackendModelInfo {
  name: string;
  label: string;
  description: string;
  status: BackendModelStatus;
  size_mb: number | null;
  estimated_size_mb: number;
  storage_path: string | null;
  sources: string[];
  device_support: string;
  is_default: boolean;
  error?: string | null;
}

export interface BackendModelDownloadStatus {
  name: string;
  status: BackendModelStatus;
  progress: number;
  message: string;
  error?: string | null;
}

export interface EngineStatusInfo {
  state: EngineConnectionState;
  statusText: string;
  health: BackendHealthResponse | null;
  capabilities: BackendCapabilitiesResponse | null;
  latencyMs?: number;
  errorMessage?: string;
  lastChecked: number;
}

class LocalEngineService {
  private baseUrl: string = DEFAULT_ENGINE_HOST;

  public setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Checks the health and capabilities of the local Python engine.
   * Dispatches a quick abort signal to fail fast if the engine is stopped.
   */
  public async checkEngine(timeoutMs = 3000): Promise<EngineStatusInfo> {
    const startTime = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // 1. Health probe
      const healthRes = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (!healthRes.ok) {
        clearTimeout(timeoutId);
        return {
          state: 'connection-error',
          statusText: `Engine HTTP Error ${healthRes.status}`,
          health: null,
          capabilities: null,
          errorMessage: `Engine responded with status ${healthRes.status}: ${healthRes.statusText}`,
          lastChecked: Date.now(),
        };
      }

      const health: BackendHealthResponse = await healthRes.json();

      // 2. Capabilities probe
      let capabilities: BackendCapabilitiesResponse | null = null;
      try {
        const capRes = await fetch(`${this.baseUrl}/capabilities`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        if (capRes.ok) {
          capabilities = await capRes.json();
        }
      } catch {
        // Fall back gracefully if capabilities route is temporarily slow
      }

      clearTimeout(timeoutId);
      const latencyMs = Math.round(performance.now() - startTime);

      // Analyze state
      if (!health.demucs_version) {
        return {
          state: 'model-not-installed',
          statusText: 'Demucs Not Installed',
          health,
          capabilities,
          latencyMs,
          errorMessage: 'Demucs library is missing in local environment. Run install.bat.',
          lastChecked: Date.now(),
        };
      }

      return {
        state: 'connected',
        statusText: 'Engine Connected',
        health,
        capabilities,
        latencyMs,
        lastChecked: Date.now(),
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      const isFailedFetch = err instanceof TypeError && err.message.toLowerCase().includes('fetch');

      return {
        state: 'engine-not-running',
        statusText: 'Engine Not Running',
        health: null,
        capabilities: null,
        errorMessage: isAbort
          ? 'Connection timed out. The local Python engine is not responding.'
          : isFailedFetch
          ? 'Could not connect to local engine on 127.0.0.1:8524. Start it using start.bat.'
          : (err as Error).message || 'Local AI engine is offline.',
        lastChecked: Date.now(),
      };
    }
  }

  /**
   * Uploads an audio file and initiates Demucs AI separation on the local backend.
   */
  public async createSeparationJob(
    file: File,
    model: string = 'htdemucs',
    onUploadProgress?: (percent: number) => void
  ): Promise<BackendJobCreateResponse> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('model', model);

    // Using XMLHttpRequest to provide true upload progress when requested
    if (onUploadProgress) {
      return new Promise<BackendJobCreateResponse>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${this.baseUrl}/jobs`);
        xhr.setRequestHeader('Accept', 'application/json');

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onUploadProgress(percent);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const res = JSON.parse(xhr.responseText);
              resolve(res as BackendJobCreateResponse);
            } catch {
              reject(new Error('Invalid JSON response from local engine.'));
            }
          } else {
            let errorDetail = `Upload failed with HTTP ${xhr.status}`;
            try {
              const errorObj = JSON.parse(xhr.responseText);
              if (errorObj.detail) errorDetail = errorObj.detail;
            } catch {
              // use default
            }
            reject(new Error(errorDetail));
          }
        };

        xhr.onerror = () => {
          reject(new Error('Network error while connecting to local Python engine.'));
        };

        xhr.send(formData);
      });
    }

    // Default Fetch implementation
    const response = await fetch(`${this.baseUrl}/jobs`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: formData,
    });

    if (!response.ok) {
      let detail = `Failed to create job (${response.statusText})`;
      try {
        const errJson = await response.json();
        if (errJson.detail) detail = errJson.detail;
      } catch {
        // use statusText
      }
      throw new Error(detail);
    }

    return response.json();
  }

  /**
   * Retrieves real-time status, execution stage, and progress of a separation job.
   */
  public async getJobStatus(jobId: string): Promise<BackendJobStatusResponse> {
    const response = await fetch(`${this.baseUrl}/jobs/${encodeURIComponent(jobId)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Job '${jobId}' was not found on local engine.`);
      }
      throw new Error(`Failed to check job status (HTTP ${response.status})`);
    }

    return response.json();
  }

  /**
   * Retrieves final separated stem metadata once a job completes.
   */
  public async getJobResults(jobId: string): Promise<BackendJobResultsResponse> {
    const response = await fetch(`${this.baseUrl}/jobs/${encodeURIComponent(jobId)}/results`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      let detail = `Failed to retrieve job results (${response.statusText})`;
      try {
        const errJson = await response.json();
        if (errJson.detail) detail = errJson.detail;
      } catch {
        // use statusText
      }
      throw new Error(detail);
    }

    return response.json();
  }

  /**
   * Formats the direct stem download URL on the local loopback backend.
   */
  public getStemUrl(jobId: string, stemName: string): string {
    const stemClean = stemName.toLowerCase().replace('.wav', '').trim();
    return `${this.baseUrl}/jobs/${encodeURIComponent(jobId)}/stems/${encodeURIComponent(stemClean)}`;
  }

  /**
   * Fetches an individual audio stem as a Blob for playback or offline caching.
   */
  public async fetchStemBlob(jobId: string, stemName: string): Promise<Blob> {
    const url = this.getStemUrl(jobId, stemName);
    const response = await fetch(url, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Failed to load stem '${stemName}' (HTTP ${response.status})`);
    }

    return response.blob();
  }

  /**
   * Cancels a job and requests safe deletion of its temporary and output files.
   */
  public async cancelJob(jobId: string): Promise<{ job_id: string; deleted: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/jobs/${encodeURIComponent(jobId)}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Failed to cancel job ${jobId} (HTTP ${response.status})`);
    }

    return response.json();
  }

  /**
   * Fetches real model availability, download status, and disk sizes from Python engine.
   */
  public async getModels(): Promise<BackendModelInfo[]> {
    const res = await fetch(`${this.baseUrl}/models`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch models list (HTTP ${res.status})`);
    }
    return res.json();
  }

  /**
   * Initiates download and verification of a supported Demucs model in the background.
   */
  public async downloadModel(modelName: string): Promise<BackendModelDownloadStatus> {
    const res = await fetch(`${this.baseUrl}/models/${encodeURIComponent(modelName)}/download`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Failed to initiate download for model ${modelName} (HTTP ${res.status})`);
    }
    return res.json();
  }

  /**
   * Probes active download progress and verification status for a model.
   */
  public async getModelDownloadStatus(modelName: string): Promise<BackendModelDownloadStatus> {
    const res = await fetch(`${this.baseUrl}/models/${encodeURIComponent(modelName)}/status`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Failed to check model download status (HTTP ${res.status})`);
    }
    return res.json();
  }
}

export const localEngineService = new LocalEngineService();
