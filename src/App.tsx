import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { Loader2 } from 'lucide-react';

// Lazy-loaded pages to reduce initial JavaScript evaluation overhead for low-end PCs
const NewSeparation = lazy(() =>
  import('./pages/NewSeparation').then((module) => ({ default: module.NewSeparation }))
);
const Projects = lazy(() =>
  import('./pages/Projects').then((module) => ({ default: module.Projects }))
);
const HistoryPage = lazy(() =>
  import('./pages/History').then((module) => ({ default: module.HistoryPage }))
);
const SettingsPage = lazy(() =>
  import('./pages/Settings').then((module) => ({ default: module.SettingsPage }))
);
const Help = lazy(() =>
  import('./pages/Help').then((module) => ({ default: module.Help }))
);
const StudioPage = lazy(() =>
  import('./pages/Studio').then((module) => ({ default: module.StudioPage }))
);
const ModelsPage = lazy(() =>
  import('./pages/Models').then((module) => ({ default: module.ModelsPage }))
);

const PageLoader: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400 gap-3">
    <Loader2 className="w-6 h-6 animate-spin text-[#7357F5]" />
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
            path="history"
            element={
              <Suspense fallback={<PageLoader />}>
                <HistoryPage />
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
            path="help"
            element={
              <Suspense fallback={<PageLoader />}>
                <Help />
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
          <Route
            path="models"
            element={
              <Suspense fallback={<PageLoader />}>
                <ModelsPage />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
