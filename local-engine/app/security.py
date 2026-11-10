import re
import os
from pathlib import Path
from fastapi import HTTPException, status, Request
from .config import settings

def sanitize_filename(filename: str) -> str:
    """
    Sanitizes an uploaded filename to prevent directory traversal, control characters,
    and null-byte injections.
    """
    if not filename:
        return "unnamed_audio"
    
    # Take basename only
    base = os.path.basename(filename)
    
    # Remove any non-alphanumeric character except for dots, underscores, dashes
    sanitized = re.sub(r'[^a-zA-Z0-9_.-]', '_', base)
    
    # Remove leading dots or dashes
    sanitized = re.sub(r'^[.-]+', '', sanitized)
    
    if not sanitized:
        sanitized = "audio_input"
        
    return sanitized[:120]  # Reasonable length limit

def validate_safe_path(base_dir: Path, target_path: Path) -> Path:
    """
    Guarantees that target_path is strictly a subpath of base_dir,
    preventing path traversal attacks.
    """
    resolved_base = base_dir.resolve()
    resolved_target = target_path.resolve()
    
    if not str(resolved_target).startswith(str(resolved_base)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Path traversal detected."
        )
    return resolved_target

def verify_localhost_origin(request: Request) -> None:
    """
    Verifies that the request comes from localhost/loopback to protect against
    DNS rebinding attacks.
    """
    client_host = request.client.host if request.client else ""
    if client_host not in ("127.0.0.1", "::1", "localhost", "testclient"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Engine strictly listens on local loopback interface."
        )

