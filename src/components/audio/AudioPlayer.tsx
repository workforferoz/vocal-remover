import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Repeat, FastForward, Disc3 } from 'lucide-react';
import { AudioWaveform } from './AudioWaveform';
import { formatDuration } from '../../services/audioMetadata';

interface AudioPlayerProps {
  src?: string;
  blob?: Blob;
  fileName?: string;
  peaks?: number[];
  autoPlay?: boolean;
  onEnded?: () => void;
  className?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  src,
  blob,
  fileName,
  peaks,
  autoPlay = false,
  onEnded,
  className = '',
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  // Manage Object URL lifecycle safely for low-end memory optimization
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let url: string | null = null;

    if (blob) {
      url = URL.createObjectURL(blob);
      timer = setTimeout(() => {
        setBlobUrl(url);
      }, 0);
    } else {
      timer = setTimeout(() => {
        setBlobUrl(null);
      }, 0);
    }

    return () => {
      if (timer) clearTimeout(timer);
      if (url) URL.revokeObjectURL(url);
    };
  }, [blob]);

  const activeSrc = src || blobUrl || '';

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = isMuted ? 0 : volume;
    audio.playbackRate = playbackRate;
    audio.loop = isLooping;
  }, [volume, isMuted, playbackRate, isLooping]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !activeSrc) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.warn('Audio play request interrupted:', err));
    }
  }, [isPlaying, activeSrc]);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setDuration(audio.duration || 0);
    if (autoPlay) {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [autoPlay]);

  const handleAudioEnded = useCallback(() => {
    setIsPlaying(false);
    if (onEnded) onEnded();
  }, [onEnded]);

  const handleSeek = useCallback(
    (percentage: number) => {
      const audio = audioRef.current;
      if (!audio || !duration) return;
      const targetTime = percentage * duration;
      audio.currentTime = targetTime;
      setCurrentTime(targetTime);
    },
    [duration]
  );

  const handleSkip = useCallback(
    (offsetSec: number) => {
      const audio = audioRef.current;
      if (!audio || !duration) return;
      const targetTime = Math.max(0, Math.min(duration, audio.currentTime + offsetSec));
      audio.currentTime = targetTime;
      setCurrentTime(targetTime);
    },
    [duration]
  );

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const cyclePlaybackRate = useCallback(() => {
    const rates = [1.0, 1.25, 1.5, 0.75];
    const currentIndex = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length];
    setPlaybackRate(nextRate);
  }, [playbackRate]);

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div
      className={`bg-[#101827] border border-white/10 rounded-2xl p-5 shadow-xl flex flex-col gap-4 ${className}`}
    >
      <audio
        ref={audioRef}
        src={activeSrc}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleAudioEnded}
        preload="metadata"
      />

      {/* Header track info */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#7357F5]/20 to-[#3984FF]/20 border border-white/10 flex items-center justify-center flex-shrink-0">
            <Disc3 className={`w-5 h-5 text-[#7357F5] ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '4s' }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{fileName || 'Audio Track Preview'}</p>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>{formatDuration(currentTime)}</span>
              <span>/</span>
              <span>{formatDuration(duration)}</span>
            </div>
          </div>
        </div>

        {/* Playback speed & loop badges */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLooping(!isLooping)}
            className={`p-1.5 rounded-lg text-xs font-medium border transition-colors ${
              isLooping
                ? 'bg-[#7357F5]/20 text-[#7357F5] border-[#7357F5]/40'
                : 'text-slate-400 border-white/5 hover:text-white hover:bg-white/5'
            }`}
            title="Loop playback"
            aria-label="Loop playback"
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={cyclePlaybackRate}
            className="px-2 py-1 rounded-lg text-xs font-mono font-medium bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            title="Change playback speed"
          >
            {playbackRate}x
          </button>
        </div>
      </div>

      {/* Interactive Waveform visualizer */}
      <div className="px-1 py-1 bg-[#151F30]/60 rounded-xl border border-white/5">
        <AudioWaveform
          peaks={peaks}
          progress={progress}
          duration={duration}
          onSeek={handleSeek}
          height={52}
        />
      </div>

      {/* Player transport controls */}
      <div className="flex items-center justify-between gap-4 pt-1">
        {/* Playback action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSkip(-5)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Rewind 5 seconds"
            aria-label="Rewind 5 seconds"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={togglePlay}
            disabled={!activeSrc}
            className="w-11 h-11 rounded-xl bg-gradient-to-r from-[#7357F5] to-[#3984FF] text-white flex items-center justify-center shadow-lg hover:shadow-indigo-500/25 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>

          <button
            onClick={() => handleSkip(5)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Forward 5 seconds"
            aria-label="Forward 5 seconds"
          >
            <FastForward className="w-4 h-4" />
          </button>
        </div>

        {/* Volume controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={toggleMute}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              setVolume(parseFloat(e.target.value));
              if (isMuted) setIsMuted(false);
            }}
            className="w-20 sm:w-24 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#7357F5]"
            aria-label="Volume level"
          />
        </div>
      </div>
    </div>
  );
};
