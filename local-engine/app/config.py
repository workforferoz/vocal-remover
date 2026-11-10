import os
import secrets
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "Vocal Studio AI Local Engine"
    VERSION: str = "1.0.0"
    HOST: str = "127.0.0.1"  # Security: strictly loopback only
    PORT: int = 8524
    
    # Storage Paths
    BASE_DIR: Path = BASE_DIR
    MODELS_DIR: Path = BASE_DIR / "models"
    TEMP_DIR: Path = BASE_DIR / "temp"
    OUTPUTS_DIR: Path = BASE_DIR / "outputs"
    
    # Processing Limits
    MAX_UPLOAD_SIZE_BYTES: int = 150 * 1024 * 1024  # 150 MB
    MAX_CONCURRENT_JOBS: int = 1  # 1 at a time for low-spec RAM safety
    DEFAULT_MODEL: str = "htdemucs"
    DEFAULT_SHIFTS: int = 1  # 1 shift for CPU efficiency
    DEFAULT_OVERLAP: float = 0.25
    
    # Security
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    API_TOKEN: str = os.getenv("STUDIO_API_TOKEN", "")


settings = Settings()

# Ensure directories exist
settings.MODELS_DIR.mkdir(parents=True, exist_ok=True)
settings.TEMP_DIR.mkdir(parents=True, exist_ok=True)
settings.OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
