# Vocal Studio AI — Local AI Audio Separation Engine (Stage 3)

This is the genuine local AI music source-separation engine for **Vocal Studio AI**, powered by PyTorch, FastAPI, and Meta's Demucs (`htdemucs`) model.

All audio separation takes place 100% locally on your machine. No audio is ever transmitted to external servers, cloud APIs, or third-party services.

---

## 1. System Requirements & Hardware Compatibility

| Component | Minimum (CPU Baseline) | Recommended (GPU Acceleration) |
| :--- | :--- | :--- |
| **Operating System** | Windows 10 / 11 (64-bit) | Windows 10 / 11 (64-bit) |
| **Python** | Python 3.11 (64-bit) | Python 3.11 (64-bit) |
| **Processor** | Intel Core i3 / AMD Ryzen 3 (4+ cores) | Intel Core i7 / AMD Ryzen 7 |
| **RAM** | 8 GB System RAM (4 GB min with swap) | 16 GB System RAM |
| **Storage** | 3 GB free disk space (model weights & cache) | 5 GB SSD free disk space |
| **GPU** | Not required (CPU mode fully supported) | NVIDIA GPU with 4+ GB VRAM & CUDA 11.8+ / 12.1+ |

> [!NOTE]
> On CPU, Demucs processes audio via multi-threaded PyTorch kernels (`torch.set_num_threads`). Processing a typical 3-minute song on a modern quad-core CPU takes approximately 1.5 to 4 minutes depending on CPU clock speeds. On a CUDA-compatible GPU, this is accelerated to 15–30 seconds.

---

## 2. Quick Start Scripts

Batch scripts are provided for seamless setup and operation on Windows:

### A. Installation (`install.bat`)
Installs Python dependencies inside an isolated virtual environment (`.venv`):
```cmd
install.bat
```
This script:
1. Verifies that Python 3.11 is available.
2. Creates `.venv` in the `local-engine` folder if not already present.
3. Upgrades `pip`, `setuptools`, and `wheel`.
4. Installs PyTorch, TorchAudio, Demucs, FastAPI, Uvicorn, and SoundFile.
5. Verifies local PyTorch device detection (CPU / CUDA).

### B. Starting the Engine (`start.bat`)
Starts the local HTTP loopback server on `http://127.0.0.1:8524`:
```cmd
start.bat
```
- Listens strictly on `127.0.0.1` (loopback only) to prevent external network access.
- Restricts CORS to the local Vocal Studio AI web client (`http://localhost:5173`, `http://127.0.0.1:5173`).
- Automatic worker concurrency limit (1 concurrent separation job at a time to prevent RAM exhaustion on low-end PCs).

### C. Stopping the Engine (`stop.bat`)
Gracefully stops any running Uvicorn server processes on port 8524:
```cmd
stop.bat
```

---

## 3. REST API Reference

The engine exposes a clean, typed REST API documented via OpenAPI at `http://127.0.0.1:8524/docs`.

### 1. Health Check
- **Endpoint**: `GET /health`
- **Description**: Returns engine operational status, Python & PyTorch versions, active compute device (`cpu` or `cuda`), and host memory statistics.
- **Response**:
```json
{
  "status": "online",
  "version": "1.0.0",
  "python_version": "3.11.9",
  "pytorch_version": "2.15.0+cpu",
  "demucs_available": true,
  "device": "cpu",
  "cuda_available": false,
  "cuda_device_name": null,
  "cpu_threads": 4,
  "system_memory": {
    "total_gb": 15.9,
    "available_gb": 6.8,
    "percent_used": 57.2
  }
}
```

### 2. Engine Capabilities
- **Endpoint**: `GET /capabilities`
- **Description**: Lists supported audio formats, maximum file size, available models (`htdemucs`), default stem targets, and current hardware capabilities.
- **Response**:
```json
{
  "supported_input_formats": [".wav", ".mp3", ".flac", ".ogg", ".m4a"],
  "max_upload_size_mb": 150,
  "available_models": ["htdemucs"],
  "default_model": "htdemucs",
  "available_stems": ["vocals", "drums", "bass", "other"],
  "hardware": {
    "device": "cpu",
    "cuda_available": false,
    "device_name": "Intel Core i5-7400 CPU @ 3.00GHz",
    "cpu_count": 4,
    "cpu_threads_configured": 4
  },
  "concurrency_limit": 1
}
```

### 3. Create Separation Job
- **Endpoint**: `POST /jobs`
- **Content-Type**: `multipart/form-data`
- **Parameters**:
  - `file`: Audio file (`.wav`, `.mp3`, `.flac`, `.ogg`, `.m4a`)
  - `model`: Model name (optional, default: `htdemucs`)
  - `stem`: Optional target stem (if isolating a single stem)
- **Response**:
```json
{
  "id": "c1f7b889-cbdf-4999-a616-d3c26b15801e",
  "filename": "song.mp3",
  "status": "queued",
  "model_name": "htdemucs",
  "progress_percent": 0.0,
  "message": "Job queued for processing",
  "created_at": "2026-11-10T15:30:00Z",
  "stems": []
}
```

### 4. Get Job Status & Progress
- **Endpoint**: `GET /jobs/{job_id}`
- **Description**: Returns live progress percentage (`0.0` to `100.0`), current status (`queued`, `processing`, `completed`, `failed`), and elapsed processing time.

### 5. Get Job Results
- **Endpoint**: `GET /jobs/{job_id}/results`
- **Description**: Returns URLs and metadata for all successfully generated stems (`vocals`, `drums`, `bass`, `other`).
- **Response**:
```json
{
  "job_id": "c1f7b889-cbdf-4999-a616-d3c26b15801e",
  "status": "completed",
  "original_filename": "song.mp3",
  "duration_seconds": 184.2,
  "sample_rate": 44100,
  "channels": 2,
  "processing_time_seconds": 92.4,
  "device_used": "cpu",
  "stems": [
    {
      "name": "vocals",
      "filename": "vocals.wav",
      "download_url": "/jobs/c1f7b889-cbdf-4999-a616-d3c26b15801e/stems/vocals",
      "size_bytes": 32490284,
      "channels": 2,
      "sample_rate": 44100
    },
    {
      "name": "drums",
      "filename": "drums.wav",
      "download_url": "/jobs/c1f7b889-cbdf-4999-a616-d3c26b15801e/stems/drums",
      "size_bytes": 32490284,
      "channels": 2,
      "sample_rate": 44100
    },
    {
      "name": "bass",
      "filename": "bass.wav",
      "download_url": "/jobs/c1f7b889-cbdf-4999-a616-d3c26b15801e/stems/bass",
      "size_bytes": 32490284,
      "channels": 2,
      "sample_rate": 44100
    },
    {
      "name": "other",
      "filename": "other.wav",
      "download_url": "/jobs/c1f7b889-cbdf-4999-a616-d3c26b15801e/stems/other",
      "size_bytes": 32490284,
      "channels": 2,
      "sample_rate": 44100
    }
  ]
}
```

### 6. Download Stem
- **Endpoint**: `GET /jobs/{job_id}/stems/{stem_name}`
- **Description**: Streams the generated 16-bit or 32-bit PCM WAV stem with proper `Content-Disposition` and `audio/wav` headers. Includes strict path sanitization to guard against path traversal attacks.

### 7. Cancel / Delete Job
- **Endpoint**: `DELETE /jobs/{job_id}`
- **Description**: Cancels any pending or queued job and safely cleans up temporary inputs and generated output files from disk.

---

## 4. Architecture & Security Safeguards

1. **Loopback Only**: Server binds to `127.0.0.1` by default, never `0.0.0.0`. It cannot be reached across local LAN or the internet.
2. **CORS Whitelist**: Access is strictly limited to localhost origin ports (`http://localhost:5173`, `http://127.0.0.1:5173`).
3. **Path Traversal Protection**: Uploaded filenames are sanitized (`security.sanitize_filename`), removing `..`, `/`, `\`, and invalid Windows characters. Stems can only be read from within the job's verified output subdirectory.
4. **RAM & CPU Safeguards**:
   - `MAX_CONCURRENT_JOBS = 1`: Uses an asynchronous semaphore to serialize separation requests, avoiding out-of-memory crashes on systems with 4–8 GB of RAM.
   - Garbage collection (`gc.collect()`) and CUDA cache clearing (`torch.cuda.empty_cache()`) are invoked immediately upon job completion or failure.
   - PyTorch threads are clamped (`torch.set_num_threads`) to preserve responsive system performance for other OS tasks.

---

## 5. Model Licensing & Acknowledgments

- **Model Architecture**: Hybrid Transformer Demucs (`htdemucs`).
- **Original Author**: Alexandre Défossez, Nicolas Usunier, Gabriel Synnaeve, Yossi Adi (Meta AI Research).
- **Paper**: [Hybrid Spectrogram and Waveform Source Separation](https://arxiv.org/abs/2111.03600).
- **License**: Demucs is released under the **MIT License**. The pretrained weights for `htdemucs` are distributed under the MIT License for research and commercial use.

---

## 6. Troubleshooting

- **"Address already in use" error**: Run `stop.bat` to terminate any previous orphaned Uvicorn instance, or check if port 8524 is used by another service (`netstat -ano | findstr :8524`).
- **Long separation times**: On CPU, processing time scales with the length of the audio track and CPU core count. To improve speed, close background applications during separation or ensure high-performance power plan is enabled in Windows.

