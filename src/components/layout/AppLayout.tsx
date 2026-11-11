import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { NotificationContainer } from '../common/NotificationContainer';
import { ActivationGate } from '../auth/ActivationGate';
import { isSoftwareActivated } from '../../services/licenseService';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useProjectStore } from '../../store/useProjectStore';
import { useJobStore } from '../../store/useJobStore';
import { Loader2 } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const [isLicensed, setIsLicensed] = useState<boolean | null>(null);
  const { initSettings, checkEngine } = useSettingsStore();
  const { loadProjects } = useProjectStore();
  const { loadJobs } = useJobStore();

  useEffect(() => {
    // Check license activation status
    isSoftwareActivated().then((activated) => {
      setIsLicensed(activated);
    });

    // Initial data hydration from IndexedDB
    initSettings();
    loadProjects();
    loadJobs();
    checkEngine();
  }, [initSettings, loadProjects, loadJobs, checkEngine]);

  // Loading state while checking license on startup
  if (isLicensed === null) {
    return (
      <div className="min-h-screen bg-[#080D18] flex items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-7 h-7 text-[#7357F5] animate-spin" />
        <span className="text-xs font-mono tracking-wider uppercase">Verifying license...</span>
      </div>
    );
  }

  // If not activated with valid 16-digit code, show Activation Gate
  if (!isLicensed) {
    return (
      <>
        <ActivationGate onSuccess={() => setIsLicensed(true)} />
        <NotificationContainer />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#080D18] text-[#F8FAFC] flex flex-col justify-between">
      {/* Header bar */}
      <Header />

      {/* Main Page Content - Clean centered layout */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-5xl w-full mx-auto animate-in fade-in duration-150">
        <Outlet />
      </main>

      {/* Footer with feature cards */}
      <Footer />

      {/* Global toast notification system */}
      <NotificationContainer />
    </div>
  );
};
