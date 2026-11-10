import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Project, ProcessingJob, AppSettings } from '../types';

interface VocalStudioDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
    indexes: { 'by-date': string; 'by-status': string };
  };
  jobs: {
    key: string;
    value: ProcessingJob;
    indexes: { 'by-date': string; 'by-status': string; 'by-project': string };
  };
  audioFiles: {
    key: string;
    value: { id: string; blob: Blob; mimeType: string; fileName: string; updatedAt: number };
  };
  settings: {
    key: string;
    value: unknown;
  };
}

const DB_NAME = 'vocal_studio_ai_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<VocalStudioDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<VocalStudioDB>> {
  if (!dbPromise) {
    dbPromise = openDB<VocalStudioDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('projects')) {
          const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
          projectStore.createIndex('by-date', 'createdAt');
          projectStore.createIndex('by-status', 'status');
        }

        if (!db.objectStoreNames.contains('jobs')) {
          const jobStore = db.createObjectStore('jobs', { keyPath: 'id' });
          jobStore.createIndex('by-date', 'startedAt');
          jobStore.createIndex('by-status', 'status');
          jobStore.createIndex('by-project', 'projectId');
        }

        if (!db.objectStoreNames.contains('audioFiles')) {
          db.createObjectStore('audioFiles', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      },
    });
  }
  return dbPromise;
}

// Project Operations
export async function getAllProjects(): Promise<Project[]> {
  const db = await getDB();
  const projects = await db.getAll('projects');
  // Sort descending by creation date
  return projects.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getProjectById(id: string): Promise<Project | undefined> {
  const db = await getDB();
  return db.get('projects', id);
}

export async function saveProject(project: Project): Promise<void> {
  const db = await getDB();
  await db.put('projects', project);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['projects', 'audioFiles', 'jobs'], 'readwrite');
  await tx.objectStore('projects').delete(id);
  await tx.objectStore('audioFiles').delete(id);
  
  // Also clean up any associated jobs
  const jobIndex = tx.objectStore('jobs').index('by-project');
  let cursor = await jobIndex.openCursor(IDBKeyRange.only(id));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

// Job Operations
export async function getAllJobs(): Promise<ProcessingJob[]> {
  const db = await getDB();
  const jobs = await db.getAll('jobs');
  return jobs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
}

export async function saveJob(job: ProcessingJob): Promise<void> {
  const db = await getDB();
  await db.put('jobs', job);
}

export async function deleteJob(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('jobs', id);
}

export async function clearAllJobs(): Promise<void> {
  const db = await getDB();
  await db.clear('jobs');
}

// Audio Blob Cache (Optional persistence for audio previews)
export async function saveAudioBlob(id: string, blob: Blob, fileName: string, mimeType: string): Promise<void> {
  const db = await getDB();
  await db.put('audioFiles', {
    id,
    blob,
    mimeType,
    fileName,
    updatedAt: Date.now(),
  });
}

export async function getAudioBlob(id: string): Promise<Blob | undefined> {
  const db = await getDB();
  const item = await db.get('audioFiles', id);
  return item?.blob;
}

export async function deleteAudioBlob(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('audioFiles', id);
}

export async function clearAudioFiles(): Promise<void> {
  const db = await getDB();
  await db.clear('audioFiles');
}

// Settings
export async function loadSettings(): Promise<Partial<AppSettings> | null> {
  try {
    const db = await getDB();
    const stored = await db.get('settings', 'app_config');
    return (stored as Partial<AppSettings>) || null;
  } catch (err) {
    console.warn('Failed to load settings from DB:', err);
    return null;
  }
}

export async function persistSettings(settings: AppSettings): Promise<void> {
  const db = await getDB();
  await db.put('settings', settings, 'app_config');
}

// Storage Diagnostics
export async function getStorageDiagnostics() {
  const db = await getDB();
  const [projectsCount, jobsCount, audioCount] = await Promise.all([
    db.count('projects'),
    db.count('jobs'),
    db.count('audioFiles'),
  ]);

  let quotaBytes = 0;
  let usedBytes = 0;

  if (navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      quotaBytes = estimate.quota || 0;
      usedBytes = estimate.usage || 0;
    } catch (e) {
      console.warn('Storage estimate error:', e);
    }
  }

  return {
    projectsCount,
    jobsCount,
    audioCount,
    usedBytes,
    quotaBytes,
  };
}

export async function resetEntireDatabase(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['projects', 'jobs', 'audioFiles', 'settings'], 'readwrite');
  await tx.objectStore('projects').clear();
  await tx.objectStore('jobs').clear();
  await tx.objectStore('audioFiles').clear();
  await tx.objectStore('settings').clear();
  await tx.done;
}

