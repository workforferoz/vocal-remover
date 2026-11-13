import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { NotificationContainer } from '../common/NotificationContainer';
import { CookieConsentBanner } from '../common/CookieConsentBanner';
import { BuyTokensModal } from '../tokens/BuyTokensModal';
import { AuthModal } from '../auth/AuthModal';
import { useTokenStore } from '../../store/useTokenStore';
import { useUserStore } from '../../store/useUserStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useProjectStore } from '../../store/useProjectStore';
import { useJobStore } from '../../store/useJobStore';

export const AppLayout: React.FC = () => {
  const { init: initTokens } = useTokenStore();
  const { init: initUser } = useUserStore();
  const { initSettings, checkEngine } = useSettingsStore();
  const { loadProjects } = useProjectStore();
  const { loadJobs } = useJobStore();

  useEffect(() => {
    // Initialize user session & user tokens
    initUser();
    initTokens();

    // Initial data hydration from IndexedDB
    initSettings();
    loadProjects();
    loadJobs();
    checkEngine();
  }, [initUser, initTokens, initSettings, loadProjects, loadJobs, checkEngine]);

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 flex flex-col justify-between overflow-x-hidden">
      {/* Header bar */}
      <Header />

      {/* Main Page Content - Clean centered layout */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-5xl w-full mx-auto animate-in fade-in duration-150">
        <Outlet />
      </main>

      {/* Footer with feature cards */}
      <Footer />

      {/* Global Token Recharge & Voucher Modal */}
      <BuyTokensModal />

      {/* Global User Authentication (Login/Register) Modal */}
      <AuthModal />

      {/* Global toast notification system */}
      <NotificationContainer />

      {/* Cookie & Local Storage Consent Banner */}
      <CookieConsentBanner />
    </div>
  );
};
