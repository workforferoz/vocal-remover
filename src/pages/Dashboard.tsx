import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../store/useProjectStore';
import { SimpleVocalRemover } from '../components/vocalremover/SimpleVocalRemover';
import { RecentProjectsList } from '../components/dashboard/RecentProjectsList';
import { FolderKanban } from 'lucide-react';
import type { Project } from '../types';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { projects, deleteProject, setActiveProject } = useProjectStore();

  return (
    <div className="space-y-12 pb-16">
      {/* Primary Clean Vocal Remover Tool */}
      <SimpleVocalRemover />

      {/* Recent Processed Songs (if any exist) */}
      {projects.length > 0 && (
        <div className="max-w-4xl mx-auto pt-6 border-t border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-[#7357F5]" />
              <span>Past Songs & Instrumentals ({projects.length})</span>
            </h2>
            <button
              onClick={() => navigate('/projects')}
              className="text-xs text-[#3984FF] hover:text-white font-medium transition-colors cursor-pointer"
            >
              View All Songs →
            </button>
          </div>

          <RecentProjectsList
            projects={projects.slice(0, 4)}
            onDeleteProject={deleteProject}
            onSelectProject={(proj: Project) => {
              setActiveProject(proj);
              navigate(`/studio/${proj.id}`);
            }}
          />
        </div>
      )}
    </div>
  );
};
