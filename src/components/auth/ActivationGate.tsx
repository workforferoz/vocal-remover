import React, { useState } from 'react';
import {
  formatLicenseKeyInput,
  activateLicense,
} from '../../services/licenseService';
import {
  KeyRound,
  ShieldCheck,
  MessageCircle,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Lock,
} from 'lucide-react';

interface ActivationGateProps {
  onSuccess: () => void;
}

export const ActivationGate: React.FC<ActivationGateProps> = ({ onSuccess }) => {
  const [code, setCode] = useState<string>('');
  const [isActivating, setIsActivating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    setCode(formatLicenseKeyInput(e.target.value));
  };

  const handleActivate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (code.replace(/-/g, '').length < 16) {
      setErrorMsg('Please enter all 16 digits of your license key.');
      return;
    }

    setIsActivating(true);
    setErrorMsg(null);

    const result = await activateLicense(code);
    setIsActivating(false);

    if (result.success) {
      setIsSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1000);
    } else {
      setErrorMsg(result.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B1120] flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-[#0F172A] border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-6">
        {/* Header Icon & Brand */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto shadow-sm">
            {isSuccess ? (
              <CheckCircle2 className="w-7 h-7 text-white" />
            ) : (
              <Lock className="w-7 h-7 text-white" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Activate Vocal Remover
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              Enter your 16-digit license code to unlock and use the application.
            </p>
          </div>
        </div>

        {/* Activation Form */}
        <form onSubmit={handleActivate} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-blue-400" />
              <span>16-Digit License Code</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={code}
                onChange={handleInputChange}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                maxLength={19}
                autoFocus
                disabled={isActivating || isSuccess}
                className="w-full px-4 py-3.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-center text-base sm:text-lg tracking-widest placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success Message */}
          {isSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>License verified! Launching software...</span>
            </div>
          )}

          {/* Activate Button */}
          <button
            type="submit"
            disabled={isActivating || isSuccess || code.replace(/-/g, '').length < 16}
            className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm tracking-wide shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{isActivating ? 'Verifying Code...' : 'Activate Software'}</span>
          </button>
        </form>

        {/* Divider */}
        <div className="relative flex items-center justify-center">
          <div className="border-t border-slate-800 w-full" />
          <span className="bg-[#0F172A] px-3 text-[11px] text-slate-400 uppercase tracking-wider">
            Need a license?
          </span>
        </div>

        {/* Purchase License Code Option via WhatsApp */}
        <div className="p-4 rounded-2xl bg-[#25D366]/10 border border-[#25D366]/30 text-center space-y-2.5">
          <div>
            <p className="text-xs font-semibold text-white">
              Don't have a 16-digit license code yet?
            </p>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Contact us on WhatsApp to buy your lifetime code:
            </p>
          </div>
          <a
            href="https://wa.me/919743247790?text=Hello%2C%20I%20want%20to%20purchase%20a%2016-digit%20license%20code%20for%20Vocal%20Remover."
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-bold transition-all shadow-md shadow-[#25D366]/20 group cursor-pointer"
          >
            <MessageCircle className="w-4 h-4 fill-current group-hover:scale-110 transition-transform flex-shrink-0" />
            <span>WhatsApp to 9743247790</span>
            <ExternalLink className="w-3.5 h-3.5 text-white" />
          </a>
        </div>

        {/* Features / Benefits */}
        <div className="space-y-1.5 text-[11px] text-slate-400 pt-1">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#16C784]" />
            <span>Lifetime offline access on this device once activated</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#16C784]" />
            <span>Unlimited vocal removal and instrumental WAV downloads</span>
          </div>
        </div>

        {/* Footer Credit */}
        <div className="text-center text-[10px] text-slate-500 border-t border-white/5 pt-3">
          Designed and developed by <span className="text-slate-400 font-medium">Ayesha Tech Studio</span>
        </div>
      </div>
    </div>
  );
};

