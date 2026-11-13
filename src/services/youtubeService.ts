// Service for extracting audio from YouTube links via local engine
const ENGINE_BASE_URL = 'http://127.0.0.1:8524';

export interface YouTubeInfo {
  title: string;
  duration_seconds?: number;
  uploader?: string;
  thumbnail?: string;
}

/**
 * Validates whether a given string is a valid YouTube URL.
 */
export function isValidYouTubeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  const pattern =
    /^(https?:\/\/)?(www\.|m\.|music\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/)[\w-]{11}/i;
  return pattern.test(trimmed);
}

/**
 * Fetch video metadata (title, duration, thumbnail) without downloading the full audio stream.
 */
export async function fetchYouTubeInfo(url: string): Promise<YouTubeInfo> {
  const cleanUrl = url.trim();
  if (!cleanUrl) {
    throw new Error('Please enter a YouTube link.');
  }

  const response = await fetch(`${ENGINE_BASE_URL}/api/youtube/info`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: cleanUrl }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to retrieve YouTube details.' }));
    throw new Error(err.detail || 'Could not fetch YouTube video information.');
  }

  return response.json();
}

/**
 * Downloads audio from a YouTube URL via the local engine and returns a browser File object.
 */
export async function downloadYouTubeAudio(
  url: string,
  onStatusUpdate?: (status: string) => void
): Promise<File> {
  const cleanUrl = url.trim();
  if (!cleanUrl) {
    throw new Error('Please enter a YouTube link.');
  }

  if (onStatusUpdate) {
    onStatusUpdate('Connecting to YouTube and extracting audio track...');
  }

  const response = await fetch(`${ENGINE_BASE_URL}/api/youtube/download`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: cleanUrl }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'YouTube download failed.' }));
    throw new Error(
      err.detail || 'Failed to download audio from YouTube. Check that the link is valid and public.'
    );
  }

  if (onStatusUpdate) {
    onStatusUpdate('Preparing audio for vocal separation...');
  }

  const blob = await response.blob();
  if (!blob || blob.size === 0) {
    throw new Error('Received empty audio file from YouTube.');
  }

  // Extract song title from headers or disposition
  let songTitle = 'YouTube Audio';
  const customHeaderTitle = response.headers.get('x-song-title');
  if (customHeaderTitle) {
    try {
      songTitle = decodeURIComponent(customHeaderTitle).replace(/_/g, ' ');
    } catch {
      songTitle = customHeaderTitle.replace(/_/g, ' ');
    }
  } else {
    const disposition = response.headers.get('content-disposition');
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) {
        songTitle = match[1].replace(/\.mp3$/i, '');
      }
    }
  }

  const safeFilename = `${songTitle.replace(/[/\\?%*:|"<>]/g, '_')}.mp3`;
  return new File([blob], safeFilename, { type: 'audio/mpeg' });
}

