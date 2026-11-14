import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTokenStore } from '../../store/useTokenStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useUserStore } from '../../store/useUserStore';
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
  ArrowLeft,
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

export interface TokenPurchaseAreaProps {
  isModal?: boolean;
  onClose?: () => void;
}

export const TokenPurchaseArea: React.FC<TokenPurchaseAreaProps> = ({
  isModal = false,
  onClose,
}) => {
  const { balance, isUnlimited, closeModal, redeemCode } = useTokenStore();
  const { showNotification } = useNotificationStore();
  const { user, isAuthenticated, openAuthModal } = useUserStore();

  const handleClose = onClose || closeModal;

  // Active view: 'tokens' | 'software'
  const [activeTab, setActiveTab] = useState<'tokens' | 'software'>('tokens');

  // Manual email input if user is not signed in
  const [manualEmail, setManualEmail] = useState<string>('');
  const accountEmail = (user?.email || manualEmail).trim();

  // Token Purchase Selection State
  const [selectedTokens, setSelectedTokens] = useState<number>(25);
  const [customTokens, setCustomTokens] = useState<string>('25');
  const [isCustom, setIsCustom] = useState<boolean>(false);

  // Token / Software Code Activation State
  const [voucherInput, setVoucherInput] = useState<string>('');
  const [isRedeeming, setIsRedeeming] = useState<boolean>(false);
  const [redeemSuccessMsg, setRedeemSuccessMsg] = useState<string | null>(null);
  const [redeemErrorMsg, setRedeemErrorMsg] = useState<string | null>(null);

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

  const emailInfoText = accountEmail
    ? `\nAccount Email: ${accountEmail}`
    : '\nAccount Email: (Please mention your registered email)';

  const tokenPurchaseWaLink = `https://wa.me/91${WHATSAPP_SUPPORT_NUMBER}?text=${encodeURIComponent(
    `Hello Ayesha Tech Studio,\nI want to purchase ${currentTokens} conversion tokens (Rs ${currentTokens}) for Vocal Remover.${emailInfoText}\nDevice Reference: ${deviceId}`
  )}`;

  const softwarePurchaseWaLink = `https://wa.me/91${WHATSAPP_SUPPORT_NUMBER}?text=${encodeURIComponent(
    `Hello Ayesha Tech Studio,\nI want to purchase the full Lifetime Software License for Vocal Remover.${emailInfoText}\nDevice Reference: ${deviceId}`
  )}`;

  const showTokens = activeTab === 'tokens';
  const showSoftware = activeTab === 'software';

  const cardContent = (
    <div className={`w-full max-w-2xl bg-[#0C1222]/95 border border-white/[0.08] rounded-3xl shadow-2xl shadow-black/90 overflow-hidden relative flex flex-col backdrop-blur-2xl ${isModal ? 'max-h-[92vh] my-auto' : 'mx-auto'}`}>
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-white/[0.08] flex items-start justify-between bg-white/[0.03] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-blue-500/25 shrink-0">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 id="token-modal-title" className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                Conversion Tokens
              </h2>
              {isUnlimited ? (
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                  Unlimited Active
                </span>
              ) : (
                <>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                    1 Token = Rs 1
                  </span>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 font-bold hidden sm:inline-block">
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

        {isModal ? (
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        ) : (
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 hover:text-white text-xs font-semibold border border-white/10 transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </Link>
        )}
      </div>

      {/* Balanced 2-Tab Segmented Control (Side-by-Side button removed) */}
      <div className="border-b border-white/[0.08] bg-black/40 p-2 sm:p-2.5 flex justify-center shrink-0">
        <div className="grid grid-cols-2 gap-2 w-full max-w-xl mx-auto p-1 bg-slate-950/70 border border-white/[0.06] rounded-2xl shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab('tokens')}
            className={`py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'tokens'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-1 ring-blue-400/40'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            <Coins className={`w-4 h-4 ${activeTab === 'tokens' ? 'text-white' : 'text-blue-400'}`} />
            <span>Buy Tokens</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('software')}
            className={`py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'software'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-1 ring-emerald-400/40'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            <KeyRound className={`w-4 h-4 ${activeTab === 'software' ? 'text-white' : 'text-emerald-400'}`} />
            <span className="truncate">Software License & Code</span>
          </button>
        </div>
      </div>

      {/* Modal/Page Body */}
      <div className={`p-4 sm:p-6 space-y-6 flex-1 ${isModal ? 'overflow-y-auto' : ''}`}>
        {/* Active Unlimited Status Banner */}
        {isUnlimited && (
          <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-3 shadow-md shadow-emerald-950/20">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white text-sm">Unlimited Conversions Active</p>
              <p className="text-xs text-emerald-300/90 mt-1 leading-relaxed">
                Your account is activated with unlimited tokens. You can convert and separate as many songs as you wish without any conversion limits.
              </p>
            </div>
          </div>
        )}

        {/* Tab View Container */}
        <div className="w-full">
          {/* WINDOW 1: LIST OF TOKENS TO PURCHASE */}
          {showTokens && (
            <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-4 flex flex-col justify-between shadow-lg">
              <div className="space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-white">
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
                            ? 'bg-blue-600/20 border-blue-500 ring-2 ring-blue-500/30 text-white shadow-md shadow-blue-500/10'
                            : 'bg-black/30 border-white/[0.06] text-slate-300 hover:border-white/15 hover:bg-white/[0.04]'
                        }`}
                      >
                        {pack.popular && (
                          <span className="absolute -top-2 right-2 px-1.5 py-0.5 rounded-md bg-blue-600 text-[9px] font-bold text-white uppercase tracking-wider shadow-sm">
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
                <div className="p-3 rounded-xl bg-black/30 border border-white/[0.06] space-y-1.5">
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
                      className="w-24 px-3 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-white font-mono text-xs text-center focus:outline-none focus:border-blue-500 transition-colors"
                      placeholder="Tokens"
                    />
                    <span className="text-xs text-slate-300">
                      Tokens = <strong className="text-white">Rs {currentTokens} ({currentTokens} Conversions)</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Purchase Button on WhatsApp */}
              <div className="pt-2 space-y-2 border-t border-white/[0.06]">
                {/* Account Email Indicator / Input */}
                <div className="p-3 rounded-xl bg-black/40 border border-white/[0.08] space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-blue-400" />
                      <span>Account Email:</span>
                    </span>
                    {isAuthenticated && user?.email ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Linked</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openAuthModal('login')}
                        className="text-[11px] text-blue-400 hover:text-white underline cursor-pointer"
                      >
                        Sign In
                      </button>
                    )}
                  </div>

                  {isAuthenticated && user?.email ? (
                    <div className="text-xs font-mono text-white bg-slate-900/90 px-3 py-1.5 rounded-lg border border-white/10 truncate">
                      {user.email}
                    </div>
                  ) : (
                    <input
                      type="email"
                      value={manualEmail}
                      onChange={(e) => setManualEmail(e.target.value)}
                      placeholder="Enter your account email (for tokens credit)"
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  )}
                  <p className="text-[10px] text-slate-400 leading-tight">
                    This email is included in your WhatsApp message so tokens are credited to your account.
                  </p>
                </div>

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
                  className="w-full py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] active:scale-95 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/35 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 cursor-pointer no-underline"
                >
                  <MessageCircle className="w-4.5 h-4.5" />
                  <span>Purchase {currentTokens} Tokens on WhatsApp ({WHATSAPP_SUPPORT_NUMBER})</span>
                  <ExternalLink className="w-4 h-4" />
                </a>

                <p className="text-[10px] text-slate-400 text-center leading-snug">
                  Instant token recharge code delivered on WhatsApp from Ayesha Tech Studio.
                </p>

                <div className="pt-2 flex items-center justify-center border-t border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setActiveTab('software')}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-300 transition-colors cursor-pointer group"
                  >
                    <span>Already have a code or license key?</span>
                    <span className="font-bold text-blue-400 group-hover:underline">Activate Code Here &rarr;</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* WINDOW 2: TOKEN CODE & SOFTWARE LICENSE WINDOW */}
          {showSoftware && (
            <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-4 flex flex-col justify-between shadow-lg">
              <div className="space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-white">
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
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-center text-xs tracking-widest placeholder:text-slate-500 focus:outline-none focus:border-blue-500 uppercase transition-colors"
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
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white font-bold text-xs sm:text-sm disabled:opacity-50 shadow-md shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer flex items-center justify-center gap-2"
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
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/[0.06] space-y-2">
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
              <div className="pt-2 space-y-2 border-t border-white/[0.06]">
                {/* Account Email Indicator / Input */}
                <div className="p-3 rounded-xl bg-black/40 border border-white/[0.08] space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Account Email:</span>
                    </span>
                    {isAuthenticated && user?.email ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Linked</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openAuthModal('login')}
                        className="text-[11px] text-blue-400 hover:text-white underline cursor-pointer"
                      >
                        Sign In
                      </button>
                    )}
                  </div>

                  {isAuthenticated && user?.email ? (
                    <div className="text-xs font-mono text-white bg-slate-900/90 px-3 py-1.5 rounded-lg border border-white/10 truncate">
                      {user.email}
                    </div>
                  ) : (
                    <input
                      type="email"
                      value={manualEmail}
                      onChange={(e) => setManualEmail(e.target.value)}
                      placeholder="Enter your account email (for license delivery)"
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  )}
                  <p className="text-[10px] text-slate-400 leading-tight">
                    This email is included in your WhatsApp message for immediate software license activation.
                  </p>
                </div>

                <a
                  href={softwarePurchaseWaLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] active:scale-95 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/35 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 cursor-pointer no-underline"
                >
                  <MessageCircle className="w-4.5 h-4.5" />
                  <span>Purchase Software License on WhatsApp ({WHATSAPP_SUPPORT_NUMBER})</span>
                  <ExternalLink className="w-4 h-4" />
                </a>

                <p className="text-[10px] text-slate-400 text-center leading-snug">
                  Contact WhatsApp ({WHATSAPP_SUPPORT_NUMBER}) for immediate software license activation.
                </p>

                <div className="pt-2 flex items-center justify-center border-t border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setActiveTab('tokens')}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-300 transition-colors cursor-pointer group"
                  >
                    <span>Need to purchase conversion tokens instead?</span>
                    <span className="font-bold text-emerald-400 group-hover:underline">&larr; Buy Tokens</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Support Information & Device Reference */}
        <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2 text-[11px] text-slate-400">
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
          <div className="pt-1.5 border-t border-white/[0.06] flex items-center justify-between">
            <span>Device Reference:</span>
            <code className="text-slate-300 font-mono text-[10px] bg-black/60 px-2 py-0.5 rounded-md border border-white/10">
              {deviceId}
            </code>
          </div>
        </div>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="token-modal-title"
      >
        {cardContent}
      </div>
    );
  }

  return cardContent;
};

export const BuyTokensModal: React.FC = () => {
  const { isModalOpen, closeModal } = useTokenStore();
  if (!isModalOpen) return null;
  return <TokenPurchaseArea isModal={true} onClose={closeModal} />;
};
