import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, X } from 'lucide-react';

const STORAGE_KEY_CONSENT = 'vocal_remover_cookie_consent';

export const CookieConsentBanner: React.FC = () => {
  const [showBanner, setShowBanner] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const consent = localStorage.getItem(STORAGE_KEY_CONSENT);
      return !consent;
    } catch {
      return false;
    }
  });

  const handleAcceptEssential = () => {
    try {
      localStorage.setItem(STORAGE_KEY_CONSENT, 'essential_accepted');
    } catch {
      // fallback
    }
    setShowBanner(false);
  };

  const handleDeclineAll = () => {
    try {
      localStorage.setItem(STORAGE_KEY_CONSENT, 'declined');
    } catch {
      // fallback
    }
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div
      role="region"
      aria-label="Privacy and Storage Notice"
      className="fixed bottom-0 inset-x-0 z-50 p-4 sm:p-5 bg-[#0F172A] border-t border-slate-700 shadow-2xl animate-in slide-in-from-bottom duration-200"
    >
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 flex-1">
          <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <p className="text-xs sm:text-sm font-bold text-white tracking-tight">
              Privacy & Local Storage Notice
            </p>
            <p className="text-xs text-slate-300 leading-relaxed">
              We only use essential local browser storage to keep track of your conversion tokens, settings, and
              audio stems on this device. We do not use third-party tracking cookies, advertise, or sell your data.
              Read our{' '}
              <Link to="/privacy" className="text-blue-400 hover:text-blue-300 underline font-medium">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={handleDeclineAll}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-hidden"
          >
            Decline Non-Essential
          </button>
          <button
            type="button"
            onClick={handleAcceptEssential}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-hidden"
          >
            Accept Essential Storage
          </button>
          <button
            type="button"
            onClick={handleAcceptEssential}
            aria-label="Dismiss banner"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer md:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
