import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePWA } from '../../hooks/usePWA';
import { TokenPill } from '../tokens/TokenPill';
import { useTokenStore } from '../../store/useTokenStore';
import { useUserStore } from '../../store/useUserStore';
import {
  Music,
  FolderKanban,
  Settings as SettingsIcon,
  Menu,
  X,
  Phone,
  Mail,
  MessageCircle,
  ExternalLink,
  Coins,
  User,
  LogOut,
} from 'lucide-react';

export const Header: React.FC = () => {
  const { hasUpdate, applyUpdate } = usePWA();
  const location = useLocation();
  const { openModal: openTokenModal, balance: tokenBalance } = useTokenStore();
  const { user, isAuthenticated, openAuthModal, logout } = useUserStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/tokens', label: 'Buy Tokens' },
    { to: '/projects', label: 'My Songs' },
    { to: '/settings', label: 'Settings' },
  ];

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <>
      {/* PWA Update notification banner */}
      {hasUpdate && (
        <div className="bg-blue-600 text-white px-4 py-2 text-xs font-medium flex items-center justify-between shadow-sm">
          <span>A new application update is available.</span>
          <button
            onClick={applyUpdate}
            className="px-3 py-1 rounded-md bg-white text-slate-900 font-semibold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Update & Reload
          </button>
        </div>
      )}

      <header className="h-16 bg-[#080D1A]/85 backdrop-blur-xl border-b border-white/[0.08] sticky top-0 z-30 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 transition-colors">
        {/* Left: Brand Logo & Title (Clickable) */}
        <div className="flex items-center gap-6">
          <Link
            to="/"
            onClick={closeMenu}
            className="flex items-center gap-2.5 group focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl p-1"
            title="Vocal Remover Home"
          >
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25 group-hover:scale-105 transition-all">
              <Music className="w-4 h-4" />
            </div>
            <span className="font-extrabold text-base sm:text-lg text-white tracking-tight">
              Vocal Remover
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06]">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-white/[0.1] text-white border border-white/10 shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-white/[0.05]'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Action Area */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Token Balance Pill */}
          <TokenPill />

          {/* User Account / Sign In */}
          {isAuthenticated ? (
            <div className="flex items-center gap-1.5 bg-white/[0.05] border border-white/10 rounded-xl px-2.5 py-1 text-xs shadow-xs backdrop-blur-md">
              <div className="w-5 h-5 rounded-md bg-blue-600/30 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-[10px]">
                {(user?.name || user?.email || 'U')[0].toUpperCase()}
              </div>
              <span className="font-semibold text-white max-w-[90px] truncate hidden md:inline">
                {user?.name || user?.email?.split('@')[0]}
              </span>
              <button
                type="button"
                onClick={logout}
                className="text-slate-400 hover:text-rose-400 transition-colors p-1 cursor-pointer"
                title="Log out of account"
                aria-label="Log out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-slate-200 hover:text-white transition-all cursor-pointer shadow-xs backdrop-blur-md"
              title="Sign in to your account"
            >
              <User className="w-3.5 h-3.5 text-blue-400" />
              <span>Sign In</span>
            </button>
          )}

          {/* Karoke Maker Partner Button (Desktop) */}
          <a
            href="https://www.karokemaker.online/"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 transition-all shadow-xs group cursor-pointer backdrop-blur-md hover:-translate-y-0.5"
            title="Open Karoke Maker by Ayesha Tech Studio"
          >
            <div className="w-7 h-7 rounded-lg overflow-hidden bg-black/40 flex items-center justify-center flex-shrink-0 border border-white/10">
              <img
                src="/karaoke-logo.png"
                alt="Karoke Maker by Ayesha Tech Studio"
                width={28}
                height={28}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                loading="lazy"
                decoding="async"
              />
            </div>
            <div className="flex flex-col text-left justify-center">
              <span className="font-bold text-xs text-white leading-tight">Karoke Maker</span>
              <span className="text-[10px] text-slate-300 leading-tight">by Ayesha Tech Studio</span>
            </div>
          </a>

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/[0.08] border border-white/10 transition-colors cursor-pointer"
            aria-label={mobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/80 flex flex-col justify-between pt-16">
          <div className="bg-[#0F172A] border-b border-slate-800 p-5 space-y-5 animate-in slide-in-from-top-4 duration-150">
            {/* Navigation links */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 block mb-1">
                Navigation
              </span>
              {navLinks.map((link) => {
                const isActive = location.pathname === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={closeMenu}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span>{link.label}</span>
                    {link.to === '/projects' && <FolderKanban className="w-4 h-4 text-slate-400" />}
                    {link.to === '/settings' && <SettingsIcon className="w-4 h-4 text-slate-400" />}
                  </Link>
                );
              })}
            </div>

            {/* User Account in Mobile Menu */}
            <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-between">
              {isAuthenticated ? (
                <>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-600/30 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs">
                      {(user?.name || user?.email || 'U')[0].toUpperCase()}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block truncate max-w-[140px]">
                        {user?.name || user?.email?.split('@')[0]}
                      </span>
                      <span className="text-[10px] text-slate-400 block truncate max-w-[140px]">
                        {user?.email}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      closeMenu();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-rose-600 text-slate-200 hover:text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log Out</span>
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <span className="text-xs font-bold text-white block">Account</span>
                    <span className="text-[10px] text-slate-400 block">Sign in or create account</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      closeMenu();
                      openAuthModal('login');
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Sign In</span>
                  </button>
                </>
              )}
            </div>

            {/* Quick Recharge in Menu */}
            <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-300 block">Available Balance</span>
                <span className="text-sm font-extrabold text-white">{tokenBalance} Tokens</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  closeMenu();
                  openTokenModal();
                }}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Coins className="w-3.5 h-3.5" />
                <span>Recharge Tokens</span>
              </button>
            </div>

            {/* Partner Link for Mobile */}
            <a
              href="https://www.karokemaker.online/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={closeMenu}
              className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <img
                  src="/karaoke-logo.png"
                  alt="Karoke Maker by Ayesha Tech Studio"
                  width={24}
                  height={24}
                  className="w-6 h-6 rounded-md object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <div className="text-left">
                  <span className="text-xs font-bold text-white block">Karoke Maker</span>
                  <span className="text-[10px] text-slate-400">by Ayesha Tech Studio</span>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-400" />
            </a>

            {/* Clickable Phone, WhatsApp & Email in Mobile Menu */}
            <div className="pt-3 border-t border-slate-800 space-y-2 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1 block">
                Support & Contact
              </span>
              <a
                href="https://wa.me/919743247790"
                target="_blank"
                rel="noopener noreferrer"
                onClick={closeMenu}
                className="flex items-center gap-2.5 p-2 rounded-lg text-emerald-400 hover:bg-slate-800 transition-colors"
              >
                <MessageCircle className="w-4 h-4 flex-shrink-0" />
                <span>WhatsApp: +91 9743247790</span>
              </a>
              <a
                href="tel:+919743247790"
                onClick={closeMenu}
                className="flex items-center gap-2.5 p-2 rounded-lg text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <Phone className="w-4 h-4 flex-shrink-0 text-slate-400" />
                <span>Call: +91 9743247790</span>
              </a>
              <a
                href="mailto:ayeshatechstudio@gmail.com"
                onClick={closeMenu}
                className="flex items-center gap-2.5 p-2 rounded-lg text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <Mail className="w-4 h-4 flex-shrink-0 text-slate-400" />
                <span>Email: ayeshatechstudio@gmail.com</span>
              </a>
            </div>
          </div>

          {/* Dismiss overlay tap */}
          <div className="flex-1" onClick={closeMenu} />
        </div>
      )}
    </>
  );
};
