import React, { useState, useEffect } from 'react';
import { useUserStore } from '../../store/useUserStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import {
  X,
  User,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    authModalAction,
    closeAuthModal,
    login,
    register,
    pendingFile,
  } = useUserStore();
  const { showNotification } = useNotificationStore();

  const [selectedTab, setSelectedTab] = useState<'login' | 'register' | null>(null);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mode = selectedTab ?? authModalAction;

  const handleClose = () => {
    setSelectedTab(null);
    setErrorMessage(null);
    closeAuthModal();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAuthModalOpen) {
        setSelectedTab(null);
        setErrorMessage(null);
        closeAuthModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthModalOpen, closeAuthModal]);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      if (mode === 'login') {
        const res = await login(email, password);
        setIsLoading(false);
        if (res.success) {
          showNotification({
            type: 'success',
            title: 'Signed In',
            message: res.message,
          });
          setEmail('');
          setPassword('');
        } else {
          setErrorMessage(res.message);
        }
      } else {
        const res = await register(email, password, name);
        setIsLoading(false);
        if (res.success) {
          showNotification({
            type: 'success',
            title: 'Account Created',
            message: res.message,
          });
          setEmail('');
          setPassword('');
          setName('');
        } else {
          setErrorMessage(res.message);
        }
      }
    } catch (err) {
      setIsLoading(false);
      setErrorMessage(err instanceof Error ? err.message : 'An error occurred during authentication.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className="w-full max-w-md bg-[#0D1527] border border-slate-800 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden relative my-auto">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800/80 flex items-start justify-between bg-slate-900/60">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 id="auth-modal-title" className="text-base sm:text-lg font-bold text-white tracking-tight">
                {mode === 'login' ? 'Sign In to Your Account' : 'Create Your Free Account'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {pendingFile
                  ? `Sign in to process "${pendingFile.name}"`
                  : 'Access your tokens, songs, and karaoke tracks.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer shrink-0"
            aria-label="Close authentication modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher - Segmented Pill Control */}
        <div className="px-5 pt-4 pb-1 sm:px-6">
          <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-900 border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setSelectedTab('login');
                setErrorMessage(null);
              }}
              className={`py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedTab('register');
                setErrorMessage(null);
              }}
              className={`py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Create Account
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4">
          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'register' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 block">Your Name (Optional)</label>
                <div className="flex items-center w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                  <User className="w-4 h-4 text-slate-400 shrink-0 mr-3 pointer-events-none" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. John Producer"
                    className="w-full bg-transparent border-0 p-0 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">Email Address</label>
              <div className="flex items-center w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                <Mail className="w-4 h-4 text-slate-400 shrink-0 mr-3 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-transparent border-0 p-0 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">Password</label>
              <div className="flex items-center w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                <Lock className="w-4 h-4 text-slate-400 shrink-0 mr-3 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Minimum 6 characters' : 'Enter password'}
                  className="w-full bg-transparent border-0 p-0 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 text-slate-400 hover:text-white shrink-0 ml-2 cursor-pointer transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="leading-snug">{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !email.trim() || !password.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{mode === 'login' ? 'Signing In...' : 'Creating Account...'}</span>
                </>
              ) : (
                <>
                  <span>{mode === 'login' ? 'Sign In' : 'Create Free Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Local Security Assurance */}
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>100% private &bull; Audio stays on your device</span>
          </div>

          {/* Toggle between Login and Register */}
          <div className="pt-2 text-center border-t border-slate-800/80 text-xs text-slate-400">
            {mode === 'login' ? (
              <p>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTab('register');
                    setErrorMessage(null);
                  }}
                  className="text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-2 cursor-pointer transition-colors"
                >
                  Create one now
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTab('login');
                    setErrorMessage(null);
                  }}
                  className="text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-2 cursor-pointer transition-colors"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
