import os
import sys
import psutil
import shutil
import logging
from typing import Optional
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status, Depends, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import torch
import demucs

from .config import settings
from .schemas import (
    HealthResponse,
    CapabilitiesResponse,
    JobCreateResponse,
    JobStatusResponse,
    JobResultsResponse,
    ModelInfoResponse,
    ModelDownloadStatusResponse,
)
from .security import sanitize_filename, validate_safe_path, verify_localhost_origin
from .separation import engine
from .job_manager import job_manager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("vocal_studio.main")

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="Genuine Local AI Audio Source-Separation Engine powered by Demucs",
)

# CORS restricted to local frontend origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

SUPPORTED_EXTENSIONS = {".wav", ".mp3", ".flac", ".m4a", ".aac", ".ogg"}

@app.middleware("http")
async def security_host_middleware(request: Request, call_next):
    """Restricts access to loopback host for safety against DNS rebinding."""
    host_header = request.headers.get("host", "")
    if host_header:
        host_name = host_header.split(":")[0]
        if host_name not in ("127.0.0.1", "localhost", "testserver"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Host header must be localhost / 127.0.0.1"
            )
    return await call_next(request)

@app.get("/health", response_model=HealthResponse)
def get_health():
    """
    Returns engine status, hardware specs, PyTorch & Demucs versions, and compute target.
    """
    total_ram_gb = None
    try:
        mem = psutil.virtual_memory()
        total_ram_gb = round(mem.total / (1024 ** 3), 1)
    except Exception:
        pass

    return HealthResponse(
        status="ok",
        version=settings.VERSION,
        python_version=sys.version.split()[0],
        pytorch_version=torch.__version__,
        demucs_version=demucs.__version__,
        device=engine.device_name,
        cuda_available=engine.is_cuda,
        cpu_threads=os.cpu_count() or 4,
        system_memory_gb=total_ram_gb
    )

@app.get("/capabilities", response_model=CapabilitiesResponse)
def get_capabilities():
    """
    Returns supported audio formats, available models, stems, and device capabilities.
    """
    # Check if default model is already downloaded/cached
    model_cached = False
    try:
        # Check cache directory or test loading from cache
        cache_path = Path.home() / ".cache" / "huggingface" / "hub"
        model_cached = any(cache_path.glob("models--*demucs*")) if cache_path.exists() else False
    except Exception:
        pass

    return CapabilitiesResponse(
        supported_formats=sorted(list(SUPPORTED_EXTENSIONS)),
        available_models=["htdemucs", "htdemucs_ft"],
        default_model=settings.DEFAULT_MODEL,
        available_stems=["instrumental", "vocals", "drums", "bass", "other"],
        device=engine.device_name,
        cuda_available=engine.is_cuda,
        model_cached=model_cached,
        max_upload_size_mb=settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)
    )

# Model download state tracking
_model_download_states: dict[str, dict] = {}

def _get_model_cache_info(model_name: str) -> tuple[bool, Optional[float], Optional[str]]:
    """Checks HuggingFace hub cache directory for model files and computes size."""
    cache_path = Path.home() / ".cache" / "huggingface" / "hub"
    if not cache_path.exists():
        return False, None, None

    patterns = [
        f"models--*--*{model_name}*",
        f"models--*--*{model_name.replace('_', '')}*",
    ]
    for pattern in patterns:
        for p in cache_path.glob(pattern):
            if p.is_dir():
                total_bytes = sum(f.stat().st_size for f in p.glob("**/*") if f.is_file())
                size_mb = round(total_bytes / (1024 * 1024), 1)
                return True, size_mb, str(p)
    return False, None, None

def _download_and_verify_model_worker(model_name: str):
    logger.info(f"Starting download and verification for model '{model_name}'...")
    _model_download_states[model_name] = {
        "status": "downloading",
        "progress": 20,
        "message": "Downloading model weights from HuggingFace Hub...",
        "error": None
    }
    try:
        from demucs.pretrained import get_model
        _model_download_states[model_name]["progress"] = 60
        model = get_model(model_name)
        _model_download_states[model_name]["progress"] = 90
        _model_download_states[model_name]["message"] = "Verifying neural network architecture..."
        if not hasattr(model, "sources") or len(model.sources) < 4:
            raise ValueError(f"Model verification failed: Expected 4 stems, found {getattr(model, 'sources', None)}")
        _model_download_states[model_name] = {
            "status": "installed",
            "progress": 100,
            "message": f"Model '{model_name}' verified and ready for local offline inference.",
            "error": None
        }
        logger.info(f"Model '{model_name}' successfully downloaded and verified.")
    except Exception as e:
        logger.error(f"Failed to download/verify model '{model_name}': {e}")
        _model_download_states[model_name] = {
            "status": "error",
            "progress": 0,
            "message": "Download or verification failed.",
            "error": str(e)
        }

@app.get("/models", response_model=list[ModelInfoResponse])
def list_models():
    """
    Returns real installation, size, and compatibility status of supported Demucs models.
    """
    catalog = [
        {
            "name": "htdemucs",
            "label": "Demucs v4 (Hybrid Transformer)",
            "description": "Default state-of-the-art 4-stem model (vocals, drums, bass, other). High fidelity, optimized for CPU and GPU inference.",
            "estimated_size_mb": 80.0,
            "sources": ["vocals", "drums", "bass", "other"],
            "device_support": "CPU Multithread & NVIDIA CUDA GPU",
            "is_default": True,
        },
        {
            "name": "htdemucs_ft",
            "label": "Demucs v4 Fine-Tuned",
            "description": "Fine-tuned transformer ensemble providing increased stem separation accuracy. Requires ~160 MB disk space.",
            "estimated_size_mb": 160.0,
            "sources": ["vocals", "drums", "bass", "other"],
            "device_support": "CPU Multithread & NVIDIA CUDA GPU",
            "is_default": False,
        },
    ]

    results = []
    for item in catalog:
        m_name = item["name"]
        cached, size_mb, path = _get_model_cache_info(m_name)

        current_state = _model_download_states.get(m_name, {})
        status_val = current_state.get("status")
        if not status_val:
            status_val = "installed" if cached else "not_installed"

        results.append(
            ModelInfoResponse(
                name=m_name,
                label=item["label"],
                description=item["description"],
                status=status_val,
                size_mb=size_mb,
                estimated_size_mb=item["estimated_size_mb"],
                storage_path=path,
                sources=item["sources"],
                device_support=item["device_support"],
                is_default=item["is_default"],
                error=current_state.get("error")
            )
        )
    return results

@app.post("/models/{model_name}/download", response_model=ModelDownloadStatusResponse)
async def download_model(model_name: str, background_tasks: BackgroundTasks):
    """
    Triggers asynchronous download and offline verification of a supported Demucs model.
    """
    if model_name not in ("htdemucs", "htdemucs_ft"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown model '{model_name}'.")

    cached, _, _ = _get_model_cache_info(model_name)
    if cached:
        return ModelDownloadStatusResponse(
            name=model_name,
            status="installed",
            progress=100,
            message=f"Model '{model_name}' is already installed and verified on this system."
        )

    current_state = _model_download_states.get(model_name, {})
    if current_state.get("status") == "downloading":
        return ModelDownloadStatusResponse(
            name=model_name,
            status="downloading",
            progress=current_state.get("progress", 20),
            message=current_state.get("message", "Download in progress...")
        )

    background_tasks.add_task(_download_and_verify_model_worker, model_name)

    return ModelDownloadStatusResponse(
        name=model_name,
        status="downloading",
        progress=10,
        message=f"Download initiated for '{model_name}'."
    )

@app.get("/models/{model_name}/status", response_model=ModelDownloadStatusResponse)
def get_model_download_status(model_name: str):
    """
    Returns live progress and verification state of a model download task.
    """
    cached, _, _ = _get_model_cache_info(model_name)
    current_state = _model_download_states.get(model_name)

    if current_state:
        return ModelDownloadStatusResponse(
            name=model_name,
            status=current_state.get("status", "not_installed"),
            progress=current_state.get("progress", 0),
            message=current_state.get("message", ""),
            error=current_state.get("error")
        )

    if cached:
        return ModelDownloadStatusResponse(
            name=model_name,
            status="installed",
            progress=100,
            message="Model installed and verified."
        )

    return ModelDownloadStatusResponse(
        name=model_name,
        status="not_installed",
        progress=0,
        message="Model is not yet downloaded."
    )

@app.post("/jobs", response_model=JobCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_separation_job(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    model: str = Form(default=settings.DEFAULT_MODEL),
):
    """
    Accepts an audio file upload, validates format and size, stages it securely,
    and initiates Demucs separation in a background worker.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No filename provided in upload payload."
        )

    ext = Path(file.filename).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported audio format '{ext}'. Supported formats: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
        )

    # Sanitize file name
    safe_name = sanitize_filename(file.filename)

    # Validate model selection
    if model not in ("htdemucs", "htdemucs_ft"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported model '{model}'. Available models: htdemucs, htdemucs_ft"
        )

    # Create temporary job directory
    temp_job_dir = settings.TEMP_DIR / f"upload_{os.urandom(8).hex()}"
    temp_job_dir.mkdir(parents=True, exist_ok=True)
    temp_input_path = temp_job_dir / f"input{ext}"

    # Stream to disk with size limit enforcement
    total_size = 0
    with open(temp_input_path, "wb") as buffer:
        while chunk := await file.read(1024 * 1024):  # 1MB chunks
            total_size += len(chunk)
            if total_size > settings.MAX_UPLOAD_SIZE_BYTES:
                buffer.close()
                shutil.rmtree(temp_job_dir, ignore_errors=True)
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"File exceeds maximum size limit of {settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)} MB."
                )
            buffer.write(chunk)

    if total_size == 0:
        shutil.rmtree(temp_job_dir, ignore_errors=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes)."
        )

    # Register Job
    job = job_manager.create_job(safe_name, temp_input_path, model)

    # Schedule asynchronous execution
    background_tasks.add_task(job_manager.run_job, job.job_id)

    return JobCreateResponse(
        job_id=job.job_id,
        status=job.status,
        filename=safe_name,
        model=job.model,
        message="Job successfully created and queued for separation.",
        created_at=job.created_at
    )

@app.get("/jobs/{job_id}", response_model=JobStatusResponse)
def get_job_status(job_id: str):
    """
    Returns actual processing status, real execution stage, duration, and error if any.
    """
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found."
        )

    return JobStatusResponse(
        job_id=job.job_id,
        status=job.status,
        stage=job.stage,
        progress=job.progress,
        created_at=job.created_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
        duration_seconds=job.duration_seconds,
        error=job.error,
        model_used=job.model,
        stems=job.stems
    )

@app.get("/jobs/{job_id}/results", response_model=JobResultsResponse)
def get_job_results(job_id: str):
    """
    Returns all separated audio stems and their download URLs once processing is complete.
    """
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found.")

    if job.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Job is currently '{job.status}'. Results are only available when completed."
        )

    return JobResultsResponse(
        job_id=job.job_id,
        status=job.status,
        duration_seconds=job.duration_seconds,
        model=job.model,
        stems=job.stems
    )

@app.get("/jobs/{job_id}/stems/{stem_name}")
def download_stem(job_id: str, stem_name: str):
    """
    Streams an individual separated 16-bit PCM WAV stem with path-traversal prevention.
    """
    stem_clean = stem_name.lower().replace(".wav", "").strip()
    if stem_clean not in ("vocals", "drums", "bass", "other", "instrumental"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid stem '{stem_name}'. Must be one of: vocals, instrumental, drums, bass, other"
        )

    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found.")

    if job.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stems are not ready. Job has not completed."
        )

    stem_path = job.output_dir / f"{stem_clean}.wav"
    # Strict path traversal validation
    safe_path = validate_safe_path(settings.OUTPUTS_DIR, stem_path)

    if not safe_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stem file missing on disk.")

    original_base = Path(job.original_filename).stem
    download_filename = f"{original_base}_{stem_clean}.wav"

    return FileResponse(
        path=str(safe_path),
        media_type="audio/wav",
        filename=download_filename,
    )

@app.delete("/jobs/{job_id}")
def delete_or_cancel_job(job_id: str):
    """
    Cancels a queued or running job and cleans up temporary and output stem files.
    """
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found.")

    success = job_manager.delete_job(job_id)
    return {
        "job_id": job_id,
        "deleted": success,
        "message": f"Job {job_id} and associated files removed."
    }

# -------------------------------------------------------------
# Unified Production Serving: Serve Frontend Static Files
# -------------------------------------------------------------
frontend_dist = Path(__file__).resolve().parent.parent.parent / "dist"
if frontend_dist.exists() and (frontend_dist / "index.html").exists():
    from fastapi.staticfiles import StaticFiles

    if (frontend_dist / "assets").exists():
        app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str):
        target = frontend_dist / full_path
        if full_path and target.exists() and target.is_file():
            return FileResponse(str(target))
        return FileResponse(str(frontend_dist / "index.html"))


