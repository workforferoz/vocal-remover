from typing import Optional, Literal
from pydantic import BaseModel, Field

JobStatusType = Literal["queued", "processing", "completed", "failed", "cancelled"]

class HealthResponse(BaseModel):
    status: str = "ok"
    version: str
    python_version: str
    pytorch_version: str
    demucs_version: str
    device: str
    cuda_available: bool
    cpu_threads: int
    system_memory_gb: Optional[float] = None

class CapabilitiesResponse(BaseModel):
    supported_formats: list[str]
    available_models: list[str]
    default_model: str
    available_stems: list[str]
    device: str
    cuda_available: bool
    model_cached: bool
    max_upload_size_mb: int

class StemResult(BaseModel):
    name: str
    filename: str
    file_size_bytes: int
    download_url: str

class JobCreateResponse(BaseModel):
    job_id: str
    status: JobStatusType
    filename: str
    model: str
    message: str
    created_at: str

class JobStatusResponse(BaseModel):
    job_id: str
    status: JobStatusType
    stage: str
    progress: int = Field(ge=0, le=100)
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    duration_seconds: Optional[float] = None
    error: Optional[str] = None
    model_used: Optional[str] = None
    stems: dict[str, StemResult] = Field(default_factory=dict)

ModelInstallStatus = Literal["installed", "downloading", "not_installed", "error", "verification_failed"]

class ModelInfoResponse(BaseModel):
    name: str
    label: str
    description: str
    status: ModelInstallStatus
    size_mb: Optional[float] = None
    estimated_size_mb: float
    storage_path: Optional[str] = None
    sources: list[str]
    device_support: str
    is_default: bool
    error: Optional[str] = None

class ModelDownloadStatusResponse(BaseModel):
    name: str
    status: ModelInstallStatus
    progress: int = 0
    message: str
    error: Optional[str] = None

class JobResultsResponse(BaseModel):
    job_id: str
    status: JobStatusType
    duration_seconds: Optional[float] = None
    model: str
    stems: dict[str, StemResult]

