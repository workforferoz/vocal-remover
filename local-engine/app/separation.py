import os
import gc
import time
import logging
from pathlib import Path
from typing import Optional, Callable
import torch
import torchaudio
import soundfile as sf
from demucs.pretrained import get_model
from demucs.apply import apply_model
from .config import settings

logger = logging.getLogger("vocal_studio.separation")

def suppress_vocal_bleed(
    inst_tensor: torch.Tensor,
    vocals_tensor: torch.Tensor,
    sample_rate: int = 44100,
    suppression_strength: float = 0.65
) -> torch.Tensor:
    """
    Suppresses residual vocal bleed and reverb leakage from the instrumental stem
    using spectral subtraction in the vocal formant band (150Hz - 6500Hz).
    """
    try:
        n_fft = 2048
        hop_length = 512
        window = torch.hann_window(n_fft, device=inst_tensor.device)
        
        # Compute STFT
        inst_stft = torch.stft(inst_tensor, n_fft=n_fft, hop_length=hop_length, window=window, return_complex=True)
        voc_stft = torch.stft(vocals_tensor, n_fft=n_fft, hop_length=hop_length, window=window, return_complex=True)
        
        inst_mag = torch.abs(inst_stft)
        voc_mag = torch.abs(voc_stft)
        
        # Vocal frequency bin range: 150 Hz to 6500 Hz
        freq_resolution = sample_rate / n_fft
        min_bin = max(1, int(150 / freq_resolution))
        max_bin = min(inst_mag.shape[1] - 1, int(6500 / freq_resolution))
        
        # Soft Wiener-style mask: where vocal energy dominates, attenuate instrumental bleed
        eps = 1e-7
        vocal_ratio = (voc_mag[:, min_bin:max_bin, :] ** 2) / (voc_mag[:, min_bin:max_bin, :] ** 2 + inst_mag[:, min_bin:max_bin, :] ** 2 + eps)
        
        # Attenuation gain (clamp so we never mute legitimate instruments)
        gain = 1.0 - (suppression_strength * vocal_ratio)
        gain = torch.clamp(gain, min=0.25, max=1.0)
        
        # Apply gain in vocal band
        inst_stft_clean = inst_stft.clone()
        inst_stft_clean[:, min_bin:max_bin, :] = inst_stft[:, min_bin:max_bin, :] * gain
        
        # Invert STFT back to waveform
        clean_audio = torch.istft(inst_stft_clean, n_fft=n_fft, hop_length=hop_length, window=window, length=inst_tensor.shape[-1])
        return clean_audio
    except Exception as e:
        logger.warning(f"Spectral bleed suppression fallback to raw instrumental: {e}")
        return inst_tensor

class DemucsEngine:
    """
    Manages Demucs model caching, hardware device assignment, and audio separation.
    """
    def __init__(self):
        self._model = None
        self._model_name = settings.DEFAULT_MODEL
        self._device = self._detect_device()
        
        # Optimize CPU thread allocation for low-end hardware safety
        if self._device.type == "cpu":
            num_threads = min(4, max(1, (os.cpu_count() or 4) - 1))
            torch.set_num_threads(num_threads)
            logger.info(f"Initialized PyTorch with {num_threads} CPU worker threads")

    def _detect_device(self) -> torch.device:
        """
        Detects whether CUDA hardware acceleration is supported by the installed
        PyTorch binary and GPU driver, falling back to CPU.
        """
        if torch.cuda.is_available():
            try:
                # Test a mini tensor allocation to confirm driver compatibility
                test_tensor = torch.zeros(1, device="cuda")
                del test_tensor
                device_name = torch.cuda.get_device_name(0)
                logger.info(f"CUDA acceleration active on: {device_name}")
                return torch.device("cuda")
            except Exception as e:
                logger.warning(f"CUDA detected but failed allocation test ({e}). Falling back to CPU.")
        
        logger.info("Using CPU for baseline inference (universal compatibility).")
        return torch.device("cpu")

    @property
    def device_name(self) -> str:
        if self._device.type == "cuda":
            return f"NVIDIA CUDA ({torch.cuda.get_device_name(0)})"
        return f"CPU ({os.cpu_count() or 4} cores)"

    @property
    def is_cuda(self) -> bool:
        return self._device.type == "cuda"

    def get_or_load_model(self, model_name: str = settings.DEFAULT_MODEL):
        """
        Loads the pretrained model singleton or retrieves it from memory cache.
        """
        if self._model is not None and self._model_name == model_name:
            return self._model

        logger.info(f"Loading pretrained Demucs model '{model_name}' on {self._device}...")
        start_time = time.time()
        
        # Load pretrained weights
        model = get_model(model_name)
        model.to(self._device)
        model.eval()
        
        self._model = model
        self._model_name = model_name
        elapsed = time.time() - start_time
        logger.info(f"Model '{model_name}' loaded in {elapsed:.2f}s with sources: {model.sources}")
        return self._model

    def separate_audio(
        self,
        input_audio_path: Path,
        output_dir: Path,
        model_name: str = settings.DEFAULT_MODEL,
        shifts: int = settings.DEFAULT_SHIFTS,
        overlap: float = settings.DEFAULT_OVERLAP,
        on_progress: Optional[Callable[[str, int], None]] = None
    ) -> dict[str, Path]:
        """
        Executes genuine AI source separation on the input audio file.
        Outputs 4 real audio stems: vocals.wav, drums.wav, bass.wav, other.wav
        """
        if on_progress:
            on_progress("loading_model", 10)
        model = self.get_or_load_model(model_name)

        if on_progress:
            on_progress("loading_audio", 25)
        
        # Load audio using torchaudio or soundfile
        try:
            wav, sample_rate = torchaudio.load(str(input_audio_path))
        except Exception:
            # Fallback to soundfile loading if torchaudio encounters container quirks
            data, sample_rate = sf.read(str(input_audio_path), dtype="float32", always_2d=True)
            wav = torch.from_numpy(data.T)

        orig_duration = wav.shape[-1] / sample_rate
        logger.info(f"Loaded input audio: {wav.shape[0]} channels, {orig_duration:.2f}s @ {sample_rate}Hz")

        # Resample to model expected samplerate (usually 44100 Hz for htdemucs)
        if sample_rate != model.samplerate:
            if on_progress:
                on_progress("resampling_audio", 35)
            resampler = torchaudio.transforms.Resample(sample_rate, model.samplerate)
            wav = resampler(wav)

        # Standardize to 2-channel stereo for Demucs
        if wav.shape[0] == 1:
            wav = wav.repeat(2, 1)
        elif wav.shape[0] > 2:
            wav = wav[:2]

        # Normalization reference
        ref = wav.mean(0)
        wav = (wav - ref.mean()) / (ref.std() + 1e-8)

        if on_progress:
            on_progress("separating_demucs", 50)
        
        # Run Demucs inference with memory-efficient split
        start_inference = time.time()
        with torch.no_grad():
            sources = apply_model(
                model,
                wav[None],
                device=self._device,
                shifts=shifts,
                split=True,
                overlap=overlap
            )[0]
        
        inference_time = time.time() - start_inference
        logger.info(f"Demucs inference completed in {inference_time:.2f}s")

        # Denormalize output
        sources = sources * (ref.std() + 1e-8) + ref.mean()

        if on_progress:
            on_progress("saving_stems", 85)

        output_dir.mkdir(parents=True, exist_ok=True)
        stems_generated: dict[str, Path] = {}

        # Save each source stem as 16-bit PCM WAV
        for source_idx, source_name in enumerate(model.sources):
            stem_path = output_dir / f"{source_name}.wav"
            stem_audio = sources[source_idx].cpu()
            
            # Clamp to prevent audio clipping distortion
            stem_audio = torch.clamp(stem_audio, -1.0, 1.0)
            
            # Write 16-bit PCM stereo WAV using soundfile
            audio_np = stem_audio.numpy().T
            sf.write(str(stem_path), audio_np, model.samplerate, subtype="PCM_16")
            
            # Verify file exists and is valid
            if not stem_path.exists() or stem_path.stat().st_size < 44:
                raise RuntimeError(f"Failed to generate valid stem file: {stem_path}")
            
            stems_generated[source_name] = stem_path
            logger.info(f"Stem written: {stem_path.name} ({stem_path.stat().st_size} bytes)")

        # Mandatory verification: Ensure all 4 core stems are present
        required_stems = ["vocals", "drums", "bass", "other"]
        for stem in required_stems:
            if stem not in stems_generated:
                raise RuntimeError(f"Demucs separation did not produce expected stem: {stem}")

        # Generate complete instrumental track (sum of drums + bass + other)
        non_vocal_indices = [
            i for i, name in enumerate(model.sources) if name.lower() != "vocals"
        ]
        if non_vocal_indices:
            inst_audio = torch.stack([sources[i] for i in non_vocal_indices]).sum(dim=0).cpu()

            # Clean residual vocal bleed and reverb leakage from instrumental stem
            vocals_idx = next((i for i, name in enumerate(model.sources) if name.lower() == "vocals"), None)
            if vocals_idx is not None:
                inst_audio = suppress_vocal_bleed(
                    inst_tensor=inst_audio,
                    vocals_tensor=sources[vocals_idx].cpu(),
                    sample_rate=model.samplerate,
                    suppression_strength=0.65
                )

            inst_audio = torch.clamp(inst_audio, -1.0, 1.0)
            inst_path = output_dir / "instrumental.wav"
            sf.write(str(inst_path), inst_audio.numpy().T, model.samplerate, subtype="PCM_16")
            stems_generated["instrumental"] = inst_path
            logger.info(f"Instrumental track written with vocal bleed suppression: {inst_path.name} ({inst_path.stat().st_size} bytes)")

        # Low-end PC RAM optimization: Explicitly release tensor memory
        del wav, sources, ref
        gc.collect()
        if self._device.type == "cuda":
            torch.cuda.empty_cache()

        if on_progress:
            on_progress("completed", 100)

        return stems_generated

# Global singleton engine instance
engine = DemucsEngine()

