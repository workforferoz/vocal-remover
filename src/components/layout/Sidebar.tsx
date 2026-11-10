import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Music,
  FolderKanban,
  Settings,
  HelpCircle,
  Disc3,
  Cpu,
  Zap,
  HardDrive,
  Download,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { usePWA } from '../../hooks/usePWA';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle }) => {
  const { engineHealth } = useSettingsStore();
  const { networkStatus, canInstall, isInstalled, promptInstall } = usePWA();
  const isOnlineHosted =
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1';

  const navItems = [
    { name: 'Vocal Remover', path: '/', icon: Music },
    { name: 'My Songs', path: '/projects', icon: FolderKanban },
    { name: 'AI Models & Storage', path: '/models', icon: HardDrive },
    { name: 'Settings', path: '/settings', icon: Settings },
    { name: 'Help', path: '/help', icon: HelpCircle },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-30 lg:hidden backdrop-blur-xs"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-[#101827] border-r border-white/10 flex flex-col justify-between transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top brand header */}
        <div className="flex flex-col">
          <div className="h-16 px-6 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#7357F5] to-[#3984FF] flex items-center justify-center shadow-md shadow-indigo-500/20">
                <Disc3 className="w-5 h-5 text-white animate-spin-slow" />
              </div>
              <div>
                <span className="font-bold text-base text-white tracking-tight flex items-center gap-1.5">
                  Vocal Studio <span className="text-[#7357F5]">AI</span>
                </span>
                <span className="text-[10px] block font-mono text-slate-400 -mt-1 tracking-wider uppercase">
                  PWA • v1.2.0
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5" aria-label="Main Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  onClick={() => {
                    // Close on mobile when navigating
                    if (window.innerWidth < 1024) onToggle();
                  }}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-[#7357F5]/20 to-[#3984FF]/10 text-white border border-[#7357F5]/40 shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Bottom Panel: Install CTA + Engine status footer */}
        <div className="p-3 space-y-3">
          {/* PWA Desktop Install Banner if installable */}
          {canInstall && (
            <div className="p-3 rounded-xl bg-gradient-to-br from-[#7357F5]/20 to-[#3984FF]/10 border border-[#7357F5]/40 text-xs">
              <div className="flex items-center gap-2 text-white font-semibold mb-1">
                <Download className="w-3.5 h-3.5 text-[#a594fd]" />
                <span>Install Desktop App</span>
              </div>
              <p className="text-[11px] text-slate-300 mb-2.5">
                Run standalone on Windows with offline shell caching & taskbar pin.
              </p>
              <button
                onClick={promptInstall}
                className="w-full py-1.5 px-3 rounded-lg bg-[#7357F5] hover:bg-[#6345ec] text-white text-xs font-medium flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install Now</span>
              </button>
            </div>
          )}

          {/* Engine & Network status card */}
          <div className="p-3.5 rounded-2xl bg-[#151F30] border border-white/10 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-white uppercase tracking-wider">Engine Status</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  engineHealth.connected ? 'bg-[#16C784] animate-pulse' : 'bg-amber-400'
                }`}
              />
            </div>

            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between text-slate-300">
                <span className="flex items-center gap-1 text-slate-400">
                  <Zap className="w-3 h-3 text-[#16C784]" />
                  Audio Engine:
                </span>
                <span className="font-medium text-[#16C784]">
                  {isOnlineHosted ? 'In-Browser DSP' : 'Browser Active'}
                </span>
              </div>

              {!isOnlineHosted && (
                <div className="flex items-center justify-between text-slate-300">
                  <span className="flex items-center gap-1 text-slate-400">
                    <Cpu className="w-3 h-3 text-[#7357F5]" />
                    Demucs AI:
                  </span>
                  <span className="font-mono text-slate-400">
                    {engineHealth.connected ? 'Online (8524)' : 'Offline'}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-slate-300 pt-1.5 border-t border-white/5">
                <span className="flex items-center gap-1 text-slate-400">
                  {networkStatus === 'online' ? (
                    <Wifi className="w-3 h-3 text-[#16C784]" />
                  ) : (
                    <WifiOff className="w-3 h-3 text-amber-400" />
                  )}
                  Network:
                </span>
                <span
                  className={`font-medium ${
                    networkStatus === 'online'
                      ? 'text-[#16C784]'
                      : networkStatus === 'reconnecting'
                      ? 'text-blue-400'
                      : 'text-amber-400'
                  }`}
                >
                  {networkStatus === 'online' ? 'Online' : networkStatus === 'reconnecting' ? 'Reconnecting' : 'Offline'}
                </span>
              </div>
            </div>

            {isInstalled && (
              <div className="pt-1 text-[10px] text-center text-slate-400 font-mono">
                ✓ Installed Desktop PWA
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

