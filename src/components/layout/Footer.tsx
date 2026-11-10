import React from 'react';
import { Download, Sparkles, Zap } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-white/10 bg-[#0d1527]/80 backdrop-blur-md py-6 px-4 sm:px-8 mt-auto">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* 3 Feature Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs text-slate-400">
          <div className="p-3.5 rounded-2xl bg-[#101827] border border-white/10 flex items-center gap-3 shadow-xs">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-white">Instant Download</p>
              <p className="text-[11px] text-slate-400">Download clean instrumental in 16-bit WAV</p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#101827] border border-white/10 flex items-center gap-3 shadow-xs">
            <div className="w-8 h-8 rounded-xl bg-[#7357F5]/10 text-[#7357F5] flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-white">AI Vocal Removal</p>
              <p className="text-[11px] text-slate-400">High fidelity vocal and music isolation</p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#101827] border border-white/10 flex items-center gap-3 shadow-xs">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-white">Private & Secure</p>
              <p className="text-[11px] text-slate-400">Audio processed safely and directly</p>
            </div>
          </div>
        </div>

        <div className="text-center text-xs text-slate-400 pt-3 border-t border-white/5">
          Designed and developed by <span className="text-white font-medium">Ayesha Tech Studio</span>
        </div>
      </div>
    </footer>
  );
};

