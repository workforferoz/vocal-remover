import React from 'react';
import type { TrackRuntimeState } from '../../services/audio/multitrackEngine';
import {
  Mic2,
  Drum,
  Guitar,
  Music,
  Disc,
  Volume2,
  VolumeX,
  Download,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface StemTrackStripProps {
  track: TrackRuntimeState;
  isPlaying: boolean;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onToggleSolo: () => void;
  onDownload: () => void;
  disabled?: boolean;
}

export const StemTrackStrip: React.FC<StemTrackStripProps> = ({
  track,
  isPlaying,
  onVolumeChange,
  onToggleMute,
  onToggleSolo,
  onDownload,
  disabled = false,
}) => {
  const getStemIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case 'vocals':
        return <Mic2 className="w-4 h-4 text-blue-400" />;
      case 'drums':
        return <Drum className="w-4 h-4 text-[#16C784]" />;
      case 'bass':
        return <Guitar className="w-4 h-4 text-amber-400" />;
      case 'original':
        return <Disc className="w-4 h-4 text-[#3984FF]" />;
      case 'other':
      default:
        return <Music className="w-4 h-4 text-cyan-400" />;
    }
  };

  const getBorderColor = (name: string) => {
    switch (name.toLowerCase()) {
      case 'vocals':
        return 'border-blue-500/30 focus-within:border-blue-500';
      case 'drums':
        return 'border-[#16C784]/30 focus-within:border-[#16C784]';
      case 'bass':
        return 'border-amber-400/30 focus-within:border-amber-400';
      case 'original':
        return 'border-[#3984FF]/30 focus-within:border-[#3984FF]';
      case 'other':
      default:
        return 'border-cyan-400/30 focus-within:border-cyan-400';
    }
  };

  // Track is audible when loaded, volume > 0, unmuted, and (no solo active OR this track is soloed)
  const isAudible = track.isLoaded && !track.muted && track.volume > 0;
  const isMeterActive = isPlaying && isAudible;

  return (
    <div
      className={`rounded-xl bg-[#101827] border ${getBorderColor(
        track.name
      )} p-4 transition-all flex flex-col justify-between gap-4 ${
        track.muted ? 'opacity-65' : ''
      }`}
    >
      {/* Track Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
            {getStemIcon(track.name)}
          </div>
          <div>
            <h4 className="text-sm font-bold text-white capitalize">{track.label}</h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              {track.isLoading ? (
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                  <span>Loading stem...</span>
                </span>
              ) : track.error ? (
                <span className="text-[10px] text-rose-400 flex items-center gap-1" title={track.error}>
                  <AlertCircle className="w-3 h-3" />
                  <span>Load error</span>
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 font-mono">16-bit PCM WAV</span>
              )}
            </div>
          </div>
        </div>

        {/* Audio Meter Simulation */}
        <div className="flex items-center gap-0.5 h-6 px-1.5 py-1 rounded bg-[#080D18] border border-white/5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`w-1 rounded-xs transition-all duration-75 ${
                isMeterActive
                  ? i < Math.ceil(track.volume * 6)
                    ? i > 4
                      ? 'bg-rose-500 h-4'
                      : i > 2
                      ? 'bg-amber-400 h-3'
                      : 'bg-[#16C784] h-2.5'
                    : 'bg-white/10 h-1'
                  : 'bg-white/10 h-1'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Volume Slider Section */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 flex items-center gap-1">
            {track.muted ? (
              <VolumeX className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-slate-300" />
            )}
            <span>Volume</span>
          </span>
          <span className="font-mono text-white text-[11px] font-semibold">
            {track.muted ? '0%' : `${Math.round(track.volume * 100)}%`}
          </span>
        </div>

        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          disabled={disabled || track.isLoading || Boolean(track.error)}
          value={track.volume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer disabled:opacity-50"
        />
      </div>

      {/* Channel Strip Buttons: Mute (M), Solo (S), Download */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
        <div className="flex items-center gap-2">
          {/* Mute Button (M) */}
          <button
            onClick={onToggleMute}
            disabled={disabled || track.isLoading}
            className={`w-8 h-8 rounded-lg text-xs font-bold transition-all flex items-center justify-center cursor-pointer border ${
              track.muted
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-sm'
                : 'bg-white/5 text-slate-300 hover:text-white border-white/10 hover:bg-white/10'
            }`}
            title={track.muted ? 'Unmute Track' : 'Mute Track'}
          >
            M
          </button>

          {/* Solo Button (S) */}
          <button
            onClick={onToggleSolo}
            disabled={disabled || track.isLoading}
            className={`w-8 h-8 rounded-lg text-xs font-bold transition-all flex items-center justify-center cursor-pointer border ${
              track.solo
                ? 'bg-amber-400/20 text-amber-300 border-amber-400/40 shadow-sm'
                : 'bg-white/5 text-slate-300 hover:text-white border-white/10 hover:bg-white/10'
            }`}
            title={track.solo ? 'Deactivate Solo' : 'Solo Track'}
          >
            S
          </button>
        </div>

        {/* Stem Download */}
        <button
          onClick={onDownload}
          disabled={disabled || track.isLoading || Boolean(track.error)}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-colors cursor-pointer"
          title={`Download ${track.name}.wav`}
          aria-label={`Download ${track.name}.wav`}
        >
          <Download className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

