import React, { useEffect, useState } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { getSystemDiagnostics } from '../../services/engineClient';
import { getStorageDiagnostics } from '../../services/db';
import type { SystemDiagnostics } from '../../types';
import { formatFileSize } from '../../services/audioMetadata';
import { Cpu, HardDrive, Wifi, WifiOff, RefreshCw, CheckCircle, AlertCircle, Laptop } from 'lucide-react';

export const SystemStatusCard: React.FC = () => {
  const { engineHealth, isCheckingEngine, checkEngine, settings } = useSettingsStore();
  const [diagnostics, setDiagnostics] = useState<SystemDiagnostics>(getSystemDiagnostics);
  const [storage, setStorage] = useState<{ usedBytes: number; quotaBytes: number; audioCount: number } | null>(null);

  useEffect(() => {
    let isCancelled = false;
    getStorageDiagnostics().then((res) => {
      if (!isCancelled) {
        setStorage({
          usedBytes: res.usedBytes,
          quotaBytes: res.quotaBytes,
          audioCount: res.audioCount,
        });
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  const handlePing = () => {
    checkEngine();
    setDiagnostics(getSystemDiagnostics());
    getStorageDiagnostics().then((res) => {
      setStorage({
        usedBytes: res.usedBytes,
        quotaBytes: res.quotaBytes,
        audioCount: res.audioCount,
      });
    });
  };

  return (
    <div className="bg-[#151F30] border border-white/10 rounded-2xl p-6 shadow-lg flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <Laptop className="w-5 h-5 text-[#3984FF]" />
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight">System & Diagnostics</h3>
            <p className="text-[11px] text-slate-400">Local workstation specifications and engine readiness</p>
          </div>
        </div>

        <button
          onClick={handlePing}
          disabled={isCheckingEngine}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-300 hover:text-white transition-colors disabled:opacity-50"
          title="Refresh diagnostics and ping local engine"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isCheckingEngine ? 'animate-spin text-[#7357F5]' : ''}`} />
          <span>{isCheckingEngine ? 'Checking...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Grid of indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Browser & Web Audio */}
        <div className="bg-[#101827] border border-white/5 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Browser Environment</span>
            <CheckCircle className="w-4 h-4 text-[#16C784]" />
          </div>
          <div>
            <p className="text-xs font-semibold text-white truncate">{diagnostics.browser}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">WebAudio & IDB: Fully Supported</p>
          </div>
        </div>

        {/* Local Python Engine Status */}
        <div className="bg-[#101827] border border-white/5 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Demucs AI Engine</span>
            {engineHealth.connected ? (
              <span className="w-2 h-2 rounded-full bg-[#16C784] animate-pulse" />
            ) : engineHealth.state === 'connecting' ? (
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-400" />
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-white flex items-center gap-1.5">
              <span>{engineHealth.connected ? 'Demucs Engine Online' : engineHealth.statusText}</span>
            </p>
            <p className="text-[11px] text-slate-400 truncate mt-0.5" title={engineHealth.errorMessage || settings.pythonEngineUrl}>
              {engineHealth.connected
                ? `${engineHealth.device} (${engineHealth.defaultModel || 'htdemucs'})`
                : 'Offline • Run start.bat'}
            </p>
          </div>
        </div>

        {/* Local Storage */}
        <div className="bg-[#101827] border border-white/5 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Local IndexedDB</span>
            <HardDrive className="w-4 h-4 text-[#7357F5]" />
          </div>
          <div>
            <p className="text-xs font-semibold text-white">
              {storage?.usedBytes ? formatFileSize(storage.usedBytes) : 'Minimal'} Used
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {storage?.quotaBytes ? `of ${formatFileSize(storage.quotaBytes)} browser quota` : 'Local sandbox cache'}
            </p>
          </div>
        </div>

        {/* Workstation Hardware */}
        <div className="bg-[#101827] border border-white/5 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Workstation Specs</span>
            <Cpu className="w-4 h-4 text-[#3984FF]" />
          </div>
          <div>
            <p className="text-xs font-semibold text-white">
              {diagnostics.hardwareConcurrency} CPU Threads
              {diagnostics.deviceMemoryGB ? ` • ~${diagnostics.deviceMemoryGB} GB RAM` : ''}
            </p>
            <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
              {diagnostics.isOnline ? (
                <>
                  <Wifi className="w-3 h-3 text-[#16C784]" />
                  <span>Network Available (Offline Ready)</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-amber-400" />
                  <span>100% Offline Mode</span>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Processing Modes Summary */}
      <div className="bg-[#101827]/60 rounded-xl p-3.5 border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[#7357F5] flex-shrink-0" />
          <span className="text-slate-300">
            <strong>Active Separation Engine:</strong> Quick Local (Browser In-Phase/Out-of-Phase Cancellation).
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-400 text-[11px]">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#16C784]" />
          <span>Quick Local: Active</span>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-500 ml-2" />
          <span>AI Pro / Demucs: Standby (Stage 2)</span>
        </div>
      </div>
    </div>
  );
};
