import React from 'react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { Music, ArrowLeft, FolderKanban } from 'lucide-react';

export const NotFound: React.FC = () => {
  usePageMeta(
    '404 - Page Not Found | Vocal Remover',
    'The requested page could not be found. Return to Vocal Remover to extract vocals and instrumental tracks.'
  );

  return (
    <div className="min-h-[60vh] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md bg-[#0F172A] border border-slate-800 rounded-3xl p-8 sm:p-10 text-center shadow-xl space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-blue-600/15 border border-blue-500/30 text-blue-400 flex items-center justify-center mx-auto">
          <Music className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-blue-400">
            Error 404
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Page Not Found
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed max-w-sm mx-auto">
            The page you are looking for does not exist, has been removed, or the link is incorrect.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/"
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>
          <Link
            to="/projects"
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition-colors flex items-center justify-center gap-2"
          >
            <FolderKanban className="w-4 h-4" />
            <span>My Songs</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

