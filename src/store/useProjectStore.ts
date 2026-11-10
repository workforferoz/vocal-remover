import { create } from 'zustand';
import type { Project } from '../types';
import { getAllProjects, saveProject, deleteProject as dbDeleteProject, saveAudioBlob } from '../services/db';

interface ProjectState {
  projects: Project[];
  activeProject: Project | null;
  isLoading: boolean;
  searchQuery: string;
  statusFilter: string;
  
  loadProjects: () => Promise<void>;
  createProject: (project: Project, file?: File) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  setActiveProject: (project: Project | null) => void;
  setSearchQuery: (query: string) => void;
  setStatusFilter: (filter: string) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProject: null,
  isLoading: false,
  searchQuery: '',
  statusFilter: 'all',

  loadProjects: async () => {
    set({ isLoading: true });
    try {
      const projects = await getAllProjects();
      set({ projects, isLoading: false });
    } catch (err) {
      console.error('Failed to load projects:', err);
      set({ isLoading: false });
    }
  },

  createProject: async (project: Project, file?: File) => {
    try {
      if (file) {
        await saveAudioBlob(project.id, file, file.name, file.type);
      }
      await saveProject(project);
      set({ projects: [project, ...get().projects.filter((p) => p.id !== project.id)] });
    } catch (err) {
      console.error('Failed to save project:', err);
      throw err;
    }
  },

  deleteProject: async (id: string) => {
    try {
      await dbDeleteProject(id);
      set({
        projects: get().projects.filter((p) => p.id !== id),
        activeProject: get().activeProject?.id === id ? null : get().activeProject,
      });
    } catch (err) {
      console.error('Failed to delete project:', err);
      throw err;
    }
  },

  setActiveProject: (project) => {
    set({ activeProject: project });
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  setStatusFilter: (filter) => {
    set({ statusFilter: filter });
  },
}));

