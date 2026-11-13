import React, { useRef, useCallback } from 'react';
import { formatDuration } from '../../services/audioMetadata';

interface StudioTimelineProps {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  peaks?: number[];
  disabled?: boolean;
}

export const StudioTimeline: React.FC<StudioTimelineProps> = ({
  currentTime,
  duration,
  onSeek,
  peaks,
  disabled = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);

  const calculateSeekTime = useCallback(
    (clientX: number): number => {
      if (!containerRef.current || duration <= 0) return 0;
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const ratio = clickX / rect.width;
      return ratio * duration;
    },
    [duration]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled || duration <= 0) return;
    isDraggingRef.current = true;
    const targetTime = calculateSeekTime(e.clientX);
    onSeek(targetTime);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const moveTime = calculateSeekTime(moveEvent.clientX);
      onSeek(moveTime);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Generate lightweight timeline tick marks
  const tickCount = 12;
  const ticks = Array.from({ length: tickCount }, (_, i) => (i / (tickCount - 1)) * duration);

  return (
    <div className="space-y-2 select-none">
      {/* Time Display */}
      <div className="flex items-center justify-between text-xs font-mono text-slate-400">
        <span className="text-[#3984FF] font-semibold">{formatDuration(currentTime)}</span>
        <span>{formatDuration(duration)}</span>
      </div>

      {/* Scrubbable Track Container */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        className={`relative h-12 w-full bg-[#101827] rounded-xl border border-white/10 overflow-hidden ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-white/20'
        } transition-colors flex items-center`}
      >
        {/* Background Waveform Silhouette or Grid */}
        <div className="absolute inset-0 flex items-center justify-between px-2 opacity-25 pointer-events-none">
          {peaks && peaks.length > 0 ? (
            peaks.map((p, i) => (
              <div
                key={i}
                className="w-1 rounded-full bg-slate-400"
                style={{ height: `${Math.max(p * 100, 10)}%` }}
              />
            ))
          ) : (
            Array.from({ length: 64 }, (_, i) => {
              const height = 15 + Math.sin(i * 0.4) * 25 + Math.cos(i * 0.8) * 15;
              return (
                <div
                  key={i}
                  className="w-1 rounded-full bg-slate-500"
                  style={{ height: `${Math.max(height, 10)}%` }}
                />
              );
            })
          )}
        </div>

        {/* Played Region Highlight */}
        <div
          className="absolute left-0 top-0 bottom-0 bg-blue-600/25 border-r-2 border-blue-400 pointer-events-none transition-all duration-75"
          style={{ width: `${Math.min(Math.max(progressPercent, 0), 100)}%` }}
        />

        {/* Playhead Pin */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)] pointer-events-none transition-all duration-75"
          style={{ left: `${Math.min(Math.max(progressPercent, 0), 100)}%` }}
        >
          <div className="w-3 h-3 bg-white rounded-full -ml-1 -mt-1 shadow-md" />
        </div>

        {/* Tick markers */}
        <div className="absolute bottom-1 inset-x-2 flex justify-between pointer-events-none text-[9px] font-mono text-slate-500">
          {ticks.map((t, idx) => (
            <span key={idx}>{idx === 0 || idx === ticks.length - 1 ? '' : formatDuration(t)}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

