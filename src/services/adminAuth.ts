/**
 * Secure Admin Authentication Service
 * Uses salted SHA-256 via Web Crypto API, session token lifecycle, and brute-force rate limiting.
 */

import { sanitizeText } from '../utils/sanitize';

const ADMIN_SALT = 'vocal_remover_admin_salt_feroz_2026:';
const STORAGE_KEY_ADMIN_SESSION = 'vocal_admin_session_v1';
const STORAGE_KEY_ADMIN_RATE_LIMIT = 'vocal_admin_login_rate_limit';

// Expected salted SHA-256 hash of "Feroz@Admin2026!" with ADMIN_SALT
// Computed via crypto.subtle.digest("SHA-256")
const EXPECTED_ADMIN_HASH = '0479152072d9a57cee731e9a980b7912b54837b9fb4ca86673b7a8383a4f7a03';

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const SESSION_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours

interface AdminSession {
  token: string;
  expiresAt: number;
}

interface RateLimitRecord {
  attempts: number[];
  lockedUntil: number | null;
}

let inMemorySession: Record<string, string> = {};

function safeSessionGet(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const v = window.sessionStorage.getItem(key);
      if (v !== null) return v;
    }
  } catch {
    // fallback
  }
  return inMemorySession[key] || null;
}

function safeSessionSet(key: string, val: string): void {
  inMemorySession[key] = val;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(key, val);
    }
  } catch {
    // fallback
  }
}

function safeSessionRemove(key: string): void {
  delete inMemorySession[key];
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // fallback
  }
}

/**
 * Computes salted SHA-256 hash of a password string using Web Crypto API
 */
export async function hashPasswordWithSalt(password: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${ADMIN_SALT}${password}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Checks if the admin login is currently rate-limited/locked
 */
export function checkAdminLoginRateLimit(): { isLocked: boolean; remainingSeconds: number } {
  try {
    const raw = safeSessionGet(STORAGE_KEY_ADMIN_RATE_LIMIT);
    if (!raw) return { isLocked: false, remainingSeconds: 0 };
    const record: RateLimitRecord = JSON.parse(raw);
    const now = Date.now();
    if (record.lockedUntil && now < record.lockedUntil) {
      return { isLocked: true, remainingSeconds: Math.ceil((record.lockedUntil - now) / 1000) };
    }
  } catch {
    // fallback
  }
  return { isLocked: false, remainingSeconds: 0 };
}

function recordFailedLogin(): void {
  try {
    const raw = safeSessionGet(STORAGE_KEY_ADMIN_RATE_LIMIT);
    const record: RateLimitRecord = raw ? JSON.parse(raw) : { attempts: [], lockedUntil: null };
    const now = Date.now();
    record.attempts = (record.attempts || []).filter((ts) => now - ts < LOGIN_LOCKOUT_MS);
    record.attempts.push(now);

    if (record.attempts.length >= MAX_LOGIN_ATTEMPTS) {
      record.lockedUntil = now + LOGIN_LOCKOUT_MS;
    }
    safeSessionSet(STORAGE_KEY_ADMIN_RATE_LIMIT, JSON.stringify(record));
  } catch {
    // fallback
  }
}

function clearLoginRateLimit(): void {
  safeSessionRemove(STORAGE_KEY_ADMIN_RATE_LIMIT);
}

/**
 * Authenticates admin against salted hash with rate limiting & session issuance
 */
export async function authenticateAdmin(password: string): Promise<{ success: boolean; message: string }> {
  const rateLimit = checkAdminLoginRateLimit();
  if (rateLimit.isLocked) {
    const mins = Math.ceil(rateLimit.remainingSeconds / 60);
    return {
      success: false,
      message: `Too many failed attempts. Admin login locked for ${mins} minute${mins === 1 ? '' : 's'}.`,
    };
  }

  // Clean password input
  const cleanPass = sanitizeText(password, 64);
  if (!cleanPass) {
    return { success: false, message: 'Password cannot be empty.' };
  }

  const computedHash = await hashPasswordWithSalt(cleanPass);

  // Constant-time style comparison
  let match = true;
  if (computedHash.length !== EXPECTED_ADMIN_HASH.length) {
    match = false;
  } else {
    for (let i = 0; i < computedHash.length; i++) {
      if (computedHash[i] !== EXPECTED_ADMIN_HASH[i]) {
        match = false;
      }
    }
  }

  if (!match) {
    recordFailedLogin();
    return { success: false, message: 'Invalid admin credentials.' };
  }

  // Success: issue 2-hour session
  clearLoginRateLimit();
  const sessionToken = `ADM-${Math.random().toString(36).substring(2)}-${Date.now().toString(36)}`;
  const session: AdminSession = {
    token: sessionToken,
    expiresAt: Date.now() + SESSION_DURATION_MS,
  };

  safeSessionSet(STORAGE_KEY_ADMIN_SESSION, JSON.stringify(session));

  return { success: true, message: 'Admin authentication successful.' };
}

/**
 * Checks if active admin session exists and is not expired
 */
export function isAdminAuthenticated(): boolean {
  try {
    const raw = safeSessionGet(STORAGE_KEY_ADMIN_SESSION);
    if (!raw) return false;
    const session: AdminSession = JSON.parse(raw);
    if (!session || !session.expiresAt || !session.token) return false;
    if (Date.now() > session.expiresAt) {
      safeSessionRemove(STORAGE_KEY_ADMIN_SESSION);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Destroys active admin session immediately
 */
export function adminLogout(): void {
  safeSessionRemove(STORAGE_KEY_ADMIN_SESSION);
}

/**
 * Reset admin auth state for testing
 */
export function resetAdminAuthForTesting(): void {
  safeSessionRemove(STORAGE_KEY_ADMIN_SESSION);
  safeSessionRemove(STORAGE_KEY_ADMIN_RATE_LIMIT);
}
