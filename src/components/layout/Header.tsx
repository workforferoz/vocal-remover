import React from 'react';
import { Link } from 'react-router-dom';
import { usePWA } from '../../hooks/usePWA';
import {
  Music,
  Sparkles,
} from 'lucide-react';

export const Header: React.FC = () => {
  const { hasUpdate, applyUpdate } = usePWA();

  return (
    <>
      {/* PWA Update notification banner */}
      {hasUpdate && (
        <div className="bg-gradient-to-r from-[#7357F5] to-[#3984FF] text-white px-4 py-1.5 text-xs font-medium flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <span>A new version is ready.</span>
          </div>
          <button
            onClick={applyUpdate}
            className="px-2.5 py-0.5 rounded bg-white text-slate-900 font-semibold text-[11px] hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Update & Reload
          </button>
        </div>
      )}

      <header className="h-16 bg-[#101827]/90 backdrop-blur-md border-b border-white/10 sticky top-0 z-20 px-4 sm:px-8 flex items-center justify-between gap-4">
        {/* Left: Brand Logo & Title */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#7357F5] to-[#3984FF] flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <Music className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-base sm:text-lg text-white tracking-tight leading-tight">
              Vocal Remover
            </span>
          </div>
        </Link>

        {/* Right: Karoke Maker by Ayesha Tech Studio button */}
        <div className="flex items-center">
          <a
            href="https://www.karokemaker.online/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 transition-all shadow-xs group cursor-pointer"
            title="Open Karoke Maker by Ayesha Tech Studio"
          >
            <div className="w-9 h-9 rounded-xl overflow-hidden bg-black/40 flex items-center justify-center flex-shrink-0 shadow-xs ring-1 ring-white/10 group-hover:scale-105 transition-transform">
              <img
                src="/karaoke-logo.png"
                alt="Karoke Maker"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col text-left justify-center">
              <span className="font-extrabold text-sm sm:text-base text-white tracking-tight leading-tight">
                Karoke Maker
              </span>
              <span className="text-[10px] sm:text-[11px] text-slate-300 font-medium leading-tight">
                by Ayesha Tech Studio
              </span>
            </div>
          </a>
        </div>
      </header>
    </>
  );
};
