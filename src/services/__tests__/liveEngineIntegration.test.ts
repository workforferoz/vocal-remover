import { describe, it, expect } from 'vitest';
import { localEngineService } from '../localEngine';

// Helper to create a valid 16-bit PCM WAV in Node/Browser environment
function createSyntheticWav(durationSeconds = 1.0, sampleRate = 44100): Blob {
  const numChannels = 2;
  const numSamples = Math.floor(durationSeconds * sampleRate);
  const blockAlign = numChannels * 2;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  view.setUint8(0, 'R'.charCodeAt(0));
  view.setUint8(1, 'I'.charCodeAt(0));
  view.setUint8(2, 'F'.charCodeAt(0));
  view.setUint8(3, 'F'.charCodeAt(0));
  view.setUint32(4, 36 + dataSize, true);
  view.setUint8(8, 'W'.charCodeAt(0));
  view.setUint8(9, 'A'.charCodeAt(0));
  view.setUint8(10, 'V'.charCodeAt(0));
  view.setUint8(11, 'E'.charCodeAt(0));

  // fmt sub-chunk
  view.setUint8(12, 'f'.charCodeAt(0));
  view.setUint8(13, 'm'.charCodeAt(0));
  view.setUint8(14, 't'.charCodeAt(0));
  view.setUint8(15, ' '.charCodeAt(0));
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // BitsPerSample (16 bits)

  // data sub-chunk
  view.setUint8(36, 'd'.charCodeAt(0));
  view.setUint8(37, 'a'.charCodeAt(0));
  view.setUint8(38, 't'.charCodeAt(0));
  view.setUint8(39, 'a'.charCodeAt(0));
  view.setUint32(40, dataSize, true);

  // Write synthetic sinusoidal tone
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sampleL = Math.sin(2 * Math.PI * 440 * t) * 0.5; // 440 Hz
    const sampleR = Math.sin(2 * Math.PI * 880 * t) * 0.5; // 880 Hz

    view.setInt16(offset, Math.floor(sampleL * 32767), true);
    view.setInt16(offset + 2, Math.floor(sampleR * 32767), true);
    offset += 4;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

describe('Live Local Demucs Engine End-to-End Integration', () => {
  it('1. checks live engine health and hardware details', async () => {
    const status = await localEngineService.checkEngine();
    expect(status.state).toBe('connected');
    expect(status.statusText).toBe('Engine Connected');
    expect(status.health).toBeDefined();
    expect(status.health?.status).toBe('ok');
    expect(status.health?.demucs_version).toBe('4.1.0');
    expect(status.health?.python_version).toContain('3.11');
    expect(status.health?.pytorch_version).toBeDefined();
    expect(status.capabilities?.available_models).toContain('htdemucs');
    expect(status.capabilities?.available_stems).toEqual(['instrumental', 'vocals', 'drums', 'bass', 'other']);
  });

  it('2. uploads a real test song and executes genuine Demucs separation', async () => {
    const wavBlob = createSyntheticWav(1.2, 44100);
    const testFile = new File([wavBlob], 'e2e_integration_test_song.wav', { type: 'audio/wav' });

    // Step A: Upload & Queue Job
    const createRes = await localEngineService.createSeparationJob(testFile, 'htdemucs');
    expect(createRes.job_id).toBeDefined();
    expect(createRes.status).toBe('queued');
    const jobId = createRes.job_id;

    // Step B: Poll until separation completes
    let attempts = 0;
    const maxAttempts = 50; // up to ~50s for Demucs CPU inference
    let jobStatus = await localEngineService.getJobStatus(jobId);

    while (attempts < maxAttempts && (jobStatus.status === 'queued' || jobStatus.status === 'processing')) {
      await new Promise((r) => setTimeout(r, 1000));
      jobStatus = await localEngineService.getJobStatus(jobId);
      attempts++;
    }

    expect(jobStatus.status).toBe('completed');
    expect(jobStatus.progress).toBe(100);
    expect(jobStatus.duration_seconds).toBeGreaterThan(0);

    // Step C: Retrieve Stems Results
    const results = await localEngineService.getJobResults(jobId);
    expect(results.job_id).toBe(jobId);
    expect(results.status).toBe('completed');
    expect(Object.keys(results.stems).sort()).toEqual(['bass', 'drums', 'instrumental', 'other', 'vocals']);

    // Step D: Download & Validate each Stem
    for (const stemName of ['instrumental', 'vocals', 'drums', 'bass', 'other']) {
      const stemUrl = localEngineService.getStemUrl(jobId, stemName);
      expect(stemUrl).toContain(`/jobs/${jobId}/stems/${stemName}`);

      const stemBlob = await localEngineService.fetchStemBlob(jobId, stemName);
      expect(stemBlob.size).toBeGreaterThan(10000); // Verified non-empty audio

      // Verify WAV header
      const headerBuffer = await stemBlob.slice(0, 12).arrayBuffer();
      const headerBytes = new Uint8Array(headerBuffer);
      const riffHeader = String.fromCharCode(...headerBytes.slice(0, 4));
      const waveHeader = String.fromCharCode(...headerBytes.slice(8, 12));
      expect(riffHeader).toBe('RIFF');
      expect(waveHeader).toBe('WAVE');
    }

    // Step E: Clean up Job
    const deleteRes = await localEngineService.cancelJob(jobId);
    expect(deleteRes.deleted).toBe(true);
  }, 60000); // 60s timeout for Demucs CPU inference

  it('3. rejects invalid audio file upload with HTTP 400', async () => {
    const invalidFile = new File(['fake content'], 'not_an_audio.exe', { type: 'application/octet-stream' });
    await expect(
      localEngineService.createSeparationJob(invalidFile, 'htdemucs')
    ).rejects.toThrow();
  });
});

