import { create } from 'zustand';
import type { ProcessingJob } from '../types';
import { getAllJobs, saveJob, deleteJob as dbDeleteJob, clearAllJobs } from '../services/db';

interface JobState {
  jobs: ProcessingJob[];
  isLoading: boolean;
  statusFilter: string;
  searchQuery: string;

  loadJobs: () => Promise<void>;
  createJob: (job: ProcessingJob) => Promise<void>;
  updateJob: (id: string, updates: Partial<ProcessingJob>) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;
  clearJobs: () => Promise<void>;
  setStatusFilter: (filter: string) => void;
  setSearchQuery: (query: string) => void;
}

export const useJobStore = create<JobState>((set, get) => ({
  jobs: [],
  isLoading: false,
  statusFilter: 'all',
  searchQuery: '',

  loadJobs: async () => {
    set({ isLoading: true });
    try {
      const jobs = await getAllJobs();
      set({ jobs, isLoading: false });
    } catch (err) {
      console.error('Failed to load processing jobs:', err);
      set({ isLoading: false });
    }
  },

  createJob: async (job: ProcessingJob) => {
    try {
      await saveJob(job);
      set({ jobs: [job, ...get().jobs.filter((j) => j.id !== job.id)] });
    } catch (err) {
      console.error('Failed to save job:', err);
      throw err;
    }
  },

  updateJob: async (id: string, updates: Partial<ProcessingJob>) => {
    const existing = get().jobs.find((j) => j.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    try {
      await saveJob(updated);
      set({
        jobs: get().jobs.map((j) => (j.id === id ? updated : j)),
      });
    } catch (err) {
      console.error('Failed to update job:', err);
      throw err;
    }
  },

  deleteJob: async (id: string) => {
    try {
      await dbDeleteJob(id);
      set({ jobs: get().jobs.filter((j) => j.id !== id) });
    } catch (err) {
      console.error('Failed to delete job:', err);
      throw err;
    }
  },

  clearJobs: async () => {
    try {
      await clearAllJobs();
      set({ jobs: [] });
    } catch (err) {
      console.error('Failed to clear jobs:', err);
      throw err;
    }
  },

  setStatusFilter: (filter) => {
    set({ statusFilter: filter });
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },
}));

