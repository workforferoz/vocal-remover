import React, { useState, useEffect, useRef } from 'react';
import {
  localEngineService,
  type BackendModelInfo,
  type BackendModelDownloadStatus,
} from '../services/localEngine';
import { useSettingsStore } from '../store/useSettingsStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { usePWA } from '../hooks/usePWA';
import { getStorageDiagnostics, clearAudioFiles } from '../services/db';
import { formatFileSize } from '../services/audioMetadata';
import { Card } from '../components/common/Card';
import {
  Cpu,
  Download,
  HardDrive,
  CheckCircle2,
  RefreshCw,
  Wifi,
  WifiOff,
  Laptop,
  Info,
  ShieldCheck,
  Layers,
  Trash2,
} from 'lucide-react';

export const ModelsPage: React.FC = () => {
  const { engineHealth, checkEngine, isCheckingEngine } = useSettingsStore();
  const { showNotification } = useNotificationStore();
  const { networkStatus, canInstall, isInstalled, promptInstall } = usePWA();

  const [models, setModels] = useState<BackendModelInfo[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(true);
  const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<BackendModelDownloadStatus | null>(null);

  // Storage info
  const [storageStats, setStorageStats] = useState<{
    quotaBytes: number;
    usedBytes: number;
    audioCount: number;
    projectsCount: number;
  } | null>(null);

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadModelsList = async () => {
    setIsLoadingModels(true);
    try {
      if (engineHealth.connected) {
        const list = await localEngineService.getModels();
        setModels(list);
      } else {
        // Fallback default definitions when engine is offline
        setModels([
          {
            name: 'htdemucs',
            label: 'Demucs v4 (Hybrid Transformer)',
            description: 'Default state-of-the-art 4-stem model (vocals, drums, bass, other). High fidelity, optimized for CPU and GPU inference.',
            status: 'installed',
            size_mb: 80.1,
            estimated_size_mb: 80.0,
            storage_path: 'local-engine/models/htdemucs',
            sources: ['vocals', 'drums', 'bass', 'other'],
            device_support: 'CPU Multithread & NVIDIA CUDA GPU',
            is_default: true,
          },
          {
            name: 'htdemucs_ft',
            label: 'Demucs v4 Fine-Tuned',
            description: 'Fine-tuned transformer ensemble providing increased stem separation accuracy. Requires ~160 MB disk space.',
            status: 'not_installed',
            size_mb: null,
            estimated_size_mb: 160.0,
            storage_path: null,
            sources: ['vocals', 'drums', 'bass', 'other'],
            device_support: 'CPU Multithread & NVIDIA CUDA GPU',
            is_default: false,
          },
        ]);
      }
    } catch {
      // Keep existing list if error
    } finally {
      setIsLoadingModels(false);
    }
  };

  const loadStorage = async () => {
    try {
      const res = await getStorageDiagnostics();
      setStorageStats({
        quotaBytes: res.quotaBytes,
        usedBytes: res.usedBytes,
        audioCount: res.audioCount,
        projectsCount: res.projectsCount,
      });
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    loadModelsList();
    loadStorage();

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineHealth.connected]);

  // Handle Model Download & Offline Verification
  const handleDownloadModel = async (modelName: string) => {
    if (!engineHealth.connected) {
      showNotification({
        type: 'error',
        title: 'Engine Required',
        message: 'Start the local Python engine with start.bat to manage model downloads.',
      });
      return;
    }

    if (networkStatus === 'offline') {
      showNotification({
        type: 'error',
        title: 'Internet Connection Required',
        message: 'Downloading AI model weights from HuggingFace Hub requires an active internet connection.',
      });
      return;
    }

    setDownloadingModel(modelName);
    showNotification({
      type: 'info',
      title: 'Model Download Started',
      message: `Fetching and verifying '${modelName}' in the background...`,
    });

    try {
      const initialStatus = await localEngineService.downloadModel(modelName);
      setDownloadStatus(initialStatus);

      if (initialStatus.status === 'installed') {
        setDownloadingModel(null);
        loadModelsList();
        showNotification({
          type: 'success',
          title: 'Model Verified',
          message: `Model '${modelName}' is already installed and verified.`,
        });
        return;
      }

      // Poll download and verification progress
      pollTimerRef.current = setInterval(async () => {
        try {
          const status = await localEngineService.getModelDownloadStatus(modelName);
          setDownloadStatus(status);

          if (status.status === 'installed') {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            setDownloadingModel(null);
            loadModelsList();
            showNotification({
              type: 'success',
              title: 'Model Download & Verification Complete!',
              message: `Model '${modelName}' is verified and ready for 100% offline separation.`,
            });
          } else if (status.status === 'error' || status.status === 'verification_failed') {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            setDownloadingModel(null);
            showNotification({
              type: 'error',
              title: 'Model Verification Failed',
              message: status.error || 'Failed to complete model download.',
            });
          }
        } catch {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setDownloadingModel(null);
        }
      }, 1500);
    } catch (err: unknown) {
      setDownloadingModel(null);
      showNotification({
        type: 'error',
        title: 'Download Failed',
        message: err instanceof Error ? err.message : 'Could not trigger model download.',
      });
    }
  };

  const handleClearCache = async () => {
    try {
      await clearAudioFiles();
      await loadStorage();
      showNotification({
        type: 'info',
        title: 'Audio Previews Purged',
        message: 'Temporary in-browser audio previews were cleared without deleting projects or AI model weights.',
      });
    } catch {
      showNotification({
        type: 'error',
        title: 'Purge Error',
        message: 'Could not clear audio cache.',
      });
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Cpu className="w-6 h-6 text-[#7357F5]" />
            <span>AI Model & Storage Management</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Demucs neural weights, offline verification, browser storage & desktop installation.
          </p>
        </div>

        <button
          onClick={() => {
            checkEngine();
            loadModelsList();
            loadStorage();
          }}
          disabled={isCheckingEngine || isLoadingModels}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isCheckingEngine || isLoadingModels ? 'animate-spin' : ''}`} />
          <span>Refresh Status</span>
        </button>
      </div>

      {/* Offline Capabilities & Architecture Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Network State Card */}
        <div className="p-4 rounded-xl bg-[#101827] border border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Browser Network</span>
            {networkStatus === 'online' ? (
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#16C784]">
                <Wifi className="w-3.5 h-3.5" />
                <span>Online</span>
              </span>
            ) : networkStatus === 'offline' ? (
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400">
                <WifiOff className="w-3.5 h-3.5" />
                <span>Offline Mode</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-400">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Reconnecting...</span>
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Interface and cached assets open offline via Service Worker. Quick Local DSP works 100% offline.
          </p>
        </div>

        {/* Python AI Engine Card */}
        <div className="p-4 rounded-xl bg-[#101827] border border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Local Demucs Engine</span>
            <span
              className={`flex items-center gap-1 text-[11px] font-semibold ${
                engineHealth.connected ? 'text-[#16C784]' : 'text-amber-400'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${engineHealth.connected ? 'bg-[#16C784]' : 'bg-amber-400'}`} />
              <span>{engineHealth.connected ? 'Online (127.0.0.1:8524)' : 'Offline'}</span>
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Runs strictly on local loopback. Processes audio 100% offline once the required model is installed.
          </p>
        </div>

        {/* Desktop PWA Status Card */}
        <div className="p-4 rounded-xl bg-[#101827] border border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Desktop App Status</span>
            <span className="text-[11px] font-semibold text-[#3984FF] flex items-center gap-1">
              <Laptop className="w-3.5 h-3.5" />
              <span>{isInstalled ? 'Installed Desktop App' : 'Web / Installable'}</span>
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {canInstall
              ? 'Can be installed as a standalone desktop window on Windows 10/11.'
              : isInstalled
              ? 'Running in standalone desktop mode with full local sandboxing.'
              : 'Web app with full offline cache and service worker enabled.'}
          </p>
        </div>
      </div>

      {/* Model Catalog Section */}
      <Card className="p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#7357F5]" />
              <span>Demucs AI Models Catalog</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Verified neural models cached directly on your computer in the local Python environment
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {models.map((m) => {
            const isInstalledModel = m.status === 'installed';
            const isDownloadingThis = downloadingModel === m.name;

            return (
              <div
                key={m.name}
                className={`p-5 rounded-xl border flex flex-col justify-between gap-4 transition-all ${
                  isInstalledModel
                    ? 'bg-[#101827] border-white/10 hover:border-white/20'
                    : 'bg-[#101827]/60 border-white/5'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white text-sm">{m.label}</h4>
                        {m.is_default && (
                          <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-[#7357F5]/20 text-[#7357F5] border border-[#7357F5]/30">
                            Default
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-xs text-slate-400">{m.name}</span>
                    </div>

                    <span
                      className={`text-[11px] px-2.5 py-1 rounded-full font-semibold border flex items-center gap-1 ${
                        isInstalledModel
                          ? 'bg-[#16C784]/15 text-[#16C784] border-[#16C784]/30'
                          : isDownloadingThis
                          ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                          : 'bg-white/5 text-slate-400 border-white/10'
                      }`}
                    >
                      {isInstalledModel ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#16C784]" />
                          <span>Installed & Verified</span>
                        </>
                      ) : isDownloadingThis ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                          <span>Downloading ({downloadStatus?.progress || 20}%)</span>
                        </>
                      ) : (
                        <span>Not Installed</span>
                      )}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{m.description}</p>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-xs text-slate-400">
                    <div>
                      <span className="text-[11px] text-slate-500 block">Model Size</span>
                      <span className="font-mono text-white">
                        {m.size_mb ? `${m.size_mb} MB` : `~${m.estimated_size_mb} MB`}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">Hardware Support</span>
                      <span className="font-medium text-slate-300 truncate">{m.device_support}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[11px] text-slate-500 block">Separated Stems</span>
                      <span className="font-mono text-[#3984FF] capitalize">
                        {m.sources.join(', ')}
                      </span>
                    </div>
                    {m.storage_path && (
                      <div className="col-span-2">
                        <span className="text-[11px] text-slate-500 block">Verified Local Path</span>
                        <span className="font-mono text-[10px] text-slate-400 break-all">
                          {m.storage_path}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                  {isInstalledModel ? (
                    <span className="text-[11px] text-[#16C784] font-medium flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Ready for 100% Offline Separation</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => handleDownloadModel(m.name)}
                      disabled={isDownloadingThis}
                      className="w-full px-4 py-2 rounded-xl bg-gradient-to-r from-[#7357F5] to-[#3984FF] hover:brightness-110 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>
                        {isDownloadingThis
                          ? `Downloading (${downloadStatus?.progress || 20}%)...`
                          : `Download & Verify (~${m.estimated_size_mb} MB)`}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Storage Management Section */}
      <Card className="p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-[#3984FF]" />
              <span>Storage & Cache Management</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Overview of browser sandbox storage, project metadata, and temporary audio buffers
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-[#101827] border border-white/10 space-y-1.5">
            <span className="text-slate-400">Browser Sandbox Quota</span>
            <p className="text-base font-bold text-white font-mono">
              {storageStats?.usedBytes ? formatFileSize(storageStats.usedBytes) : 'Minimal'}
              <span className="text-xs font-normal text-slate-400 font-sans ml-1">
                used of {storageStats?.quotaBytes ? formatFileSize(storageStats.quotaBytes) : 'Quota'}
              </span>
            </p>
            <p className="text-[11px] text-slate-400">IndexedDB database & Service Worker application cache.</p>
          </div>

          <div className="p-4 rounded-xl bg-[#101827] border border-white/10 space-y-1.5">
            <span className="text-slate-400">Project Metadata Records</span>
            <p className="text-base font-bold text-[#7357F5] font-mono">
              {storageStats?.projectsCount || 0} Projects Saved
            </p>
            <p className="text-[11px] text-slate-400">Separation parameters, track lengths, and stem references.</p>
          </div>

          <div className="p-4 rounded-xl bg-[#101827] border border-white/10 space-y-1.5">
            <span className="text-slate-400">Audio Previews Cache</span>
            <p className="text-base font-bold text-[#16C784] font-mono">
              {storageStats?.audioCount || 0} Cached Audio Clips
            </p>
            <button
              onClick={handleClearCache}
              className="mt-1 text-[11px] text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>Purge Audio Previews Cache</span>
            </button>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-start gap-2.5">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-400" />
          <p className="leading-relaxed">
            <strong>Data Safety Guarantee:</strong> Clearing the browser audio previews cache never deletes your projects, separated stems on disk, or local Demucs AI model weights.
          </p>
        </div>
      </Card>

      {/* Windows Desktop & PWA Installation Guide */}
      <Card className="p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Laptop className="w-5 h-5 text-[#16C784]" />
              <span>Desktop Application Setup Guide</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              How to run Vocal Studio AI on Windows with desktop standalone windows and offline processing
            </p>
          </div>

          {canInstall && (
            <button
              onClick={() => promptInstall()}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#16C784] to-[#3984FF] hover:brightness-110 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Install Desktop App</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-[#101827] border border-white/10 space-y-3">
            <h4 className="font-bold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#7357F5]/20 text-[#7357F5] flex items-center justify-center font-mono text-[11px]">1</span>
              <span>Install Progressive Web App (PWA)</span>
            </h4>
            <p className="text-slate-300 leading-relaxed">
              In Google Chrome or Microsoft Edge on Windows, click the <strong>Install</strong> icon in the address bar (or the button above). The app will run in its own borderless window with its own taskbar shortcut.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#101827] border border-white/10 space-y-3">
            <h4 className="font-bold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#3984FF]/20 text-[#3984FF] flex items-center justify-center font-mono text-[11px]">2</span>
              <span>Launch Local Python Engine</span>
            </h4>
            <p className="text-slate-300 leading-relaxed">
              To enable genuine Demucs 4-stem separation, navigate to the <code className="text-white bg-[#080D18] px-1.5 py-0.5 rounded">local-engine</code> directory and run <code className="text-emerald-400 font-bold">start.bat</code>.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#101827] border border-white/10 space-y-2 text-xs">
          <span className="font-semibold text-white">Full Independent Installation Summary:</span>
          <ol className="list-decimal list-inside space-y-1.5 text-slate-300 pl-1">
            <li>Install PWA from Chrome or Edge (caches shell for offline loading).</li>
            <li>Run <code className="text-slate-200">local-engine\install.bat</code> (sets up Python 3.11 virtual environment & dependencies).</li>
            <li>Download the default <code className="text-slate-200">htdemucs</code> model weights once using an internet connection.</li>
            <li>Run <code className="text-slate-200">local-engine\start.bat</code> to start the offline loopback daemon on port 8524.</li>
            <li>Launch Vocal Studio AI from your desktop or Start Menu. Both UI and AI engine operate 100% offline.</li>
          </ol>
        </div>
      </Card>
    </div>
  );
};
