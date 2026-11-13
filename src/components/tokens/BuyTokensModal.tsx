import React, { useState } from 'react';
import { useTokenStore } from '../../store/useTokenStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import {
  WHATSAPP_SUPPORT_NUMBER,
  getOrCreateDeviceId,
} from '../../services/tokenService';
import { sanitizeCode } from '../../utils/sanitize';
import {
  X,
  Coins,
  MessageCircle,
  ExternalLink,
  ArrowRight,
  AlertCircle,
  KeyRound,
  CheckCircle2,
  Phone,
  Mail,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';

interface TokenPack {
  tokens: number;
  label: string;
  popular?: boolean;
  tagline: string;
}

const TOKEN_PACKS: TokenPack[] = [
  { tokens: 10, label: 'Starter Pack', tagline: '10 Song Conversions' },
  { tokens: 25, label: 'Most Popular', popular: true, tagline: '25 Song Conversions' },
  { tokens: 50, label: 'Creator Pack', tagline: '50 Song Conversions' },
  { tokens: 100, label: 'Studio Master', tagline: '100 Song Conversions' },
];

export const BuyTokensModal: React.FC = () => {
  const { balance, isUnlimited, isModalOpen, closeModal, redeemCode } = useTokenStore();
  const { showNotification } = useNotificationStore();

  // Active view: 'both' | 'tokens' | 'software'
  const [activeTab, setActiveTab] = useState<'both' | 'tokens' | 'software'>('both');

  // Token Purchase Selection State
  const [selectedTokens, setSelectedTokens] = useState<number>(25);
  const [customTokens, setCustomTokens] = useState<string>('25');
  const [isCustom, setIsCustom] = useState<boolean>(false);

  // Token / Software Code Activation State
  const [voucherInput, setVoucherInput] = useState<string>('');
  const [isRedeeming, setIsRedeeming] = useState<boolean>(false);
  const [redeemSuccessMsg, setRedeemSuccessMsg] = useState<string | null>(null);
  const [redeemErrorMsg, setRedeemErrorMsg] = useState<string | null>(null);

  if (!isModalOpen) return null;

  const currentTokens = isCustom
    ? Math.max(1, parseInt(customTokens || '10', 10) || 10)
    : selectedTokens;

  const handleSelectPack = (tokens: number) => {
    setIsCustom(false);
    setSelectedTokens(tokens);
    setCustomTokens(String(tokens));
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsCustom(true);
    setCustomTokens(e.target.value);
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voucherInput.trim()) return;

    setIsRedeeming(true);
    setRedeemErrorMsg(null);
    setRedeemSuccessMsg(null);

    const res = await redeemCode(voucherInput.trim());
    setIsRedeeming(false);

    if (res.success) {
      setRedeemSuccessMsg(res.message);
      showNotification({
        type: 'success',
        title: 'Activated Successfully',
        message: res.message,
      });
      setVoucherInput('');
    } else {
      setRedeemErrorMsg(res.message);
      showNotification({
        type: 'error',
        title: 'Activation Failed',
        message: res.message,
      });
    }
  };

  const deviceId = getOrCreateDeviceId();

  const tokenPurchaseWaLink = `https://wa.me/91${WHATSAPP_SUPPORT_NUMBER}?text=${encodeURIComponent(
    `Hello Ayesha Tech Studio, I want to purchase ${currentTokens} conversion tokens for Vocal Remover.`
  )}`;

  const softwarePurchaseWaLink = `https://wa.me/91${WHATSAPP_SUPPORT_NUMBER}?text=${encodeURIComponent(
    'Hello Ayesha Tech Studio, I want to purchase the full Lifetime Software License for Vocal Remover.'
  )}`;

  const showTokens = activeTab === 'both' || activeTab === 'tokens';
  const showSoftware = activeTab === 'both' || activeTab === 'software';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="token-modal-title"
    >
      <div className="w-full max-w-4xl bg-[#0F172A] border border-slate-800 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden relative my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-start justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="token-modal-title" className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Conversion Tokens
                </h2>
                {isUnlimited ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                    Unlimited Active
                  </span>
                ) : (
                  <>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                      1 Token = Rs 1
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/30 font-semibold hidden sm:inline-block">
                      1 Conversion = 1 Token
                    </span>
                  </>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {isUnlimited ? (
                  <span className="text-emerald-400 font-bold">Unlimited Tokens Active &bull; No conversion limit</span>
                ) : (
                  <span>
                    Current Balance: <strong className="text-white font-bold">{balance} Tokens</strong> (1 Conversion = 1 Token)
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher: Move between Purchase Tokens and Software / Code */}
        <div className="flex border-b border-slate-800 bg-[#0B1120] p-1.5 sm:p-2 gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('tokens')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'tokens'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Coins className="w-4 h-4 text-blue-400" />
            <span>Buy Tokens</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('software')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'software'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <KeyRound className="w-4 h-4 text-emerald-400" />
            <span>Software License & Token Code</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('both')}
            className={`hidden md:flex py-2 px-4 rounded-xl text-xs sm:text-sm font-bold items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'both'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
            title="Display side by side"
          >
            <span>Side-by-Side</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Active Unlimited Status Banner */}
          {isUnlimited && (
            <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-white text-sm">Unlimited Conversions Active</p>
                <p className="text-xs text-emerald-300/90 mt-1 leading-relaxed">
                  Your account is activated with unlimited tokens. You can convert and separate as many songs as you wish without any conversion limits.
                </p>
              </div>
            </div>
          )}

          {/* Windows Grid: Side-by-Side on desktop when activeTab === 'both', or tabbed */}
          <div
            className={`grid gap-6 ${
              activeTab === 'both' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
            }`}
          >
            {/* WINDOW 1: LIST OF TOKENS TO PURCHASE */}
            {showTokens && (
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-white">
                        Purchase Conversion Tokens
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Choose a token pack for song conversions (1 Song = 1 Token).
                      </p>
                    </div>
                  </div>

                  {/* Token Packs Selection Grid */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {TOKEN_PACKS.map((pack) => {
                      const isSelected = !isCustom && selectedTokens === pack.tokens;
                      return (
                        <button
                          key={pack.tokens}
                          type="button"
                          onClick={() => handleSelectPack(pack.tokens)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                            isSelected
                              ? 'bg-blue-600/20 border-blue-500 ring-2 ring-blue-500/30 text-white shadow-sm'
                              : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/80'
                          }`}
                        >
                          {pack.popular && (
                            <span className="absolute -top-2 right-2 px-1.5 py-0.5 rounded-md bg-blue-600 text-[9px] font-bold text-white uppercase tracking-wider">
                              Popular
                            </span>
                          )}
                          <div className="flex items-baseline justify-between">
                            <div className="text-sm sm:text-base font-extrabold text-white">
                              {pack.tokens} Tokens
                            </div>
                            <div className="text-xs font-bold text-emerald-400">
                              Rs {pack.tokens}
                            </div>
                          </div>
                          <div className="text-[11px] text-blue-300 font-semibold mt-0.5">
                            {pack.label}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {pack.tagline}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Tokens Input */}
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                    <span className="text-[11px] text-slate-300 font-semibold block">
                      Or custom amount:
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={customTokens}
                        onChange={handleCustomChange}
                        className="w-24 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs text-center focus:outline-none focus:border-blue-500"
                        placeholder="Tokens"
                      />
                      <span className="text-xs text-slate-300">
                        Tokens = <strong className="text-white">Rs {currentTokens} ({currentTokens} Conversions)</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Purchase Button on WhatsApp */}
                <div className="pt-2 space-y-2 border-t border-slate-800">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span>Selected Pack:</span>
                    <strong className="text-white font-extrabold text-sm">
                      {currentTokens} Tokens (Rs {currentTokens})
                    </strong>
                  </div>

                  <a
                    href={tokenPurchaseWaLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] active:bg-[#1caa4f] text-white font-bold text-xs sm:text-sm shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer no-underline"
                  >
                    <MessageCircle className="w-4.5 h-4.5" />
                    <span>Purchase {currentTokens} Tokens on WhatsApp ({WHATSAPP_SUPPORT_NUMBER})</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>

                  <p className="text-[10px] text-slate-400 text-center leading-snug">
                    Instant token recharge code delivered on WhatsApp from Ayesha Tech Studio.
                  </p>
                </div>
              </div>
            )}

            {/* WINDOW 2: TOKEN CODE & SOFTWARE LICENSE WINDOW */}
            {showSoftware && (
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-white">
                        Software License & Token Code
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Activate your voucher code or lifetime software license key.
                      </p>
                    </div>
                  </div>

                  {/* Token / License Code Activation Form */}
                  <form onSubmit={handleRedeem} className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-200 block">
                        Recharge Code or 16-Digit Software Key
                      </label>
                      <input
                        type="text"
                        value={voucherInput}
                        onChange={(e) => {
                          setVoucherInput(sanitizeCode(e.target.value, 32));
                          setRedeemErrorMsg(null);
                          setRedeemSuccessMsg(null);
                        }}
                        placeholder="TOK10-XXXX-XXXX or XXXX-XXXX-XXXX-XXXX"
                        disabled={isRedeeming}
                        maxLength={32}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-center text-xs tracking-widest placeholder:text-slate-500 focus:outline-none focus:border-blue-500 uppercase"
                      />
                    </div>

                    {redeemErrorMsg && (
                      <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{redeemErrorMsg}</span>
                      </div>
                    )}

                    {redeemSuccessMsg && (
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                        <span>{redeemSuccessMsg}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isRedeeming || !voucherInput.trim()}
                      className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-xs sm:text-sm disabled:opacity-50 transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isRedeeming ? (
                        <span>Activating...</span>
                      ) : (
                        <>
                          <span>Activate Unlimited Software / Tokens</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>

                  {/* Buy Permanent Software License Section */}
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-white">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Want Permanent Lifetime Software?</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Unlock unlimited song conversions forever on your device with no token limits.
                    </p>
                  </div>
                </div>

                {/* Purchase Full Software on WhatsApp Button */}
                <div className="pt-2 space-y-2 border-t border-slate-800">
                  <a
                    href={softwarePurchaseWaLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] active:bg-[#1caa4f] text-white font-bold text-xs sm:text-sm shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer no-underline"
                  >
                    <MessageCircle className="w-4.5 h-4.5" />
                    <span>Purchase Software License on WhatsApp ({WHATSAPP_SUPPORT_NUMBER})</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>

                  <p className="text-[10px] text-slate-400 text-center leading-snug">
                    Contact WhatsApp ({WHATSAPP_SUPPORT_NUMBER}) for immediate software license activation.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Support Information & Device Reference */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2 text-[11px] text-slate-400">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <a
                  href={`tel:+91${WHATSAPP_SUPPORT_NUMBER}`}
                  className="inline-flex items-center gap-1 hover:text-white transition-colors"
                  title="Direct Phone Call"
                >
                  <Phone className="w-3 h-3 text-slate-400" />
                  <span>+91 {WHATSAPP_SUPPORT_NUMBER}</span>
                </a>
                <a
                  href="mailto:ayeshatechstudio@gmail.com"
                  className="inline-flex items-center gap-1 hover:text-white transition-colors"
                  title="Email Support"
                >
                  <Mail className="w-3 h-3 text-slate-400" />
                  <span>ayeshatechstudio@gmail.com</span>
                </a>
              </div>
              <div className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                <span>100% Private On-Device Processing</span>
              </div>
            </div>
            <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between">
              <span>Device Reference:</span>
              <code className="text-slate-300 font-mono text-[10px] bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                {deviceId}
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
