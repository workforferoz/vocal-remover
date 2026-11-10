import os
import shutil
import time
import uuid
import asyncio
import logging
from pathlib import Path
from typing import Optional
from concurrent.futures import ThreadPoolExecutor
from .config import settings
from .separation import engine
from .schemas import JobStatusType, StemResult

logger = logging.getLogger("vocal_studio.job_manager")

class Job:
    def __init__(self, job_id: str, original_filename: str, input_path: Path, model: str):
        self.job_id = job_id
        self.original_filename = original_filename
        self.input_path = input_path
        self.model = model
        self.status: JobStatusType = "queued"
        self.stage: str = "queued"
        self.progress: int = 0
        self.error: Optional[str] = None
        self.created_at: str = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        self.started_at: Optional[str] = None
        self.completed_at: Optional[str] = None
        self.duration_seconds: Optional[float] = None
        self.stems: dict[str, StemResult] = {}
        self.output_dir: Path = settings.OUTPUTS_DIR / job_id
        self._cancelled: bool = False

class JobManager:
    def __init__(self):
        self._jobs: dict[str, Job] = {}
        # Concurrency limit: 1 at a time for low-spec RAM safety
        self._semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_JOBS)
        self._executor = ThreadPoolExecutor(max_workers=settings.MAX_CONCURRENT_JOBS, thread_name_prefix="demucs_worker")

    def create_job(self, original_filename: str, input_path: Path, model: str = settings.DEFAULT_MODEL) -> Job:
        job_id = f"job_{uuid.uuid4().hex[:16]}"
        job = Job(job_id, original_filename, input_path, model)
        self._jobs[job_id] = job
        return job

    def get_job(self, job_id: str) -> Optional[Job]:
        return self._jobs.get(job_id)

    def cancel_job(self, job_id: str) -> bool:
        job = self.get_job(job_id)
        if not job:
            return False
        
        if job.status in ("queued", "processing"):
            job.status = "cancelled"
            job.stage = "cancelled"
            job._cancelled = True
            self._cleanup_job_files(job)
            return True
        return False

    def delete_job(self, job_id: str) -> bool:
        job = self.get_job(job_id)
        if not job:
            return False
        
        self.cancel_job(job_id)
        self._cleanup_job_files(job)
        self._jobs.pop(job_id, None)
        return True

    def _cleanup_job_files(self, job: Job):
        """Cleans up temp input audio and output stem directories for a job."""
        try:
            if job.input_path and job.input_path.exists():
                job.input_path.unlink(missing_ok=True)
                parent_temp = job.input_path.parent
                if parent_temp.name.startswith("job_") and parent_temp.exists():
                    shutil.rmtree(parent_temp, ignore_errors=True)
        except Exception as e:
            logger.warning(f"Error cleaning temp input for {job.job_id}: {e}")

        try:
            if job.output_dir and job.output_dir.exists():
                shutil.rmtree(job.output_dir, ignore_errors=True)
        except Exception as e:
            logger.warning(f"Error cleaning output dir for {job.job_id}: {e}")

    async def run_job(self, job_id: str):
        """Coordinates queued execution with the asyncio semaphore."""
        async with self._semaphore:
            job = self.get_job(job_id)
            if not job or job._cancelled:
                return

            job.status = "processing"
            job.started_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            start_time = time.time()

            loop = asyncio.get_running_loop()

            def progress_callback(stage: str, pct: int):
                job.stage = stage
                job.progress = pct

            try:
                # Run CPU-bound Demucs inference in worker thread pool
                stems_dict = await loop.run_in_executor(
                    self._executor,
                    engine.separate_audio,
                    job.input_path,
                    job.output_dir,
                    job.model,
                    settings.DEFAULT_SHIFTS,
                    settings.DEFAULT_OVERLAP,
                    progress_callback
                )

                if job._cancelled:
                    job.status = "cancelled"
                    return

                # Record results
                elapsed = time.time() - start_time
                job.duration_seconds = round(elapsed, 2)
                job.completed_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                job.status = "completed"
                job.stage = "completed"
                job.progress = 100

                # Populate stem metadata
                for stem_name, stem_file in stems_dict.items():
                    job.stems[stem_name] = StemResult(
                        name=stem_name,
                        filename=stem_file.name,
                        file_size_bytes=stem_file.stat().st_size,
                        download_url=f"/jobs/{job.job_id}/stems/{stem_name}"
                    )

                logger.info(f"Job {job.job_id} successfully completed in {elapsed:.2f}s")

                # Remove temporary input file to save disk space
                if job.input_path and job.input_path.exists():
                    job.input_path.unlink(missing_ok=True)

            except Exception as e:
                logger.error(f"Job {job.job_id} failed: {e}", exc_info=True)
                job.status = "failed"
                job.stage = "failed"
                job.error = str(e)

job_manager = JobManager()

