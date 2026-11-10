import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSettingsStore } from '../../store/useSettingsStore';
import { usePWA } from '../../hooks/usePWA';
import {
  Menu,
  Settings,
  Cpu,
  Zap,
  User,
  RefreshCw,
  Info,
  AlertCircle,
  Wifi,
  WifiOff,
  Download,
  HardDrive,
  Sparkles,
} from 'lucide-react';
import { Modal } from '../common/Modal';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { engineHealth, isCheckingEngine, checkEngine, settings } = useSettingsStore();
  const { networkStatus, canInstall, hasUpdate, promptInstall, applyUpdate } = usePWA();
  const [isEngineModalOpen, setIsEngineModalOpen] = useState(false);
  const [isNetworkModalOpen, setIsNetworkModalOpen] = useState(false);

  // Derive page title from route
  const getPageInfo = () => {
    switch (location.pathname) {
      case '/':
      case '/new':
        return { title: 'Vocal Remover', subtitle: 'Extract instrumental and remove vocals from any song' };
      case '/projects':
        return { title: 'My Songs', subtitle: 'Saved songs and separated instrumentals' };
      case '/history':
        return { title: 'Processing History', subtitle: 'Audit log of separation tasks, runtimes and states' };
      case '/models':
        return { title: 'AI Models & Storage', subtitle: 'Demucs neural checkpoints, downloads & browser cache' };
      case '/settings':
        return { title: 'Settings', subtitle: 'Audio quality, local engine connection & preferences' };
      case '/help':
        return { title: 'Help & Documentation', subtitle: 'User guide, system requirements & technical details' };
      default:
        if (location.pathname.startsWith('/studio')) {
          return { title: 'Multitrack Studio', subtitle: 'Synchronized stem playback, mixer, presets & export' };
        }
        return { title: 'Vocal Studio AI', subtitle: 'Music Source Separation' };
    }
  };

  const { title, subtitle } = getPageInfo();
  const isOnlineHosted =
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1';

  return (
    <>
      {/* PWA Update notification banner */}
      {hasUpdate && (
        <div className="bg-gradient-to-r from-[#7357F5] to-[#3984FF] text-white px-4 py-1.5 text-xs font-medium flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <span>A new version of Vocal Studio AI is ready to install.</span>
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
        {/* Left: Mobile hamburger & title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 lg:hidden transition-colors"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight truncate leading-tight">
              {title}
            </h2>
            <p className="hidden md:block text-[11px] text-slate-400 truncate -mt-0.5">{subtitle}</p>
          </div>
        </div>

        {/* Right: Engine indicators, network status, PWA install, settings, user profile */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* PWA Desktop Install button */}
          {canInstall && (
            <button
              onClick={promptInstall}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#7357F5]/20 hover:bg-[#7357F5]/30 border border-[#7357F5]/50 text-white text-xs font-medium transition-all shadow-sm shadow-[#7357F5]/10 cursor-pointer"
              title="Install Vocal Studio AI as a desktop app"
            >
              <Download className="w-3.5 h-3.5 text-[#a594fd]" />
              <span>Install App</span>
            </button>
          )}

          {/* Network Indicator Pill */}
          <button
            onClick={() => setIsNetworkModalOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
              networkStatus === 'online'
                ? 'bg-[#16C784]/10 text-[#16C784] border-[#16C784]/30 hover:bg-[#16C784]/20'
                : networkStatus === 'reconnecting'
                ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
            }`}
            title="Click for Offline & Network Connectivity details"
          >
            {networkStatus === 'online' ? (
              <Wifi className="w-3.5 h-3.5" />
            ) : networkStatus === 'reconnecting' ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <WifiOff className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">
              {networkStatus === 'online' ? 'Online' : networkStatus === 'reconnecting' ? 'Reconnecting' : 'Offline Mode'}
            </span>
          </button>

          {/* Engine Status Pill */}
          <button
            onClick={() => setIsEngineModalOpen(true)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
              isOnlineHosted || engineHealth.connected
                ? 'bg-[#16C784]/10 text-[#16C784] border-[#16C784]/30 hover:bg-[#16C784]/20'
                : engineHealth.state === 'connecting'
                ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
            }`}
            title="Click for Engine details"
          >
            {isOnlineHosted ? (
              <Zap className="w-3.5 h-3.5 text-[#16C784]" />
            ) : (
              <Cpu className="w-3.5 h-3.5" />
            )}
            <span className="hidden xs:inline">
              {isOnlineHosted
                ? 'Browser Audio: Active'
                : engineHealth.connected
                ? `Local AI: ${engineHealth.device?.includes('CUDA') ? 'GPU' : 'CPU'}`
                : engineHealth.state === 'connecting'
                ? 'Connecting...'
                : 'AI Engine: Off'}
            </span>
            <span className="xs:hidden">
              {isOnlineHosted || engineHealth.connected ? 'Active' : 'AI: Off'}
            </span>
            <span
              className={`w-2 h-2 rounded-full ${
                isOnlineHosted || engineHealth.connected
                  ? 'bg-[#16C784] animate-pulse'
                  : engineHealth.state === 'connecting'
                  ? 'bg-blue-400 animate-ping'
                  : 'bg-amber-400'
              }`}
            />
          </button>

          {/* Settings shortcut button */}
          <button
            onClick={() => navigate('/settings')}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors"
            title="Application Settings"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* User profile avatar placeholder */}
          <div
            className="flex items-center gap-2 pl-2 border-l border-white/10 cursor-pointer"
            onClick={() => navigate('/settings')}
            title="Producer Profile (Local Station)"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#7357F5] to-[#3984FF] flex items-center justify-center text-white text-xs font-bold ring-2 ring-white/10">
              <User className="w-4 h-4" />
            </div>
            <div className="hidden xl:flex flex-col text-left">
              <span className="text-xs font-semibold text-white leading-tight">Producer</span>
              <span className="text-[10px] text-slate-400 leading-tight">Local Studio</span>
            </div>
          </div>
        </div>
      </header>

      {/* Network & Offline Diagnostics Modal */}
      <Modal
        isOpen={isNetworkModalOpen}
        onClose={() => setIsNetworkModalOpen(false)}
        title="Network & Offline Status"
        subtitle="Vocal Studio AI Offline Execution Architecture"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-xl bg-[#101827] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Internet Connection:</span>
              <span
                className={`font-semibold flex items-center gap-1.5 ${
                  networkStatus === 'online'
                    ? 'text-[#16C784]'
                    : networkStatus === 'reconnecting'
                    ? 'text-blue-400'
                    : 'text-amber-400'
                }`}
              >
                {networkStatus === 'online' ? (
                  <>
                    <Wifi className="w-3.5 h-3.5" /> Online
                  </>
                ) : networkStatus === 'reconnecting' ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Reconnecting...
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5" /> Offline Mode
                  </>
                )}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">PWA Shell Cache:</span>
              <span className="font-mono text-emerald-400">Active (Service Worker sw.js)</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Quick Local Mode (DSP):</span>
              <span className="font-semibold text-emerald-400 flex items-center gap-1">
                <Zap className="w-3 h-3" /> 100% Offline Capable
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Demucs AI Separation:</span>
              <span
                className={`font-semibold flex items-center gap-1 ${
                  engineHealth.connected ? 'text-emerald-400' : 'text-slate-400'
                }`}
              >
                <Cpu className="w-3 h-3" />
                {engineHealth.connected
                  ? 'Offline Capable (Local Daemon Active)'
                  : 'Requires Local Engine on 127.0.0.1:8524'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">New AI Model Downloads:</span>
              <span className={`font-semibold ${networkStatus === 'online' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {networkStatus === 'online' ? 'Available (Online)' : 'Blocked (Requires Internet)'}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-slate-300 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-white">
              <Info className="w-4 h-4 text-blue-400" />
              <span>Offline Independence Guarantee</span>
            </div>
            <p className="leading-relaxed text-[11px]">
              Vocal Studio AI never streams your music to cloud servers. Once the PWA is installed and the
              Demucs model weights are cached on your disk, you can sever your internet connection completely.
              Audio decoding, separation and multitrack stem playback will continue to operate locally.
            </p>
          </div>

          <div className="flex justify-between items-center pt-2">
            <button
              onClick={() => {
                setIsNetworkModalOpen(false);
                navigate('/models');
              }}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium border border-white/10 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <HardDrive className="w-3.5 h-3.5 text-[#7357F5]" />
              <span>Manage Models & Storage</span>
            </button>
            <button
              onClick={() => setIsNetworkModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-[#7357F5] hover:bg-[#6345ec] text-white font-medium transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* AI Engine Status Details Modal */}
      <Modal
        isOpen={isEngineModalOpen}
        onClose={() => setIsEngineModalOpen(false)}
        title="Local AI Engine Connectivity"
        subtitle="Python FastAPI + PyTorch + Demucs Daemon"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-xl bg-[#101827] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Daemon Host:</span>
              <span className="font-mono text-white">{settings.pythonEngineUrl}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Connection Status:</span>
              <span
                className={`font-semibold ${
                  engineHealth.connected ? 'text-[#16C784]' : 'text-amber-400'
                }`}
              >
                {engineHealth.statusText}
              </span>
            </div>
            {engineHealth.connected && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Compute Device:</span>
                  <span className="font-mono text-white font-medium">{engineHealth.device}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">PyTorch & Demucs:</span>
                  <span className="font-mono text-slate-300">
                    PyTorch {engineHealth.pytorchVersion} / Demucs {engineHealth.demucsVersion}
                  </span>
                </div>
                {engineHealth.cpuThreads && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">CPU Worker Threads:</span>
                    <span className="font-mono text-slate-300">{engineHealth.cpuThreads} threads</span>
                  </div>
                )}
                {engineHealth.systemMemoryGb && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">System Memory:</span>
                    <span className="font-mono text-slate-300">{engineHealth.systemMemoryGb} GB RAM</span>
                  </div>
                )}
                {engineHealth.availableModels && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Available Neural Models:</span>
                    <span className="font-mono text-[#7357F5]">
                      {engineHealth.availableModels.join(', ')}
                    </span>
                  </div>
                )}
                {engineHealth.latencyMs !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Loopback Latency:</span>
                    <span className="font-mono text-white">{engineHealth.latencyMs} ms</span>
                  </div>
                )}
              </>
            )}
            {!engineHealth.connected && engineHealth.errorMessage && (
              <div className="pt-2 border-t border-white/5 text-amber-300/90 leading-relaxed">
                {engineHealth.errorMessage}
              </div>
            )}
          </div>

          {!engineHealth.connected ? (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-white">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <span>How to Start the Local AI Engine:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-slate-300 pl-1">
                <li>
                  Open your terminal or file explorer in <code className="text-amber-200">local-engine/</code>
                </li>
                <li>
                  Run <code className="text-amber-200 font-bold">start.bat</code> to boot the daemon on port 8524
                </li>
                <li>Click the <strong>Retry Connection</strong> button below</li>
              </ol>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#16C784]/10 border border-[#16C784]/20 text-[#16C784]">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#16C784]" />
              <p className="leading-relaxed text-slate-300">
                Local AI engine is verified and ready. Genuine Demucs source separation is active for AI Professional
                and Multi-Stem modes. All audio stays 100% on your PC.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => checkEngine()}
              disabled={isCheckingEngine}
              className="px-4 py-2 rounded-xl bg-[#7357F5] hover:bg-[#6345ec] text-white font-medium flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingEngine ? 'animate-spin' : ''}`} />
              <span>{isCheckingEngine ? 'Checking...' : 'Retry Connection'}</span>
            </button>
            <button
              onClick={() => setIsEngineModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium border border-white/10 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

