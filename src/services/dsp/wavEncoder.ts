/**
 * High-performance, zero-dependency 16-bit PCM WAV encoder.
 * Encodes Float32Array audio channels into an RFC-compliant RIFF WAVE container.
 */

export interface WavEncodeOptions {
  sampleRate: number;
  channels: Float32Array[];
  bitDepth?: 16;
}

/**
 * Encodes audio channel buffers to an ArrayBuffer containing a standard WAV file.
 */
export function encodeWavArrayBuffer(channels: Float32Array[], sampleRate: number): ArrayBuffer {
  if (!channels || channels.length === 0) {
    throw new Error('WAV Encoder: No audio channels provided.');
  }

  const numChannels = channels.length;
  const numSamples = channels[0].length;

  for (let c = 1; c < numChannels; c++) {
    if (channels[c].length !== numSamples) {
      throw new Error(`WAV Encoder: Channel ${c} length mismatch (${channels[c].length} vs ${numSamples}).`);
    }
  }

  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const totalBufferSize = 44 + dataSize;

  const buffer = new ArrayBuffer(totalBufferSize);
  const view = new DataView(buffer);

  // Helper to write ASCII string to DataView
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  /* RIFF chunk descriptor */
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true); // ChunkSize
  writeString(8, 'WAVE');

  /* "fmt " sub-chunk */
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM linear)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, byteRate, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample (16-bit)

  /* "data" sub-chunk */
  writeString(36, 'data');
  view.setUint32(40, dataSize, true); // Subchunk2Size

  /* Write interleaved 16-bit signed PCM samples */
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = channels[ch][i];
      // Hard clamp to prevent integer overflow wrap-around
      const clamped = Math.max(-1.0, Math.min(1.0, sample));
      // Scale to 16-bit signed integer [-32768, 32767]
      const intSample = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      view.setInt16(offset, Math.round(intSample), true);
      offset += 2;
    }
  }

  return buffer;
}

/**
 * Encodes audio channels to a downloadable Blob of type 'audio/wav'.
 */
export function encodeWavBlob(channels: Float32Array[], sampleRate: number): Blob {
  const arrayBuffer = encodeWavArrayBuffer(channels, sampleRate);
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Triggers a download of a WAV blob in the user's browser with a sanitised filename.
 */
export function downloadWavFile(blob: Blob, originalName: string, suffix: string = '_vocal-reduced'): void {
  const baseName = originalName.replace(/\.[^/.]+$/, '');
  const fileName = `${baseName}${suffix}.wav`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.style.display = 'none';
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();

  // Defer cleanup to allow browser download initiation
  setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, 1000);
}

