import React from 'react';
import type { Project } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { formatDuration, formatFileSize } from '../../services/audioMetadata';
import { FolderOpen, ArrowRight, Music, Calendar, Clock, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface RecentProjectsListProps {
  projects: Project[];
  onDeleteProject?: (id: string) => void;
  onSelectProject?: (project: Project) => void;
}

export const RecentProjectsList: React.FC<RecentProjectsListProps> = ({
  projects,
  onDeleteProject,
  onSelectProject,
}) => {
  const navigate = useNavigate();
  const recent = projects.slice(0, 5);

  if (recent.length === 0) {
    return (
      <div className="bg-[#151F30] border border-white/10 rounded-2xl p-6 sm:p-8 text-center flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 mb-3">
          <FolderOpen className="w-6 h-6 text-[#7357F5]" />
        </div>
        <h4 className="text-base font-semibold text-white mb-1">No Projects Saved Yet</h4>
        <p className="text-xs text-slate-400 max-w-sm mb-4">
          Upload an audio file in the New Separation tab to create your first music isolation project.
        </p>
        <button
          onClick={() => navigate('/new')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#7357F5] to-[#3984FF] text-white text-xs font-semibold hover:opacity-95 transition-opacity"
        >
          <span>Start New Project</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#151F30] border border-white/10 rounded-2xl overflow-hidden shadow-lg flex flex-col">
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white tracking-tight">Recent Projects</h3>
          <p className="text-xs text-slate-400">Recently managed audio separations and tracks</p>
        </div>
        <button
          onClick={() => navigate('/projects')}
          className="text-xs text-[#3984FF] hover:text-white flex items-center gap-1 font-medium transition-colors"
        >
          <span>View All ({projects.length})</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="divide-y divide-white/5">
        {recent.map((project) => {
          const dateStr = new Date(project.createdAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });

          return (
            <div
              key={project.id}
              className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#182338] transition-colors"
            >
              {/* Left project details */}
              <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#7357F5]/20 to-[#3984FF]/20 border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5 sm:mt-0">
                  <Music className="w-5 h-5 text-[#7357F5]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-white truncate">{project.name}</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-slate-400 border border-white/5 uppercase">
                      {project.metadata.format}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                    <span className="truncate max-w-[200px]" title={project.originalFileName}>
                      {project.originalFileName}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {formatDuration(project.duration)}
                    </span>
                    <span>•</span>
                    <span>{formatFileSize(project.fileSize)}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {dateStr}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right status & actions */}
              <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0">
                <StatusBadge status={project.status} />

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      if (onSelectProject) onSelectProject(project);
                      navigate('/projects');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-medium border border-white/10 transition-colors"
                  >
                    Open
                  </button>

                  {onDeleteProject && (
                    <button
                      onClick={() => onDeleteProject(project.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Delete project"
                      aria-label="Delete project"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

