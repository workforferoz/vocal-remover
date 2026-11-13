import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { useProjectStore } from '../store/useProjectStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { StatusBadge } from '../components/common/StatusBadge';
import { EmptyState } from '../components/common/EmptyState';
import { Modal } from '../components/common/Modal';
import { AudioPlayer } from '../components/audio/AudioPlayer';
import { getAudioBlob } from '../services/db';
import { formatDuration, formatFileSize } from '../services/audioMetadata';
import { sanitizeSearch } from '../utils/sanitize';
import type { Project } from '../types';
import {
  FolderKanban,
  Search,
  PlusCircle,
  Play,
  Trash2,
  Download,
  Calendar,
  Clock,
  HardDrive,
  Layers,
  FileAudio,
  AlertTriangle,
  Sliders,
} from 'lucide-react';

export const Projects: React.FC = () => {
  usePageMeta(
    'My Songs - Processed Audio Stems & Separations | Vocal Remover',
    'Browse and manage your separated vocal and instrumental songs.'
  );

  const navigate = useNavigate();
  const { projects, deleteProject, searchQuery, setSearchQuery, statusFilter, setStatusFilter } =
    useProjectStore();
  const { showNotification } = useNotificationStore();

  // Active audio preview state
  const [playingProject, setPlayingProject] = useState<Project | null>(null);
  const [projectBlob, setProjectBlob] = useState<Blob | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  // Delete confirmation modal state
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  // Selected project details modal state
  const [detailProject, setDetailProject] = useState<Project | null>(null);

  // Load audio blob when previewing a project
  useEffect(() => {
    let isCancelled = false;

    if (!playingProject) {
      const timer = setTimeout(() => {
        setProjectBlob(null);
        setIsLoadingAudio(false);
      }, 0);
      return () => clearTimeout(timer);
    }

    getAudioBlob(playingProject.id)
      .then((blob) => {
        if (!isCancelled) {
          setProjectBlob(blob || null);
          setIsLoadingAudio(false);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setProjectBlob(null);
          setIsLoadingAudio(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [playingProject]);

  // Filter projects by search and status
  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.originalFileName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'completed' && p.status === 'completed') ||
      (statusFilter === 'queued' && p.status === 'queued') ||
      (statusFilter === 'draft' && p.status === 'draft');

    return matchesSearch && matchesStatus;
  });

  const handleDeleteConfirm = async () => {
    if (!projectToDelete) return;
    try {
      await deleteProject(projectToDelete.id);
      showNotification({
        type: 'success',
        title: 'Project Deleted',
        message: `Project "${projectToDelete.name}" was removed from local storage.`,
      });
      if (playingProject?.id === projectToDelete.id) {
        setPlayingProject(null);
      }
      setProjectToDelete(null);
    } catch {
      showNotification({
        type: 'error',
        title: 'Delete Failed',
        message: 'Could not remove project from database.',
      });
    }
  };

  const handleExportMetadata = (project: Project) => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(project, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${project.name.replace(/\s+/g, '_')}_metadata.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    showNotification({
      type: 'info',
      title: 'Metadata Exported',
      message: `Exported JSON metadata for "${project.name}".`,
    });
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <FolderKanban className="w-6 h-6 text-blue-400" />
            <span>My Songs</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Browse stored project metadata, inspect audio details, and preview tracks.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/new')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors w-fit cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Separation</span>
        </button>
      </div>

      {/* Floating Audio Preview bar if project selected */}
      {playingProject && (
        <div className="relative rounded-2xl p-4 bg-[#0F172A] border border-slate-700 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Playing Track: {playingProject.name}</span>
            </span>
            <button
              type="button"
              onClick={() => setPlayingProject(null)}
              className="text-xs text-slate-300 hover:text-white px-2 py-0.5 rounded bg-slate-800"
            >
              Close Player
            </button>
          </div>
          {isLoadingAudio ? (
            <p className="text-xs text-slate-400 py-3 text-center">Loading audio preview buffer...</p>
          ) : (
            <AudioPlayer
              blob={projectBlob || undefined}
              fileName={playingProject.originalFileName}
              peaks={playingProject.metadata.peaks}
              autoPlay={true}
            />
          )}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(sanitizeSearch(e.target.value))}
            placeholder="Search by project name or file..."
            maxLength={60}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 self-start md:self-auto overflow-x-auto">
          {[
            { id: 'all', label: 'All Projects' },
            { id: 'completed', label: 'Completed' },
            { id: 'queued', label: 'Processing' },
            { id: 'draft', label: 'Drafts' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Project Cards List */}
      {filteredProjects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={searchQuery || statusFilter !== 'all' ? 'No Matching Projects' : 'No Projects Yet'}
          description={
            searchQuery || statusFilter !== 'all'
              ? 'Try modifying your search keywords or clearing status filters.'
              : 'You have not uploaded any tracks yet. Click New Separation to start isolating stems.'
          }
          actionText={searchQuery || statusFilter !== 'all' ? undefined : 'Start First Separation'}
          onAction={searchQuery || statusFilter !== 'all' ? undefined : () => navigate('/new')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((project) => {
            const dateStr = new Date(project.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });

            const isPlayingThis = playingProject?.id === project.id;

            return (
              <div
                key={project.id}
                className={`rounded-2xl border p-5 flex flex-col justify-between transition-colors duration-150 ${
                  isPlayingThis
                    ? 'bg-slate-900 border-blue-500 shadow-md ring-1 ring-blue-500/50'
                    : 'bg-[#0F172A] border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400 flex items-center justify-center flex-shrink-0">
                      <FileAudio className="w-5 h-5" />
                    </div>
                    <StatusBadge status={project.status} />
                  </div>

                  {/* Title & File */}
                  <h3 className="text-base font-semibold text-white tracking-tight truncate" title={project.name}>
                    {project.name}
                  </h3>
                  <p className="text-xs text-slate-300 truncate mt-0.5" title={project.originalFileName}>
                    {project.originalFileName}
                  </p>

                  {/* Mode & Specs Pill */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-3 text-[11px]">
                    <span className="px-2 py-0.5 rounded-md bg-slate-900 text-slate-300 border border-slate-800 uppercase font-mono">
                      {project.metadata.format}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-blue-600/15 text-blue-300 border border-blue-500/30">
                      {project.config.mode === 'multi-stem' ? '4-Stem' : '2-Stem'}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-900 text-slate-300 border border-slate-800">
                      {project.config.outputFormat.toUpperCase()}
                    </span>
                  </div>

                  {/* Metadata Stats */}
                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-white/5 text-xs text-slate-300">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>{formatDuration(project.duration)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                      <span>{formatFileSize(project.fileSize)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400 col-span-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>{dateStr}</span>
                    </div>
                  </div>

                  {/* Stems status preview */}
                  <div className="mt-4 pt-3 border-t border-white/5">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                      Configured Stems
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {project.stems.map((s) => (
                        <span
                          key={s.id}
                          className={`text-[10px] px-2 py-0.5 rounded-md border ${
                            s.available
                              ? 'bg-[#16C784]/10 text-[#16C784] border-[#16C784]/30'
                              : 'bg-white/5 text-slate-400 border-white/5'
                          }`}
                        >
                          {s.label} {s.available ? '✓' : '(Queued)'}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        if (!isPlayingThis) setIsLoadingAudio(true);
                        setPlayingProject(isPlayingThis ? null : project);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        isPlayingThis
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
                      }`}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{isPlayingThis ? 'Stop' : 'Play'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => navigate(`/studio/${project.id}`)}
                      className="px-3 py-1.5 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 border border-blue-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Open in Multitrack Studio"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Studio</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setDetailProject(project)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                      title="Inspect metadata"
                      aria-label="Inspect metadata"
                    >
                      <Layers className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleExportMetadata(project)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                      title="Export metadata JSON"
                      aria-label="Export metadata JSON"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setProjectToDelete(project)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Delete project"
                      aria-label="Delete project"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(projectToDelete)}
        onClose={() => setProjectToDelete(null)}
        title="Delete Project"
        subtitle="This action cannot be undone"
      >
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
            <div>
              <p className="font-semibold text-white">Permanently delete "{projectToDelete?.name}"?</p>
              <p className="text-slate-300 mt-1 leading-relaxed">
                This will delete the project record, audio cache, and separation parameters from your local
                IndexedDB storage.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setProjectToDelete(null)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-medium border border-slate-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium shadow-sm transition-colors cursor-pointer"
            >
              Confirm Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* Project Details Modal */}
      <Modal
        isOpen={Boolean(detailProject)}
        onClose={() => setDetailProject(null)}
        title={detailProject?.name || 'Project Details'}
        subtitle="Complete technical audio metadata and configuration"
        maxWidth="lg"
      >
        {detailProject && (
          <div className="space-y-4 text-xs">
            <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 space-y-2.5">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Project ID:</span>
                <span className="font-mono text-white">{detailProject.id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Original File Name:</span>
                <span className="font-mono text-white truncate max-w-xs">{detailProject.originalFileName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Status:</span>
                <StatusBadge status={detailProject.status} />
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Processing Mode:</span>
                <span className="font-mono text-blue-400">{detailProject.config.mode}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Sample Rate:</span>
                <span className="font-mono text-white">{detailProject.metadata.sampleRate} Hz</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Audio Channels:</span>
                <span className="font-mono text-white">{detailProject.metadata.channels} (Stereo)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Duration:</span>
                <span className="font-mono text-white">{formatDuration(detailProject.duration)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">File Size:</span>
                <span className="font-mono text-white">{formatFileSize(detailProject.fileSize)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Quality Preset:</span>
                <span className="font-mono text-white capitalize">{detailProject.config.quality}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Target Output:</span>
                <span className="font-mono text-white uppercase">{detailProject.config.outputFormat}</span>
              </div>
              {detailProject.backendJobId && (
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Task ID:</span>
                  <span className="font-mono text-emerald-400">{detailProject.backendJobId}</span>
                </div>
              )}
            </div>

            {/* Separated Stems in Detail Modal */}
            {detailProject.stems && detailProject.stems.length > 0 && (
              <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 space-y-2">
                <span className="text-xs font-semibold text-white">Separated Stems</span>
                <div className="space-y-1.5 pt-1">
                  {detailProject.stems.map((stem) => (
                    <div
                      key={stem.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white capitalize">{stem.label}</span>
                        {stem.fileSize && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            ({formatFileSize(stem.fileSize)})
                          </span>
                        )}
                      </div>
                      {stem.url ? (
                        <a
                          href={stem.url}
                          download={`${detailProject.name}_${stem.type}.wav`}
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 font-semibold text-[11px] transition-colors"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download WAV</span>
                        </a>
                      ) : (
                        <span className="text-[10px] text-slate-500">Local Only</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleExportMetadata(detailProject)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export JSON</span>
              </button>
              <button
                type="button"
                onClick={() => setDetailProject(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium border border-slate-700 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
