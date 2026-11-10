import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../store/useSettingsStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { useProjectStore } from '../store/useProjectStore';
import { useJobStore } from '../store/useJobStore';
import { Card } from '../components/common/Card';
import { Modal } from '../components/common/Modal';
import { getStorageDiagnostics, clearAudioFiles, resetEntireDatabase } from '../services/db';
import { formatFileSize } from '../services/audioMetadata';
import { getSystemDiagnostics } from '../services/engineClient';
import type { OutputAudioFormat, QualityPreset } from '../types';
import {
  Settings as SettingsIcon,
  Sliders,
  HardDrive,
  Info,
  CheckCircle,
  AlertTriangle,
  Shield,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings } = useSettingsStore();
  const { loadProjects } = useProjectStore();
  const { loadJobs } = useJobStore();
  const { showNotification } = useNotificationStore();

  const [storageInfo, setStorageInfo] = useState<{
    projectsCount: number;
    jobsCount: number;
    audioCount: number;
    usedBytes: number;
    quotaBytes: number;
  } | null>(null);

  const [diagnostics, setDiagnostics] = useState(getSystemDiagnostics);

  // Confirm modals
  const [showClearCacheModal, setShowClearCacheModal] = useState(false);
  const [showResetDbModal, setShowResetDbModal] = useState(false);

  const refreshStorage = () => {
    getStorageDiagnostics().then((res) => {
      setStorageInfo(res);
    });
    setDiagnostics(getSystemDiagnostics());
  };

  useEffect(() => {
    let isCancelled = false;
    getStorageDiagnostics().then((res) => {
      if (!isCancelled) {
        setStorageInfo(res);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  const handleClearCache = async () => {
    try {
      await clearAudioFiles();
      setShowClearCacheModal(false);
      refreshStorage();
      showNotification({
        type: 'info',
        title: 'Audio Cache Cleared',
        message: 'Temporary audio previews were purged from IndexedDB.',
      });
    } catch {
      showNotification({
        type: 'error',
        title: 'Cache Error',
        message: 'Failed to clear audio cache.',
      });
    }
  };

  const handleResetDatabase = async () => {
    try {
      await resetEntireDatabase();
      setShowResetDbModal(false);
      await loadProjects();
      await loadJobs();
      refreshStorage();
      showNotification({
        type: 'warning',
        title: 'Database Reset',
        message: 'All local projects, jobs, and settings have been cleared.',
      });
    } catch {
      showNotification({
        type: 'error',
        title: 'Reset Error',
        message: 'Failed to reset IndexedDB.',
      });
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Page Header */}
      <div className="border-b border-white/10 pb-5">
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <SettingsIcon className="w-6 h-6 text-[#7357F5]" />
          <span>Application Settings</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Configure audio export formats, loudness normalization and local browser storage.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Audio Quality & Export Preferences */}
        <Card className="p-6 sm:p-7 space-y-6">
          <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
            <Sliders className="w-5 h-5 text-[#7357F5]" />
            <h3 className="text-base font-semibold text-white">Audio & Export Defaults</h3>
          </div>

          <div className="space-y-4 text-xs">
            {/* Default Format */}
            <div className="space-y-1.5">
              <label className="font-medium text-slate-300">Default Export Format</label>
              <select
                value={settings.defaultFormat}
                onChange={(e) => updateSettings({ defaultFormat: e.target.value as OutputAudioFormat })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#101827] border border-white/10 text-white text-xs focus:outline-hidden focus:border-[#7357F5]"
              >
                <option value="wav">WAV Lossless (24-bit PCM)</option>
                <option value="flac">FLAC Lossless (Compressed)</option>
                <option value="mp3">MP3 High Quality (320 kbps)</option>
              </select>
            </div>

            {/* Default Quality Preset */}
            <div className="space-y-1.5">
              <label className="font-medium text-slate-300">Default Processing Quality</label>
              <select
                value={settings.defaultQuality}
                onChange={(e) => updateSettings({ defaultQuality: e.target.value as QualityPreset })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#101827] border border-white/10 text-white text-xs focus:outline-hidden focus:border-[#7357F5]"
              >
                <option value="fast">Fast (Instant preview)</option>
                <option value="high">High Quality (Recommended)</option>
                <option value="ultra">Ultra Fidelity (Maximum precision)</option>
              </select>
            </div>

            {/* Loudness Normalization */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#101827] border border-white/10">
              <div>
                <p className="font-medium text-white">Loudness Normalization</p>
                <p className="text-[11px] text-slate-400">Default new separations to -14 LUFS standard</p>
              </div>
              <input
                type="checkbox"
                checked={settings.normalizeOutput}
                onChange={(e) => updateSettings({ normalizeOutput: e.target.checked })}
                className="w-4 h-4 rounded-sm accent-[#7357F5] cursor-pointer"
              />
            </div>

            {/* Low-Memory Optimization */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#101827] border border-white/10">
              <div>
                <p className="font-medium text-white">Low-Memory Mode</p>
                <p className="text-[11px] text-slate-400">
                  Optimize memory usage for smooth playback on lower-spec devices
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.lowMemoryMode}
                onChange={(e) => updateSettings({ lowMemoryMode: e.target.checked })}
                className="w-4 h-4 rounded-sm accent-[#7357F5] cursor-pointer"
              />
            </div>
          </div>
        </Card>

        {/* Local IndexedDB Storage Management */}
        <Card className="p-6 sm:p-7 space-y-6">
          <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
            <HardDrive className="w-5 h-5 text-[#16C784]" />
            <h3 className="text-base font-semibold text-white">Local Storage & Sandbox</h3>
          </div>

          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-[#101827] border border-white/5">
                <span className="text-slate-400 block text-[11px]">Saved Projects</span>
                <span className="text-sm font-bold text-white font-mono">
                  {storageInfo?.projectsCount ?? 0}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#101827] border border-white/5">
                <span className="text-slate-400 block text-[11px]">Audit History Jobs</span>
                <span className="text-sm font-bold text-white font-mono">
                  {storageInfo?.jobsCount ?? 0}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#101827] border border-white/5">
                <span className="text-slate-400 block text-[11px]">Audio Blobs Cached</span>
                <span className="text-sm font-bold text-white font-mono">
                  {storageInfo?.audioCount ?? 0}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#101827] border border-white/5">
                <span className="text-slate-400 block text-[11px]">Browser Storage Used</span>
                <span className="text-sm font-bold text-[#16C784] font-mono">
                  {storageInfo?.usedBytes ? formatFileSize(storageInfo.usedBytes) : 'Minimal'}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                onClick={() => setShowClearCacheModal(true)}
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 font-medium transition-colors"
              >
                Purge Audio Cache
              </button>
              <button
                onClick={() => setShowResetDbModal(true)}
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-medium transition-colors"
              >
                Reset All Local Data
              </button>
            </div>
          </div>
        </Card>

        {/* About & System Specs */}
        <Card className="p-6 sm:p-7 space-y-6">
          <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
            <Info className="w-5 h-5 text-[#7357F5]" />
            <h3 className="text-base font-semibold text-white">About Vocal Remover</h3>
          </div>

          <div className="space-y-3.5 text-xs">
            <div className="flex justify-between py-1 border-b border-white/5">
              <span className="text-slate-400">Application:</span>
              <span className="font-semibold text-[#7357F5]">Vocal Remover Web Edition</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/5">
              <span className="text-slate-400">Build Version:</span>
              <span className="font-mono text-white">v1.2.0</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/5">
              <span className="text-slate-400">Host Environment:</span>
              <span className="text-white">{diagnostics.browser}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/5">
              <span className="text-slate-400">CPU Concurrency:</span>
              <span className="font-mono text-white">{diagnostics.hardwareConcurrency} Logical Cores</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/5">
              <span className="text-slate-400">Web Audio API:</span>
              <span className="text-[#16C784] font-medium flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                Hardware Accelerated
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Data Privacy:</span>
              <span className="text-[#16C784] font-medium flex items-center gap-1">
                <Shield className="w-3.5 h-3.5" />
                100% Local (Zero Cloud)
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Clear Cache Modal */}
      <Modal
        isOpen={showClearCacheModal}
        onClose={() => setShowClearCacheModal(false)}
        title="Purge Audio Cache"
        subtitle="Free up browser storage quota"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-300 leading-relaxed">
            This will delete stored preview audio files from browser IndexedDB. Project metadata, stems
            configuration, and processing history will be preserved.
          </p>
          <div className="flex justify-end gap-2.5 pt-2">
            <button
              onClick={() => setShowClearCacheModal(false)}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium border border-white/10"
            >
              Cancel
            </button>
            <button
              onClick={handleClearCache}
              className="px-4 py-2 rounded-xl bg-[#7357F5] hover:bg-[#6345ec] text-white font-medium"
            >
              Confirm Purge
            </button>
          </div>
        </div>
      </Modal>

      {/* Reset DB Modal */}
      <Modal
        isOpen={showResetDbModal}
        onClose={() => setShowResetDbModal(false)}
        title="Reset Entire Local Database"
        subtitle="Irreversible full reset"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
            <div>
              <p className="font-semibold text-white">Warning: Complete Reset</p>
              <p className="mt-1 leading-relaxed text-slate-300">
                This will wipe all projects, history logs, audio blobs, and preferences from this browser.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <button
              onClick={() => setShowResetDbModal(false)}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium border border-white/10"
            >
              Cancel
            </button>
            <button
              onClick={handleResetDatabase}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium"
            >
              Confirm Reset
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
