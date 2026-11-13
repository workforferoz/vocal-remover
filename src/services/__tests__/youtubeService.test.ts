import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isValidYouTubeUrl,
  fetchYouTubeInfo,
  downloadYouTubeAudio,
} from '../youtubeService';

describe('YouTube Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('isValidYouTubeUrl', () => {
    it('accepts standard youtube.com/watch URLs', () => {
      expect(isValidYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
      expect(isValidYouTubeUrl('http://youtube.com/watch?v=jNQXAC9IVRw')).toBe(true);
    });

    it('accepts youtu.be short URLs', () => {
      expect(isValidYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
    });

    it('accepts youtube.com/shorts URLs', () => {
      expect(isValidYouTubeUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(true);
    });

    it('accepts music.youtube.com URLs', () => {
      expect(isValidYouTubeUrl('https://music.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
    });

    it('rejects invalid or non-YouTube URLs', () => {
      expect(isValidYouTubeUrl('https://google.com')).toBe(false);
      expect(isValidYouTubeUrl('https://vimeo.com/123456')).toBe(false);
      expect(isValidYouTubeUrl('not a url')).toBe(false);
      expect(isValidYouTubeUrl('')).toBe(false);
    });
  });

  describe('fetchYouTubeInfo', () => {
    it('fetches metadata for a valid video URL', async () => {
      const mockInfo = {
        title: 'Demo Song',
        duration_seconds: 180,
        uploader: 'Artist Studio',
        thumbnail: 'https://example.com/thumb.jpg',
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockInfo,
      } as Response);

      const info = await fetchYouTubeInfo('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(info.title).toBe('Demo Song');
      expect(info.duration_seconds).toBe(180);
      expect(info.uploader).toBe('Artist Studio');
    });

    it('throws error when server responds with 400', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        json: async () => ({ detail: 'Video is unavailable or private.' }),
      } as Response);

      await expect(
        fetchYouTubeInfo('https://www.youtube.com/watch?v=invalid')
      ).rejects.toThrow('Video is unavailable or private.');
    });
  });

  describe('downloadYouTubeAudio', () => {
    it('downloads audio and returns a File object', async () => {
      const audioBytes = new Uint8Array([0xff, 0xfb, 0x90, 0x64]); // MP3 frame header simulation
      const mockBlob = new Blob([audioBytes], { type: 'audio/mpeg' });

      const headers = new Headers();
      headers.set('x-song-title', 'My_Awesome_Song');
      headers.set('content-disposition', 'attachment; filename="My_Awesome_Song.mp3"');

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob,
        headers: headers,
      } as Response);

      const statusUpdates: string[] = [];
      const file = await downloadYouTubeAudio(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        (msg) => statusUpdates.push(msg)
      );

      expect(file).toBeInstanceOf(File);
      expect(file.name).toBe('My Awesome Song.mp3');
      expect(file.type).toBe('audio/mpeg');
      expect(statusUpdates.length).toBeGreaterThan(0);
    });

    it('throws error when download fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        json: async () => ({ detail: 'Failed to extract audio.' }),
      } as Response);

      await expect(
        downloadYouTubeAudio('https://www.youtube.com/watch?v=bad')
      ).rejects.toThrow('Failed to extract audio.');
    });
  });
});

