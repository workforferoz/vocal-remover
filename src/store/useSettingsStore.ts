import { create } from 'zustand';
import type { AppSettings, EngineHealth } from '../types';
import { loadSettings, persistSettings } from '../services/db';
import { checkPythonEngineHealth, DEFAULT_PYTHON_ENGINE_URL } from '../services/engineClient';

interface SettingsState {
  settings: AppSettings;
  engineHealth: EngineHealth;
  isCheckingEngine: boolean;
  isInitialized: boolean;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  checkEngine: () => Promise<void>;
  initSettings: () => Promise<void>;
}

const DEFAULT_SETTINGS: AppSettings = {
  accentColor: 'purple',
  defaultFormat: 'wav',
  defaultQuality: 'high',
  normalizeOutput: true,
  pythonEngineUrl: DEFAULT_PYTHON_ENGINE_URL,
  devicePreference: 'auto',
  autoPingEngine: false,
  lowMemoryMode: true,
  maxUploadSizeBytes: 150 * 1024 * 1024,
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  engineHealth: {
    connected: false,
    state: 'connecting',
    statusText: 'Checking Engine...',
    lastChecked: Date.now(),
    errorMessage: 'Checking connection to local engine at 127.0.0.1:8524',
  },
  isCheckingEngine: false,
  isInitialized: false,

  initSettings: async () => {
    try {
      const stored = await loadSettings();
      if (stored) {
        set({ settings: { ...DEFAULT_SETTINGS, ...stored }, isInitialized: true });
      } else {
        set({ isInitialized: true });
      }
    } catch {
      set({ isInitialized: true });
    }
  },

  updateSettings: async (partial: Partial<AppSettings>) => {
    const updated = { ...get().settings, ...partial };
    set({ settings: updated });
    await persistSettings(updated);
  },

  checkEngine: async () => {
    set({ isCheckingEngine: true });
    try {
      const health = await checkPythonEngineHealth(get().settings.pythonEngineUrl);
      set({ engineHealth: health, isCheckingEngine: false });
    } catch (err) {
      set({
        engineHealth: {
          connected: false,
          state: 'connection-error',
          statusText: 'Connection Error',
          lastChecked: Date.now(),
          errorMessage: err instanceof Error ? err.message : 'Failed to connect to local engine',
        },
        isCheckingEngine: false,
      });
    }
  },
}));
