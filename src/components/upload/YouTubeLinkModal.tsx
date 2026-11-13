import React, { useState, useEffect } from 'react';
import {
  X,
  Link as LinkIcon,
  Loader2,
  Sparkles,
  ClipboardPaste,
  Clock,
  User,
  AlertCircle,
} from 'lucide-react';
import {
  isValidYouTubeUrl,
  fetchYouTubeInfo,
  downloadYouTubeAudio,
  type YouTubeInfo,
} from '../../services/youtubeService';
import { useNotificationStore } from '../../store/useNotificationStore';

export const YouTubeIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

interface YouTubeLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAudioLoaded: (file: File) => void;
}

export const YouTubeLinkModal: React.FC<YouTubeLinkModalProps> = ({
  isOpen,
  onClose,
  onAudioLoaded,
}) => {
  const [url, setUrl] = useState<string>('');
  const [isLoadingInfo, setIsLoadingInfo] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadStatus, setDownloadStatus] = useState<string>('');
  const [videoInfo, setVideoInfo] = useState<YouTubeInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { showNotification } = useNotificationStore();

  const handleClose = () => {
    if (isDownloading) return;
    setUrl('');
    setVideoInfo(null);
    setErrorMessage(null);
    setIsDownloading(false);
    setDownloadStatus('');
    onClose();
  };

  // Debounced auto-fetch video preview info when valid URL is pasted
  useEffect(() => {
    const trimmed = url.trim();
    if (!trimmed || !isValidYouTubeUrl(trimmed)) {
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      setIsLoadingInfo(true);
      setErrorMessage(null);
      try {
        const info = await fetchYouTubeInfo(trimmed);
        if (isMounted) {
          setVideoInfo(info);
          setIsLoadingInfo(false);
        }
      } catch {
        if (isMounted) {
          setIsLoadingInfo(false);
        }
      }
    }, 600);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [url]);

  if (!isOpen) return null;

  const handlePaste = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setUrl(text.trim());
          setErrorMessage(null);
        }
      }
    } catch {
      // ignore clipboard permission rejection
    }
  };

  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = url.trim();

    if (!cleanUrl) {
      setErrorMessage('Please enter or paste a YouTube URL.');
      return;
    }

    if (!isValidYouTubeUrl(cleanUrl)) {
      setErrorMessage(
        'Please enter a valid YouTube link (e.g. https://www.youtube.com/watch?v=... or https://youtu.be/...)'
      );
      return;
    }

    setIsDownloading(true);
    setErrorMessage(null);
    setDownloadStatus('Connecting to YouTube and extracting audio track...');

    try {
      const file = await downloadYouTubeAudio(cleanUrl, (status) => {
        setDownloadStatus(status);
      });

      showNotification({
        type: 'success',
        title: 'Audio Extracted',
        message: `Loaded "${file.name}" from YouTube. Starting vocal removal...`,
      });

      onAudioLoaded(file);
      onClose();
    } catch (err: unknown) {
      setIsDownloading(false);
      const msg = err instanceof Error ? err.message : 'Failed to download YouTube audio.';
      setErrorMessage(msg);
      showNotification({
        type: 'error',
        title: 'YouTube Download Failed',
        message: msg,
      });
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="youtube-modal-title"
    >
      <div className="w-full max-w-lg bg-[#0D1527] border border-slate-800 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden relative my-auto">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-start justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/15 border border-red-500/30 text-red-500 flex items-center justify-center shadow-sm shrink-0">
              <YouTubeIcon className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h2 id="youtube-modal-title" className="text-base sm:text-lg font-bold text-white tracking-tight">
                Import from YouTube
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Paste any YouTube song or video link to extract audio & remove vocals.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isDownloading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4">
          <form onSubmit={handleExtract} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                YouTube Song / Video Link
              </label>
              <div className="flex items-center w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 focus-within:border-red-500 focus-within:ring-1 focus-within:ring-red-500 transition-all">
                <LinkIcon className="w-4 h-4 text-slate-400 shrink-0 mr-3 pointer-events-none" />
                <input
                  type="url"
                  required
                  value={url}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    setUrl(nextVal);
                    setErrorMessage(null);
                    if (!nextVal.trim() || !isValidYouTubeUrl(nextVal.trim())) {
                      setVideoInfo(null);
                    }
                  }}
                  disabled={isDownloading}
                  placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                  className="w-full bg-transparent border-0 p-0 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handlePaste}
                  disabled={isDownloading}
                  className="p-1 px-2 text-[11px] font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg shrink-0 ml-2 cursor-pointer transition-colors flex items-center gap-1"
                  title="Paste from clipboard"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Paste</span>
                </button>
              </div>
            </div>

            {/* Video Preview Card if detected */}
            {isLoadingInfo && (
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-2.5 text-xs text-slate-400 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                <span>Checking video information...</span>
              </div>
            )}

            {videoInfo && !isLoadingInfo && (
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-3">
                {videoInfo.thumbnail ? (
                  <img
                    src={videoInfo.thumbnail}
                    alt={videoInfo.title}
                    className="w-20 h-14 rounded-lg object-cover shrink-0 bg-slate-950 border border-slate-800"
                  />
                ) : (
                  <div className="w-20 h-14 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                    <YouTubeIcon className="w-6 h-6 text-red-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  <h4 className="text-xs sm:text-sm font-bold text-white truncate leading-snug">
                    {videoInfo.title}
                  </h4>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                    {videoInfo.uploader && (
                      <span className="flex items-center gap-1 truncate">
                        <User className="w-3 h-3 text-slate-500" />
                        <span className="truncate">{videoInfo.uploader}</span>
                      </span>
                    )}
                    {videoInfo.duration_seconds && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{formatDuration(videoInfo.duration_seconds)}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="leading-snug">{errorMessage}</span>
              </div>
            )}

            {/* Downloading feedback */}
            {isDownloading && (
              <div className="p-3.5 rounded-xl bg-blue-600/10 border border-blue-500/30 space-y-2">
                <div className="flex items-center justify-between text-xs text-blue-300">
                  <span className="flex items-center gap-2 font-semibold">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                    <span>{downloadStatus || 'Downloading YouTube Audio...'}</span>
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full animate-pulse w-full" />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isDownloading || !url.trim()}
              className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Extracting Audio from YouTube...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Extract Audio & Remove Vocals</span>
                </>
              )}
            </button>
          </form>

          <p className="text-[11px] text-slate-500 text-center leading-relaxed">
            Extracts pristine studio audio directly from YouTube and initiates local vocal isolation.
          </p>
        </div>
      </div>
    </div>
  );
};
