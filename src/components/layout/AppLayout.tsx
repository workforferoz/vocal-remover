import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { NotificationContainer } from '../common/NotificationContainer';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useProjectStore } from '../../store/useProjectStore';
import { useJobStore } from '../../store/useJobStore';

export const AppLayout: React.FC = () => {
  const { initSettings, checkEngine } = useSettingsStore();
  const { loadProjects } = useProjectStore();
  const { loadJobs } = useJobStore();

  useEffect(() => {
    // Initial data hydration from IndexedDB
    initSettings();
    loadProjects();
    loadJobs();
    checkEngine();
  }, [initSettings, loadProjects, loadJobs, checkEngine]);

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
