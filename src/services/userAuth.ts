// User Account Authentication Service for Vocal Remover
// Client-side secure storage with SHA-256 salted password hashing & rate limiting
// Integrated with Supabase Auth for cloud sync

import { sanitizeText } from '../utils/sanitize';
import { supabase, isSupabaseConfigured } from './supabaseClient';

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

interface StoredAccountRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

const STORAGE_KEY_USERS = 'vocal_remover_registered_accounts';
const STORAGE_KEY_SESSION = 'vocal_remover_active_user_session';
const STORAGE_KEY_RATE_LIMIT = 'vocal_remover_user_login_rate_limit';

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes lockout

// Allow unit tests to run fast and deterministically offline
const useLiveSupabase = isSupabaseConfigured && !import.meta.env.TEST;

let inMemoryStorage: Record<string, string> = {};

function safeGet(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const v = window.localStorage.getItem(key);
      if (v !== null) return v;
    }
  } catch {
    // fallback
  }
  return inMemoryStorage[key] || null;
}

function safeSet(key: string, val: string): void {
  inMemoryStorage[key] = val;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, val);
    }
  } catch {
    // fallback
  }
}

function safeRemove(key: string): void {
  delete inMemoryStorage[key];
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // fallback
  }
}

/**
 * Generate random hex salt
 */
function generateSalt(): string {
  const arr = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < 16; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash password with salt using SHA-256 (with fallback for non-secure HTTP environments)
 */
export async function hashUserPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`vocal-user-salt:${salt}:${password}`);
  if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Deterministic fallback hash for non-secure HTTP / legacy contexts
  let h1 = 0xdeadbeef;
  let h2 = 0x41c64e6d;
  for (let i = 0; i < data.length; i++) {
    const ch = data[i];
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(16, '0');
}

/**
 * Check login rate limit
 */
export function checkUserLoginRateLimit(): { isLocked: boolean; remainingSeconds: number } {
  try {
    const raw = safeGet(STORAGE_KEY_RATE_LIMIT);
    if (!raw) return { isLocked: false, remainingSeconds: 0 };
    const parsed = JSON.parse(raw);
    const now = Date.now();
    if (parsed.lockedUntil && parsed.lockedUntil > now) {
      return {
        isLocked: true,
        remainingSeconds: Math.ceil((parsed.lockedUntil - now) / 1000),
      };
    }
  } catch {
    // ignore
  }
  return { isLocked: false, remainingSeconds: 0 };
}

function recordFailedLoginAttempt(): void {
  try {
    const now = Date.now();
    const raw = safeGet(STORAGE_KEY_RATE_LIMIT);
    const record = raw ? JSON.parse(raw) : { attempts: [], lockedUntil: null };
    record.attempts = (record.attempts || []).filter((ts: number) => now - ts < LOGIN_LOCKOUT_MS);
    record.attempts.push(now);
    if (record.attempts.length >= MAX_LOGIN_ATTEMPTS) {
      record.lockedUntil = now + LOGIN_LOCKOUT_MS;
    }
    safeSet(STORAGE_KEY_RATE_LIMIT, JSON.stringify(record));
  } catch {
    // ignore
  }
}

function clearUserLoginRateLimit(): void {
  safeRemove(STORAGE_KEY_RATE_LIMIT);
}

function getStoredAccounts(): StoredAccountRecord[] {
  try {
    const raw = safeGet(STORAGE_KEY_USERS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Get currently authenticated user session
 */
export function getCurrentUser(): UserAccount | null {
  try {
    const raw = safeGet(STORAGE_KEY_SESSION);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Register a new user account
 */
export async function registerUser(
  rawEmail: string,
  rawPassword: string,
  rawName?: string
): Promise<{ success: boolean; user?: UserAccount; message: string }> {
  const email = sanitizeText(rawEmail.toLowerCase().trim(), 120);
  const password = rawPassword.trim();
  const name = sanitizeText(rawName?.trim() || email.split('@')[0], 60);

  // Email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { success: false, message: 'Please enter a valid email address.' };
  }

  // Password length check
  if (password.length < 6) {
    return { success: false, message: 'Password must be at least 6 characters.' };
  }

  // Check if account already exists locally
  const accounts = getStoredAccounts();
  const existing = accounts.find((a) => a.email === email);
  if (existing) {
    return { success: false, message: 'An account with this email already exists. Please sign in.' };
  }

  // 1. Create secure local account immediately (100% reliable, zero network latency, no Failed to fetch)
  const salt = generateSalt();
  const passwordHash = await hashUserPassword(password, salt);

  const newAccount: StoredAccountRecord = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    email,
    name,
    passwordHash,
    salt,
    createdAt: new Date().toISOString(),
  };

  accounts.push(newAccount);
  safeSet(STORAGE_KEY_USERS, JSON.stringify(accounts));

  const userSession: UserAccount = {
    id: newAccount.id,
    email: newAccount.email,
    name: newAccount.name,
    createdAt: newAccount.createdAt,
  };

  safeSet(STORAGE_KEY_SESSION, JSON.stringify(userSession));
  clearUserLoginRateLimit();

  // 2. Background non-blocking sync with Supabase (fire-and-forget, never blocks the user)
  if (useLiveSupabase) {
    try {
      supabase.auth
        .signUp({
          email,
          password,
          options: {
            data: { name },
          },
        })
        .then(({ data, error }) => {
          if (!error && data?.user) {
            userSession.id = data.user.id;
            safeSet(STORAGE_KEY_SESSION, JSON.stringify(userSession));
          }
        })
        .catch((err) => {
          console.warn('Background Supabase cloud backup skipped:', err);
        });
    } catch {
      // non-blocking
    }
  }

  return {
    success: true,
    user: userSession,
    message: 'Account created successfully! 5 free conversion tokens are active.',
  };
}

/**
 * Log into an existing user account
 */
export async function loginUser(
  rawEmail: string,
  rawPassword: string
): Promise<{ success: boolean; user?: UserAccount; message: string }> {
  const rateLimit = checkUserLoginRateLimit();
  if (rateLimit.isLocked) {
    const mins = Math.ceil(rateLimit.remainingSeconds / 60);
    return {
      success: false,
      message: `Too many failed login attempts. Please wait ${mins} minute${mins === 1 ? '' : 's'} before trying again.`,
    };
  }

  const email = sanitizeText(rawEmail.toLowerCase().trim(), 120);
  const password = rawPassword.trim();

  if (!email || !password) {
    return { success: false, message: 'Please enter both email and password.' };
  }

  // 1. Check local registered accounts first (instant, works offline, 100% on-device)
  const accounts = getStoredAccounts();
  const account = accounts.find((a) => a.email === email);

  if (account) {
    const hash = await hashUserPassword(password, account.salt);
    if (hash === account.passwordHash) {
      const userSession: UserAccount = {
        id: account.id,
        email: account.email,
        name: account.name,
        createdAt: account.createdAt,
      };

      safeSet(STORAGE_KEY_SESSION, JSON.stringify(userSession));
      clearUserLoginRateLimit();

      // Background sign in with Supabase if online
      if (useLiveSupabase) {
        try {
          supabase.auth.signInWithPassword({ email, password }).catch(() => {});
        } catch {
          // ignore
        }
      }

      return {
        success: true,
        user: userSession,
        message: `Welcome back, ${account.name || account.email}!`,
      };
    } else {
      recordFailedLoginAttempt();
      return { success: false, message: 'Incorrect password. Please try again.' };
    }
  }

  // 2. If not found locally, try Supabase Auth (for accounts created on other devices)
  if (useLiveSupabase) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error && data?.user) {
        const userSession: UserAccount = {
          id: data.user.id,
          email: data.user.email || email,
          name: (data.user.user_metadata?.name as string) || email.split('@')[0],
          createdAt: data.user.created_at || new Date().toISOString(),
        };

        // Also save to local accounts for future instant offline access
        const salt = generateSalt();
        const passwordHash = await hashUserPassword(password, salt);
        accounts.push({
          id: userSession.id,
          email: userSession.email,
          name: userSession.name,
          passwordHash,
          salt,
          createdAt: userSession.createdAt,
        });
        safeSet(STORAGE_KEY_USERS, JSON.stringify(accounts));
        safeSet(STORAGE_KEY_SESSION, JSON.stringify(userSession));
        clearUserLoginRateLimit();

        return {
          success: true,
          user: userSession,
          message: `Welcome back, ${userSession.name}!`,
        };
      }
    } catch {
      // Supabase network unreachable
    }
  }

  recordFailedLoginAttempt();
  return {
    success: false,
    message: 'No account found with this email. Please check your credentials or create a free account.',
  };
}

/**
 * Log out current active user
 */
export async function logoutUser(): Promise<void> {
  safeRemove(STORAGE_KEY_SESSION);
  if (useLiveSupabase) {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
  }
}

/**
 * For testing purposes only
 */
export function resetUsersForTesting(): void {
  inMemoryStorage = {};
  safeRemove(STORAGE_KEY_USERS);
  safeRemove(STORAGE_KEY_SESSION);
  safeRemove(STORAGE_KEY_RATE_LIMIT);
}
