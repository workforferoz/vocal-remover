import os
import io
import wave
import struct
import math
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings

client = TestClient(app)

def generate_test_wav_bytes(duration_sec: float = 1.5, sample_rate: int = 44100) -> bytes:
    """Generates a real, non-empty stereo PCM WAV audio stream with distinct frequencies."""
    num_samples = int(duration_sec * sample_rate)
    buffer = io.BytesIO()
    
    with wave.open(buffer, 'wb') as wav_file:
        wav_file.setnchannels(2)      # Stereo
        wav_file.setsampwidth(2)     # 16-bit
        wav_file.setframerate(sample_rate)
        
        frames = bytearray()
        for i in range(num_samples):
            t = float(i) / sample_rate
            # Left channel: 440 Hz tone (vocal-like midrange)
            s_left = int(32767.0 * 0.5 * math.sin(2.0 * math.pi * 440.0 * t))
            # Right channel: 110 Hz tone (bass-like low frequency)
            s_right = int(32767.0 * 0.5 * math.sin(2.0 * math.pi * 110.0 * t))
            frames.extend(struct.pack('<hh', s_left, s_right))
            
        wav_file.writeframes(frames)
        
    return buffer.getvalue()

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data
    assert "python_version" in data
    assert "pytorch_version" in data
    assert "demucs_version" in data
    assert "device" in data
    assert data["cpu_threads"] > 0

def test_capabilities_endpoint():
    response = client.get("/capabilities")
    assert response.status_code == 200
    data = response.json()
    assert ".wav" in data["supported_formats"]
    assert ".mp3" in data["supported_formats"]
    assert "htdemucs" in data["available_models"]
    assert set(data["available_stems"]) == {"instrumental", "vocals", "drums", "bass", "other"}
    assert data["max_upload_size_mb"] > 0

def test_reject_unsupported_file_extension():
    fake_payload = b"test malicious script"
    response = client.post(
        "/jobs",
        files={"file": ("malware.exe", fake_payload, "application/octet-stream")}
    )
    assert response.status_code == 400
    assert "Unsupported audio format" in response.json()["detail"]

def test_reject_empty_file():
    response = client.post(
        "/jobs",
        files={"file": ("empty.wav", b"", "audio/wav")}
    )
    assert response.status_code == 400
    assert "empty" in response.json()["detail"]

def test_reject_invalid_model():
    wav_bytes = generate_test_wav_bytes(0.5)
    response = client.post(
        "/jobs",
        files={"file": ("test.wav", wav_bytes, "audio/wav")},
        data={"model": "nonexistent_model_v99"}
    )
    assert response.status_code == 400
    assert "Unsupported model" in response.json()["detail"]

def test_path_traversal_prevention_on_stems():
    response = client.get("/jobs/job_123/stems/../../etc/passwd")
    # Will fail either with 400 (invalid stem name) or 403 (traversal defense)
    assert response.status_code in (400, 404, 403)

def test_job_not_found():
    response = client.get("/jobs/nonexistent_job_xyz")
    assert response.status_code == 404

def test_models_endpoint():
    response = client.get("/models")
    assert response.status_code == 200
    models = response.json()
    assert len(models) >= 2
    model_names = [m["name"] for m in models]
    assert "htdemucs" in model_names
    assert "htdemucs_ft" in model_names
    htdemucs = next(m for m in models if m["name"] == "htdemucs")
    assert htdemucs["status"] == "installed"
    assert htdemucs["size_mb"] is not None and htdemucs["size_mb"] > 0

def test_model_download_endpoint_cached():
    response = client.post("/models/htdemucs/download")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "htdemucs"
    assert data["status"] == "installed"
    assert data["progress"] == 100

def test_invalid_model_download():
    response = client.post("/models/invalid_unknown_model/download")
    assert response.status_code == 400

def test_genuine_demucs_source_separation():
    """
    GENUINE SEPARATION TEST:
    1. Upload real stereo audio
    2. Execute genuine Demucs AI inference
    3. Verify all 4 stems: vocals.wav, drums.wav, bass.wav, other.wav
    4. Check WAV header, non-empty file size, and duration
    5. Test stem downloading
    6. Verify cleanup
    """
    # Create 1.5 second test track with distinct stereo frequencies
    test_wav = generate_test_wav_bytes(duration_sec=1.5, sample_rate=44100)
    
    # 1. Submit Job
    create_resp = client.post(
        "/jobs",
        files={"file": ("sample_song.wav", test_wav, "audio/wav")},
        data={"model": "htdemucs"}
    )
    assert create_resp.status_code == 201
    job_id = create_resp.json()["job_id"]
    assert job_id.startswith("job_")
    
    # 2. Wait for background worker separation to complete
    import time
    max_wait_seconds = 180  # Demucs on CPU typically completes 1.5s in ~10-25 seconds
    start_wait = time.time()
    completed = False
    
    while time.time() - start_wait < max_wait_seconds:
        status_resp = client.get(f"/jobs/{job_id}")
        assert status_resp.status_code == 200
        status_data = status_resp.json()
        current_status = status_data["status"]
        
        if current_status == "completed":
            completed = True
            break
        elif current_status == "failed":
            pytest.fail(f"Separation job failed: {status_data.get('error')}")
            
        time.sleep(1.0)
        
    assert completed, f"Separation job did not complete within {max_wait_seconds}s"
    
    # 3. Verify Results Endpoint
    results_resp = client.get(f"/jobs/{job_id}/results")
    assert results_resp.status_code == 200
    results_data = results_resp.json()
    assert results_data["status"] == "completed"
    assert results_data["duration_seconds"] is not None
    
    stems = results_data["stems"]
    expected_stems = ["instrumental", "vocals", "drums", "bass", "other"]
    
    for stem_name in expected_stems:
        assert stem_name in stems, f"Expected stem {stem_name} not found in output"
        stem_info = stems[stem_name]
        assert stem_info["file_size_bytes"] > 44, f"Stem {stem_name} has invalid size {stem_info['file_size_bytes']}"
        assert stem_info["filename"] == f"{stem_name}.wav"
        
        # 4. Download and inspect actual stem WAV file
        download_resp = client.get(f"/jobs/{job_id}/stems/{stem_name}")
        assert download_resp.status_code == 200
        assert download_resp.headers["content-type"] == "audio/wav"
        
        stem_bytes = download_resp.content
        assert len(stem_bytes) > 44
        
        # Parse WAV header to verify validity
        with wave.open(io.BytesIO(stem_bytes), 'rb') as stem_wav:
            assert stem_wav.getnchannels() == 2  # Stereo
            assert stem_wav.getsampwidth() == 2  # 16-bit PCM
            assert stem_wav.getframerate() == 44100
            stem_duration = stem_wav.getnframes() / 44100.0
            assert math.isclose(stem_duration, 1.5, rel_tol=0.1), f"Stem duration {stem_duration} does not match input 1.5s"

    # 5. Delete Job and verify cleanup
    del_resp = client.delete(f"/jobs/{job_id}")
    assert del_resp.status_code == 200
    assert del_resp.json()["deleted"] is True
    
    # Verify job directory was removed
    job_dir = settings.OUTPUTS_DIR / job_id
    assert not job_dir.exists()

