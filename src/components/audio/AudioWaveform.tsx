import React, { useRef, useState, useCallback } from 'react';

interface AudioWaveformProps {
  peaks?: number[];
  progress: number; // 0 to 1
  duration: number; // in seconds
  onSeek?: (percentage: number) => void;
  height?: number;
  className?: string;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  peaks = [],
  progress,
  duration,
  onSeek,
  height = 48,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverPercent, setHoverPercent] = useState<number | null>(null);

  // Generate fallback peaks if empty
  const displayPeaks = peaks.length > 0 ? peaks : Array.from({ length: 70 }, (_, i) => 0.2 + 0.6 * Math.abs(Math.sin(i * 0.25)));

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    setHoverPercent(x / rect.width);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoverPercent(null);
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current || !onSeek) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      onSeek(x / rect.width);
    },
    [onSeek]
  );

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className={`relative w-full cursor-pointer select-none group flex items-center py-2 ${className}`}
      style={{ height: `${height}px` }}
      role="slider"
      aria-label="Audio scrubber"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      tabIndex={0}
    >
      {/* Bars container */}
      <div className="w-full h-full flex items-center justify-between gap-[2px]">
        {displayPeaks.map((peak, idx) => {
          const barProgress = idx / displayPeaks.length;
          const isPlayed = barProgress <= progress;
          const isHovered = hoverPercent !== null && barProgress <= hoverPercent;
          const barHeightPercent = Math.max(12, Math.round(peak * 100));

          let bgStyle = 'bg-slate-700/60';
          if (isPlayed) {
            bgStyle = 'bg-gradient-to-t from-[#7357F5] to-[#3984FF] shadow-sm';
          } else if (isHovered) {
            bgStyle = 'bg-slate-500';
          }

          return (
            <div
              key={idx}
              className={`flex-1 min-w-[2px] rounded-full transition-all duration-75 ${bgStyle}`}
              style={{ height: `${barHeightPercent}%` }}
            />
          );
        })}
      </div>

      {/* Scrubber playback head line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white pointer-events-none transition-all duration-75 shadow-[0_0_8px_rgba(255,255,255,0.8)]"
        style={{ left: `${Math.min(100, Math.max(0, progress * 100))}%` }}
      >
        <div className="w-2.5 h-2.5 -ml-1 -top-1 absolute rounded-full bg-white shadow-md" />
      </div>

      {/* Hover preview tooltip */}
      {hoverPercent !== null && duration > 0 && (
        <div
          className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 text-[10px] font-mono font-medium bg-[#151F30] border border-white/20 text-white rounded shadow-lg pointer-events-none"
          style={{ left: `${hoverPercent * 100}%` }}
        >
          {Math.floor((hoverPercent * duration) / 60)
            .toString()
            .padStart(2, '0')}
          :
          {Math.floor((hoverPercent * duration) % 60)
            .toString()
            .padStart(2, '0')}
        </div>
      )}
    </div>
  );
};

