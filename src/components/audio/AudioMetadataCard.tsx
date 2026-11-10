import React from 'react';
import type { AudioMetadata } from '../../types';
import { formatDuration, formatFileSize } from '../../services/audioMetadata';
import { Music, Radio, HardDrive, Clock, Activity } from 'lucide-react';

interface AudioMetadataCardProps {
  fileName: string;
  metadata: AudioMetadata;
  className?: string;
}

export const AudioMetadataCard: React.FC<AudioMetadataCardProps> = ({
  fileName,
  metadata,
  className = '',
}) => {
  return (
    <div
      className={`bg-[#151F30] border border-white/10 rounded-2xl p-5 shadow-lg flex flex-col gap-4 ${className}`}
    >
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Music className="w-4 h-4 text-[#7357F5] flex-shrink-0" />
          <h4 className="text-sm font-semibold text-white truncate">{fileName}</h4>
        </div>
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#7357F5]/20 text-[#7357F5] border border-[#7357F5]/30">
          {metadata.format}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-[#101827]/80 rounded-xl p-3 border border-white/5 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Duration</span>
          </div>
          <span className="font-mono text-sm font-semibold text-white">
            {formatDuration(metadata.duration)}
          </span>
        </div>

        <div className="bg-[#101827]/80 rounded-xl p-3 border border-white/5 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-slate-400">
            <HardDrive className="w-3.5 h-3.5 text-slate-400" />
            <span>File Size</span>
          </div>
          <span className="font-mono text-sm font-semibold text-white">
            {formatFileSize(metadata.fileSize)}
          </span>
        </div>

        <div className="bg-[#101827]/80 rounded-xl p-3 border border-white/5 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Radio className="w-3.5 h-3.5 text-slate-400" />
            <span>Sample Rate</span>
          </div>
          <span className="font-mono text-sm font-semibold text-white">
            {metadata.sampleRate ? `${(metadata.sampleRate / 1000).toFixed(1)} kHz` : '44.1 kHz'}
          </span>
        </div>

        <div className="bg-[#101827]/80 rounded-xl p-3 border border-white/5 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Activity className="w-3.5 h-3.5 text-slate-400" />
            <span>Channels / Rate</span>
          </div>
          <span className="font-mono text-sm font-semibold text-white">
            {metadata.channels === 1 ? 'Mono' : 'Stereo'}
            {metadata.bitrateKbps ? ` • ${metadata.bitrateKbps}k` : ''}
          </span>
        </div>
      </div>
    </div>
  );
};

