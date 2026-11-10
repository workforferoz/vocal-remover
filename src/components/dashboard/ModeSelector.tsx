import React from 'react';
import type { ProcessingMode } from '../../types';
import { Zap, Cpu, Layers, Check, AlertCircle } from 'lucide-react';

interface ModeSelectorProps {
  selectedMode: ProcessingMode;
  onSelectMode: (mode: ProcessingMode) => void;
  showHonestNotice?: boolean;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  selectedMode,
  onSelectMode,
  showHonestNotice = true,
}) => {
  const modes: {
    id: ProcessingMode;
    title: string;
    subtitle: string;
    description: string;
    icon: typeof Zap;
    badge: string;
    badgeType: 'ready' | 'stage2' | 'stage3';
    requirements: string;
    outputs: string[];
  }[] = [
    {
      id: 'quick-local',
      title: 'Quick Local',
      subtitle: 'Browser Stereo Processing',
      description: 'Basic stereo-based vocal reduction running entirely inside your browser. Instant preview with zero model downloads.',
      icon: Zap,
      badge: 'Available Now',
      badgeType: 'ready',
      requirements: 'Any modern browser (No AI model)',
      outputs: ['Vocals (Reduced)', 'Instrumental Center-Cut'],
    },
    {
      id: 'ai-pro',
      title: 'AI Professional',
      subtitle: '2-Stem Neural Separation',
      description: 'High-fidelity deep neural network model isolating lead vocals and full backing tracks with minimal artifacting.',
      icon: Cpu,
      badge: 'Demucs Neural AI',
      badgeType: 'stage2',
      requirements: 'Requires Local Python Engine (Demucs htdemucs)',
      outputs: ['Lead Vocals', 'Full Instrumental'],
    },
    {
      id: 'multi-stem',
      title: 'Multi-Stem',
      subtitle: '4-Stem Instrument Isolation',
      description: 'Advanced multi-track separation dividing the arrangement into discrete audio stems: drums, bass, vocals, and other instruments.',
      icon: Layers,
      badge: 'Demucs 4-Stem AI',
      badgeType: 'stage3',
      requirements: 'Requires Demucs 4-Stem Model + Python Engine',
      outputs: ['Vocals', 'Drums', 'Bass', 'Other Instruments'],
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white tracking-tight">Processing Mode</h3>
          <p className="text-xs text-slate-400">Choose how Vocal Studio AI will analyze and separate your audio tracks.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {modes.map((mode) => {
          const isSelected = selectedMode === mode.id;
          const Icon = mode.icon;

          let badgeColor = 'bg-[#16C784]/10 text-[#16C784] border-[#16C784]/30';
          if (mode.badgeType === 'stage2') {
            badgeColor = 'bg-[#7357F5]/10 text-[#7357F5] border-[#7357F5]/30';
          } else if (mode.badgeType === 'stage3') {
            badgeColor = 'bg-[#3984FF]/10 text-[#3984FF] border-[#3984FF]/30';
          }

          return (
            <div
              key={mode.id}
              onClick={() => onSelectMode(mode.id)}
              className={`relative rounded-2xl p-5 border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'bg-[#182338] border-[#7357F5] shadow-[0_0_25px_-5px_rgba(115,87,245,0.3)] ring-1 ring-[#7357F5]/50'
                  : 'bg-[#151F30] border-white/10 hover:border-white/20 hover:bg-[#182436]'
              }`}
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectMode(mode.id);
                }
              }}
            >
              {/* Top row */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    isSelected
                      ? 'bg-gradient-to-r from-[#7357F5] to-[#3984FF] text-white shadow-md'
                      : 'bg-white/5 border border-white/10 text-slate-400'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${badgeColor}`}>
                  {mode.badge}
                </span>
              </div>

              {/* Title & Description */}
              <div className="flex-1 mb-4">
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-semibold text-white tracking-tight">{mode.title}</h4>
                  {isSelected && (
                    <div className="w-4 h-4 rounded-full bg-[#7357F5] flex items-center justify-center text-white">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-[#3984FF] font-medium mt-0.5">{mode.subtitle}</p>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">{mode.description}</p>
              </div>

              {/* Stems pills & Requirements */}
              <div className="pt-3 border-t border-white/5 flex flex-col gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {mode.outputs.map((stem) => (
                    <span
                      key={stem}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-[#101827] text-slate-300 border border-white/5"
                    >
                      {stem}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-1">
                  <span>⚙️ {mode.requirements}</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {showHonestNotice && selectedMode !== 'quick-local' && (
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs animate-in fade-in">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
          <div className="leading-relaxed">
            <span className="font-semibold text-white">Stage 1 Notice: </span>
            The <strong>{selectedMode === 'ai-pro' ? 'AI Professional' : 'Multi-Stem'}</strong> engine connects to the
            local Python Demucs daemon being integrated in Stage 2. In this Stage 1 release, project metadata and parameters
            will be configured and queued locally in IndexedDB without running simulated or fake AI files.
          </div>
        </div>
      )}
    </div>
  );
};

