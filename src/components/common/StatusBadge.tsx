import React from 'react';
import type { JobStatus } from '../../types';
import { Clock, CheckCircle2, AlertOctagon, XCircle, Loader2, FileQuestion } from 'lucide-react';

interface StatusBadgeProps {
  status: JobStatus | 'online' | 'offline' | 'standby';
  size?: 'sm' | 'md';
  customLabel?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm', customLabel }) => {
  const isSmall = size === 'sm';
  const sizeClasses = isSmall ? 'text-xs px-2 py-0.5' : 'text-xs px-3 py-1 font-medium';

  switch (status) {
    case 'completed':
    case 'online':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-[#16C784]/10 text-[#16C784] border border-[#16C784]/30 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#16C784] animate-pulse"></span>
          <CheckCircle2 className="w-3 h-3" />
          <span>{customLabel || (status === 'online' ? 'Online' : 'Completed')}</span>
        </span>
      );

    case 'processing':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-[#7357F5]/15 text-[#7357F5] border border-[#7357F5]/30 ${sizeClasses}`}
        >
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>{customLabel || 'Processing'}</span>
        </span>
      );

    case 'queued':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-[#3984FF]/10 text-[#3984FF] border border-[#3984FF]/30 ${sizeClasses}`}
        >
          <Clock className="w-3 h-3" />
          <span>{customLabel || 'In Queue'}</span>
        </span>
      );

    case 'failed':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 ${sizeClasses}`}
        >
          <AlertOctagon className="w-3 h-3" />
          <span>{customLabel || 'Failed'}</span>
        </span>
      );

    case 'cancelled':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-slate-500/15 text-slate-400 border border-slate-500/30 ${sizeClasses}`}
        >
          <XCircle className="w-3 h-3" />
          <span>{customLabel || 'Cancelled'}</span>
        </span>
      );

    case 'standby':
    case 'draft':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-slate-800 text-slate-300 border border-white/10 ${sizeClasses}`}
        >
          <FileQuestion className="w-3 h-3 text-slate-400" />
          <span>{customLabel || (status === 'standby' ? 'Standby' : 'Draft')}</span>
        </span>
      );
  }
};

