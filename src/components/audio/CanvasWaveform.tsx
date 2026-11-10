import React, { useRef, useEffect, useState, useCallback } from 'react';

interface CanvasWaveformProps {
  peaks: Float32Array | number[];
  progress: number; // 0.0 to 1.0
  duration: number; // seconds
  onSeek?: (percentage: number) => void;
  height?: number;
  barColor?: string;
  progressColor?: string;
  className?: string;
}

export const CanvasWaveform: React.FC<CanvasWaveformProps> = ({
  peaks,
  progress,
  duration,
  onSeek,
  height = 64,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoverPercent, setHoverPercent] = useState<number | null>(null);

  // Render waveform on canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;

    if (canvas.width !== width * dpr || canvas.height !== canvasHeight * dpr) {
      canvas.width = width * dpr;
      canvas.height = canvasHeight * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, canvasHeight);

    const peakCount = peaks.length;
    if (peakCount === 0) {
      ctx.restore();
      return;
    }

    const centerY = canvasHeight / 2;
    const barWidth = 2.5;
    const barGap = 1.5;
    const step = barWidth + barGap;
    const numBars = Math.floor(width / step);

    // Create gradient for played portion
    const playedGrad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    playedGrad.addColorStop(0, '#7357F5');
    playedGrad.addColorStop(0.5, '#3984FF');
    playedGrad.addColorStop(1, '#7357F5');

    // Color for unplayed portion
    const unplayedColor = 'rgba(100, 116, 139, 0.45)';

    for (let i = 0; i < numBars; i++) {
      const x = i * step;
      const peakIndex = Math.min(peakCount - 1, Math.floor((i / numBars) * peakCount));
      const amplitude = Math.max(0.04, Math.min(1.0, peaks[peakIndex]));

      const barH = amplitude * (canvasHeight * 0.85);
      const topY = centerY - barH / 2;

      const isPlayed = i / numBars <= progress;

      ctx.fillStyle = isPlayed ? playedGrad : unplayedColor;

      // Draw rounded capsule
      const radius = barWidth / 2;
      ctx.beginPath();
      ctx.moveTo(x + radius, topY);
      ctx.lineTo(x + barWidth - radius, topY);
      ctx.quadraticCurveTo(x + barWidth, topY, x + barWidth, topY + radius);
      ctx.lineTo(x + barWidth, topY + barH - radius);
      ctx.quadraticCurveTo(x + barWidth, topY + barH, x + barWidth - radius, topY + barH);
      ctx.lineTo(x + radius, topY + barH);
      ctx.quadraticCurveTo(x, topY + barH, x, topY + barH - radius);
      ctx.lineTo(x, topY + radius);
      ctx.quadraticCurveTo(x, topY, x + radius, topY);
      ctx.closePath();
      ctx.fill();
    }

    // Draw playhead vertical line
    const playheadX = progress * width;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, canvasHeight);
    ctx.stroke();

    ctx.restore();
  }, [peaks, progress]);

  // Handle window resize via ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      renderCanvas();
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [renderCanvas]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    setHoverPercent(x / rect.width);
  };

  const handleMouseLeave = () => {
    setHoverPercent(null);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !onSeek) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    onSeek(x / rect.width);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className={`relative w-full cursor-pointer select-none rounded-xl bg-[#080D18]/70 border border-white/5 overflow-hidden ${className}`}
      style={{ height: `${height}px` }}
      role="slider"
      aria-label="Audio Waveform Scrubber"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      tabIndex={0}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Hover timestamp tooltip */}
      {hoverPercent !== null && duration > 0 && (
        <div
          className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 text-[10px] font-mono font-medium bg-[#151F30] border border-white/20 text-white rounded shadow-lg pointer-events-none z-10"
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

