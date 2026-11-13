import React, { useEffect } from 'react';
import { useTokenStore } from '../../store/useTokenStore';
import { Coins, Plus, AlertCircle } from 'lucide-react';

export const TokenPill: React.FC = () => {
  const { balance, isUnlimited, init, openModal } = useTokenStore();

  useEffect(() => {
    init();
  }, [init]);

  const isLow = !isUnlimited && balance <= 1;
  const isZero = !isUnlimited && balance === 0;

  return (
    <button
      type="button"
      onClick={openModal}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-colors cursor-pointer group shadow-xs ${
        isUnlimited
          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
          : isZero
          ? 'bg-rose-500/15 border-rose-500/30 text-rose-300 hover:bg-rose-500/25'
          : isLow
          ? 'bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25'
          : 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700 hover:border-slate-600'
      }`}
      title={isUnlimited ? 'Unlimited Conversions Active' : 'Click to view token balance, recharge tokens, or redeem voucher'}
      aria-label={isUnlimited ? 'Unlimited Tokens Active' : `Available Tokens: ${balance}`}
    >
      <div
        className={`w-5 h-5 rounded-md flex items-center justify-center transition-transform group-hover:scale-105 ${
          isUnlimited
            ? 'bg-emerald-500 text-slate-950 font-bold text-xs'
            : isZero
            ? 'bg-rose-500/20 text-rose-400'
            : isLow
            ? 'bg-amber-500/20 text-amber-400'
            : 'bg-blue-600 text-white'
        }`}
      >
        {isUnlimited ? '∞' : isZero ? <AlertCircle className="w-3.5 h-3.5" /> : <Coins className="w-3.5 h-3.5" />}
      </div>

      <div className="flex items-baseline gap-1">
        {isUnlimited ? (
          <>
            <span className="font-extrabold text-xs sm:text-sm tracking-tight text-emerald-300">Unlimited</span>
            <span className="text-[11px] font-medium text-emerald-400/80">Tokens</span>
          </>
        ) : (
          <>
            <span className="font-extrabold text-xs sm:text-sm tracking-tight">{balance}</span>
            <span className="text-[11px] font-medium text-slate-300">
              {balance === 1 ? 'Token' : 'Tokens'}
            </span>
          </>
        )}
      </div>

      <div className="pl-1 border-l border-slate-700 flex items-center text-blue-400 group-hover:text-blue-300 transition-colors">
        <Plus className="w-3.5 h-3.5" />
      </div>
    </button>
  );
};
