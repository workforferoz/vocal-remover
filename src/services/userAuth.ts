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

function isNetworkOrFetchError(err: unknown): boolean {
  if (!err) return false;
  const msg = typeof err === 'string' ? err : (err as { message?: string })?.message || '';
  const lower = msg.toLowerCase();
  return (
    lower.includes('failed to fetch') ||
    lower.includes('fetch failed') ||
    lower.includes('network error') ||
    lower.includes('networkerror') ||
    lower.includes('load failed') ||
    lower.includes('abort') ||
    lower.includes('connection') ||
    lower.includes('timeout') ||
    (err as { name?: string })?.name === 'AuthRetryableFetchError'
  );
}

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
 * Hash password with salt using SHA-256
 */
export async function hashUserPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`vocal-user-salt:${salt}:${password}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
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

  // 1. Try Supabase Auth if online & configured
  if (useLiveSupabase) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
        },
      });

      if (error) {
        if (
          error.message.toLowerCase().includes('already') ||
          error.message.toLowerCase().includes('registered')
        ) {
          return { success: false, message: 'An account with this email already exists. Please sign in.' };
        }

        // If Supabase is unreachable (network/fetch error, adblocker, or service issue):
        // Fall through seamlessly to local account registration so the user is never blocked!
        if (isNetworkOrFetchError(error)) {
          console.warn('Supabase auth network unreachable, falling back to local account registration:', error.message);
        } else {
          console.warn('Supabase sign up error, proceeding with local registration fallback:', error.message);
        }
      } else if (data.user) {
        const userSession: UserAccount = {
          id: data.user.id,
          email: data.user.email || email,
          name: (data.user.user_metadata?.name as string) || name,
          createdAt: data.user.created_at || new Date().toISOString(),
        };
        safeSet(STORAGE_KEY_SESSION, JSON.stringify(userSession));
        clearUserLoginRateLimit();

        const requiresConfirmation = !data.session;
        return {
          success: true,
          user: userSession,
          message: requiresConfirmation
            ? 'Account created! Please check your email to confirm your account, then sign in.'
            : 'Account created successfully! 5 free conversion tokens are active.',
        };
      }
    } catch (err: unknown) {
      console.warn('Supabase sign up error, falling back to local account:', err);
    }
  }

  // 2. Local fallback registration
  const accounts = getStoredAccounts();
  const existing = accounts.find((a) => a.email === email);
  if (existing) {
    return { success: false, message: 'An account with this email already exists. Please sign in.' };
  }

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

  // 1. Try Supabase Auth if online & configured
  if (useLiveSupabase) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Supabase login error: fall through to verify against stored local accounts
        // This ensures users who registered locally or while offline can always log in!
        console.warn('Supabase sign-in response:', error.message, '- verifying with local accounts...');
      } else if (data.user) {
        const userSession: UserAccount = {
          id: data.user.id,
          email: data.user.email || email,
          name: (data.user.user_metadata?.name as string) || email.split('@')[0],
          createdAt: data.user.created_at || new Date().toISOString(),
        };
        safeSet(STORAGE_KEY_SESSION, JSON.stringify(userSession));
        clearUserLoginRateLimit();
        return {
          success: true,
          user: userSession,
          message: `Welcome back, ${userSession.name}!`,
        };
      }
    } catch (err: unknown) {
      console.warn('Supabase sign-in error, falling back to local verification:', err);
    }
  }

  // 2. Local fallback verification
  const accounts = getStoredAccounts();
  const account = accounts.find((a) => a.email === email);

  if (!account) {
    recordFailedLoginAttempt();
    return { success: false, message: 'No account found with this email. Please create an account.' };
  }

  const hash = await hashUserPassword(password, account.salt);
  if (hash !== account.passwordHash) {
    recordFailedLoginAttempt();
    return { success: false, message: 'Incorrect password. Please try again.' };
  }

  const userSession: UserAccount = {
    id: account.id,
    email: account.email,
    name: account.name,
    createdAt: account.createdAt,
  };

  safeSet(STORAGE_KEY_SESSION, JSON.stringify(userSession));
  clearUserLoginRateLimit();

  return {
    success: true,
    user: userSession,
    message: `Welcome back, ${account.name || account.email}!`,
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
