import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { AdminGuard } from './components/auth/AdminGuard';
import { Loader2 } from 'lucide-react';

const NewSeparation = lazy(() =>
  import('./pages/NewSeparation').then((module) => ({ default: module.NewSeparation }))
);
const Projects = lazy(() =>
  import('./pages/Projects').then((module) => ({ default: module.Projects }))
);
const SettingsPage = lazy(() =>
  import('./pages/Settings').then((module) => ({ default: module.SettingsPage }))
);
const StudioPage = lazy(() =>
  import('./pages/Studio').then((module) => ({ default: module.StudioPage }))
);
const Admin = lazy(() =>
  import('./pages/Admin').then((module) => ({ default: module.Admin }))
);
const PrivacyPolicy = lazy(() =>
  import('./pages/PrivacyPolicy').then((module) => ({ default: module.PrivacyPolicy }))
);
const NotFound = lazy(() =>
  import('./pages/NotFound').then((module) => ({ default: module.NotFound }))
);

const PageLoader: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-300 gap-3">
    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
    <span className="text-xs font-medium">Loading workspace...</span>
  </div>
);

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route
            path="new"
            element={
              <Suspense fallback={<PageLoader />}>
                <NewSeparation />
              </Suspense>
            }
          />
          <Route
            path="projects"
            element={
              <Suspense fallback={<PageLoader />}>
                <Projects />
              </Suspense>
            }
          />
          <Route
            path="settings"
            element={
              <Suspense fallback={<PageLoader />}>
                <SettingsPage />
              </Suspense>
            }
          />
          <Route
            path="studio/:projectId"
            element={
              <Suspense fallback={<PageLoader />}>
                <StudioPage />
              </Suspense>
            }
          />
          {/* Protected Admin Route */}
          <Route
            path="admin"
            element={
              <AdminGuard>
                <Suspense fallback={<PageLoader />}>
                  <Admin />
                </Suspense>
              </AdminGuard>
            }
          />
          {/* Privacy Policy & Legal Compliance */}
          <Route
            path="privacy"
            element={
              <Suspense fallback={<PageLoader />}>
                <PrivacyPolicy />
              </Suspense>
            }
          />
          {/* Legacy alias */}
          <Route path="history" element={<Navigate to="/projects" replace />} />
          {/* Custom 404 Page */}
          <Route
            path="*"
            element={
              <Suspense fallback={<PageLoader />}>
                <NotFound />
              </Suspense>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
