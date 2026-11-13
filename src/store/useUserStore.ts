import { create } from 'zustand';
import type { UserAccount } from '../services/userAuth';
import {
  getCurrentUser,
  loginUser,
  registerUser,
  logoutUser,
} from '../services/userAuth';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

interface UserStore {
  user: UserAccount | null;
  isAuthenticated: boolean;
  isAuthModalOpen: boolean;
  authModalAction: 'login' | 'register';
  pendingFile: File | null;
  openAuthModal: (action?: 'login' | 'register', file?: File | null) => void;
  closeAuthModal: () => void;
  setPendingFile: (file: File | null) => void;
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  register: (email: string, password: string, name?: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
}

export const useUserStore = create<UserStore>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isAuthModalOpen: false,
  authModalAction: 'login',
  pendingFile: null,

  init: async () => {
    if (isSupabaseConfigured && !import.meta.env.TEST) {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          const u = data.session.user;
          const userSession: UserAccount = {
            id: u.id,
            email: u.email || '',
            name: (u.user_metadata?.name as string) || (u.email || '').split('@')[0],
            createdAt: u.created_at || new Date().toISOString(),
          };
          set({ user: userSession, isAuthenticated: true });
          return;
        }
      } catch {
        // ignore
      }
    }

    const current = getCurrentUser();
    if (current) {
      set({ user: current, isAuthenticated: true });
    } else {
      set({ user: null, isAuthenticated: false });
    }
  },

  openAuthModal: (action = 'login', file = null) => {
    set({
      isAuthModalOpen: true,
      authModalAction: action,
      pendingFile: file || get().pendingFile,
    });
  },

  closeAuthModal: () => {
    set({ isAuthModalOpen: false });
  },

  setPendingFile: (file) => {
    set({ pendingFile: file });
  },

  login: async (email, password) => {
    const res = await loginUser(email, password);
    if (res.success && res.user) {
      set({ user: res.user, isAuthenticated: true, isAuthModalOpen: false });
    }
    return { success: res.success, message: res.message };
  },

  register: async (email, password, name) => {
    const res = await registerUser(email, password, name);
    if (res.success && res.user) {
      set({ user: res.user, isAuthenticated: true, isAuthModalOpen: false });
    }
    return { success: res.success, message: res.message };
  },

  logout: () => {
    logoutUser();
    set({ user: null, isAuthenticated: false, pendingFile: null });
  },
}));
