import React from 'react';
import { PlusCircle, Sparkles, Cpu, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface WelcomeSectionProps {
  projectCount: number;
}

export const WelcomeSection: React.FC<WelcomeSectionProps> = ({ projectCount }) => {
  const navigate = useNavigate();

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#151F30] via-[#121c2e] to-[#101827] border border-white/10 p-6 sm:p-8 shadow-2xl">
      {/* Decorative ambient background glows */}
      <div className="absolute -top-24 -right-24 w-80 h-80 bg-[#7357F5]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-[#3984FF]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#7357F5]/10 border border-[#7357F5]/30 text-xs font-medium text-[#7357F5] mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Stage 1 Foundation • Low-Latency Audio Architecture</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight">
            Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#7357F5] via-[#3984FF] to-[#16C784]">Vocal Studio AI</span>
          </h1>
          <p className="text-sm text-slate-300 mt-2 leading-relaxed">
            Professional source-separation engineered for karaoke producers, musicians, DJs and vocalists.
            Isolate pristine vocal tracks, instruments, basslines and drums directly on your workstation with zero cloud uploads.
          </p>

          {/* Key capability pills */}
          <div className="flex flex-wrap items-center gap-4 mt-5 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#16C784]" />
              <span>100% Private & Local</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-[#3984FF]" />
              <span>Optimized for Low-Spec PCs</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#7357F5]" />
              <span>{projectCount} {projectCount === 1 ? 'Project' : 'Projects'} Saved</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex-shrink-0 w-full sm:w-auto">
          <button
            onClick={() => navigate('/new')}
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#7357F5] to-[#3984FF] text-white font-semibold text-sm shadow-xl hover:shadow-indigo-500/25 active:scale-95 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
          >
            <PlusCircle className="w-5 h-5" />
            <span>New Separation</span>
          </button>
        </div>
      </div>
    </div>
  );
};

