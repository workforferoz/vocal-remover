// License Activation Service for Vocal Remover
// Designed & Developed by Ayesha Tech Studio

const STORAGE_KEY = 'vocal_remover_license_data';
const SALT = 'vocal-remover-secret-ayesha:';
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export interface LicenseData {
  key: string;
  activatedAt: string;
  signature: string;
}

const OPTICAL_SUBSTITUTIONS: Record<string, string> = {
  S: '5',
  '5': 'S',
  O: '0',
  '0': 'O',
  I: '1',
  '1': 'I',
  Z: '2',
  '2': 'Z',
  B: '8',
  '8': 'B',
};

let inMemoryStorage: Record<string, string> = {};

function safeGetItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const val = window.localStorage.getItem(key);
      if (val !== null) return val;
    }
  } catch {
    // fallback
  }
  return inMemoryStorage[key] || null;
}

function safeSetItem(key: string, val: string): void {
  inMemoryStorage[key] = val;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, val);
    }
  } catch {
    // fallback to inMemoryStorage
  }
}

function safeRemoveItem(key: string): void {
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
 * Format raw string into XXXX-XXXX-XXXX-XXXX as user types
 */
export function formatLicenseKeyInput(val: string): string {
  const clean = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  const parts: string[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    parts.push(clean.slice(i, i + 4));
  }
  return parts.join('-');
}

/**
 * Compute SHA-256 checksum for first 12 characters
 */
export async function computeChecksum(part12: string): Promise<string> {
  try {
    const enc = new TextEncoder();
    const data = enc.encode(SALT + part12);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    let sum = '';
    for (let i = 0; i < 4; i++) {
      const val = hashArray[i];
      sum += ALPHABET[val % ALPHABET.length];
    }
    return sum;
  } catch (err) {
    console.error('Cryptographic failure in license checksum:', err);
    return '';
  }
}

/**
 * Verify whether a raw 16-character string satisfies the cryptographic checksum
 */
export async function verifyCryptographicChecksum(clean: string): Promise<boolean> {
  if (clean.length !== 16) return false;
  const part12 = clean.slice(0, 12);
  const expectedCheck = await computeChecksum(part12);
  const actualCheck = clean.slice(12, 16);
  return expectedCheck === actualCheck;
}

/**
 * Find valid match for input key using cryptographic verification and optical typo recovery (S <-> 5, etc.)
 */
export async function resolveValidLicenseKey(rawInput: string): Promise<string | null> {
  const clean = rawInput.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length !== 16) return null;

  // 1. Direct cryptographic checksum verification
  if (await verifyCryptographicChecksum(clean)) {
    return clean;
  }

  // 2. 1-character optical typo correction (e.g. S instead of 5, O instead of 0, etc.)
  for (let i = 0; i < clean.length; i++) {
    const sub = OPTICAL_SUBSTITUTIONS[clean[i]];
    if (sub) {
      const candidate = clean.slice(0, i) + sub + clean.slice(i + 1);
      if (await verifyCryptographicChecksum(candidate)) {
        return candidate;
      }
    }
  }

  // 3. 2-character optical typo correction
  for (let i = 0; i < clean.length; i++) {
    const sub1 = OPTICAL_SUBSTITUTIONS[clean[i]];
    if (!sub1) continue;
    for (let j = i + 1; j < clean.length; j++) {
      const sub2 = OPTICAL_SUBSTITUTIONS[clean[j]];
      if (!sub2) continue;
      const candidate = clean.slice(0, i) + sub1 + clean.slice(i + 1, j) + sub2 + clean.slice(j + 1);
      if (await verifyCryptographicChecksum(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

/**
 * Verify whether a license key (or optical typo variant) is genuine
 */
export async function verifyLicenseKey(key: string): Promise<boolean> {
  const resolved = await resolveValidLicenseKey(key);
  return resolved !== null;
}

/**
 * Check if current browser has an active and valid license data
 */
export function getStoredLicense(): LicenseData | null {
  try {
    const raw = safeGetItem(STORAGE_KEY);
    if (!raw) return null;
    const data: LicenseData = JSON.parse(raw);
    if (!data.key || !data.activatedAt) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Validate stored license asynchronously on startup
 */
export async function isSoftwareActivated(): Promise<boolean> {
  const stored = getStoredLicense();
  if (!stored) return false;
  return await verifyLicenseKey(stored.key);
}

/**
 * Activate the software with a user-provided license key
 */
export async function activateLicense(inputKey: string): Promise<{ success: boolean; message: string }> {
  const resolved = await resolveValidLicenseKey(inputKey);
  if (!resolved) {
    return { success: false, message: 'Invalid license key. Please check your purchase message or WhatsApp receipt.' };
  }

  const formatted = `${resolved.slice(0, 4)}-${resolved.slice(4, 8)}-${resolved.slice(8, 12)}-${resolved.slice(12, 16)}`;
  const licenseData: LicenseData = {
    key: formatted,
    activatedAt: new Date().toISOString(),
    signature: 'VERIFIED_OFFLINE_LIFETIME',
  };

  try {
    safeSetItem(STORAGE_KEY, JSON.stringify(licenseData));
    return { success: true, message: 'Software activated successfully! Welcome to Vocal Remover.' };
  } catch (err) {
    return { success: false, message: 'Failed to write license to storage: ' + String(err) };
  }
}

/**
 * Deactivate license (allows user to re-enter key or switch devices)
 */
export function deactivateLicense(): void {
  safeRemoveItem(STORAGE_KEY);
}
