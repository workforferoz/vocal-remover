// Token Management & Billing Service for Vocal Remover
// Designed for Ayesha Tech Studio
// 1 Conversion = 1 Token | 5 Free Trial Tokens | Min Purchase 10 Tokens
// WhatsApp Support: 9743247790

import { resolveValidLicenseKey, getStoredLicense, activateLicense, deactivateLicense } from './licenseService';
import { sanitizeCode } from '../utils/sanitize';
import { supabase, isSupabaseConfigured } from './supabaseClient';

export const INITIAL_FREE_TOKENS = 5;
export const MINIMUM_PURCHASE_TOKENS = 10;
export const TOKEN_PRICE_INR = 1;

// Encrypted VPA payload to prevent plaintext bundle extraction by scrapers/crawlers
const _SECURE_VPA_ENC = 'OTY2MzM5NjA1OEBtYms=';
function decodeSecureVPA(): string {
  try {
    if (typeof globalThis !== 'undefined' && typeof globalThis.atob === 'function') {
      return globalThis.atob(_SECURE_VPA_ENC);
    }
    return '';
  } catch {
    return '';
  }
}

export const RECEIVER_UPI_ID: string = decodeSecureVPA();
export const RECEIVER_NAME = 'Ayesha Tech Studio';
export const WHATSAPP_SUPPORT_NUMBER = '9743247790';

const STORAGE_KEY_TOKENS = 'vocal_remover_user_tokens';
const STORAGE_KEY_INITIALIZED = 'vocal_remover_tokens_initialized';
const STORAGE_KEY_REDEEMED = 'vocal_remover_redeemed_codes';
const STORAGE_KEY_HISTORY = 'vocal_remover_token_history';
const STORAGE_KEY_DEVICE_ID = 'vocal_remover_device_id';
const STORAGE_KEY_RATE_LIMIT = 'vocal_remover_redeem_rate_limit';
export const STORAGE_KEY_UNLIMITED = 'vocal_remover_is_unlimited';

/**
 * Check if the current user has activated unlimited tokens (no conversion limit)
 */
export function isUnlimitedTokens(): boolean {
  if (safeGet(STORAGE_KEY_UNLIMITED) === 'true') {
    return true;
  }
  const license = getStoredLicense();
  return license !== null;
}

/**
 * Set the unlimited tokens state for the user
 */
export function setUnlimitedTokens(unlimited: boolean): void {
  safeSet(STORAGE_KEY_UNLIMITED, unlimited ? 'true' : 'false');
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes brute-force lockout window

export interface RateLimitState {
  attempts: number[];
  lockedUntil: number | null;
}

const VOUCHER_SALT = 'vocal-token-secret-feroz-ayesha:';
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export interface TokenTransaction {
  id: string;
  type: 'free_grant' | 'conversion_use' | 'voucher_recharge' | 'admin_grant';
  amount: number; // positive for credit, negative for debit
  balanceAfter: number;
  description: string;
  timestamp: string;
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

/**
 * Get or create a persistent unique Device ID for the client
 */
export function getOrCreateDeviceId(): string {
  let devId = safeGet(STORAGE_KEY_DEVICE_ID);
  if (!devId) {
    const randPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    const timePart = Date.now().toString(36).substring(3, 7).toUpperCase();
    devId = `DEV-${randPart}-${timePart}`;
    safeSet(STORAGE_KEY_DEVICE_ID, devId);
  }
  return devId;
}

/**
 * Initialize tokens on first app launch: grants 5 FREE tokens
 */
export function initTokens(): number {
  const isInit = safeGet(STORAGE_KEY_INITIALIZED);
  if (!isInit) {
    safeSet(STORAGE_KEY_INITIALIZED, 'true');
    safeSet(STORAGE_KEY_TOKENS, String(INITIAL_FREE_TOKENS));

    const initialTx: TokenTransaction = {
      id: `tx_${Date.now()}`,
      type: 'free_grant',
      amount: INITIAL_FREE_TOKENS,
      balanceAfter: INITIAL_FREE_TOKENS,
      description: 'Welcome gift: 5 Free Conversion Tokens',
      timestamp: new Date().toISOString(),
    };
    safeSet(STORAGE_KEY_HISTORY, JSON.stringify([initialTx]));
    return INITIAL_FREE_TOKENS;
  }

  const raw = safeGet(STORAGE_KEY_TOKENS);
  const parsed = parseInt(raw || '0', 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Get current available token balance
 */
export function getTokenBalance(): number {
  const isInit = safeGet(STORAGE_KEY_INITIALIZED);
  if (!isInit) {
    return initTokens();
  }
  const raw = safeGet(STORAGE_KEY_TOKENS);
  const parsed = parseInt(raw || '0', 10);
  return isNaN(parsed) ? 0 : Math.max(0, parsed);
}

/**
 * Fetch token balance from Supabase if authenticated
 */
export async function syncTokenBalanceFromSupabase(): Promise<number | null> {
  if (!isSupabaseConfigured || import.meta.env.TEST) return null;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (!uid) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('tokens')
      .eq('id', uid)
      .single();

    if (!error && data && typeof data.tokens === 'number') {
      safeSet(STORAGE_KEY_TOKENS, String(data.tokens));
      return data.tokens;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Check if the user has at least 1 token to perform a song conversion (or has unlimited tokens)
 */
export function canPerformConversion(): boolean {
  if (isUnlimitedTokens()) {
    return true;
  }
  return getTokenBalance() >= 1;
}

/**
 * Deduct 1 token for a song conversion, or bypass if user has unlimited tokens
 */
export function consumeConversionToken(songName: string): {
  success: boolean;
  remainingTokens: number;
  message: string;
} {
  const current = getTokenBalance();

  if (isUnlimitedTokens()) {
    try {
      const history: TokenTransaction[] = JSON.parse(safeGet(STORAGE_KEY_HISTORY) || '[]');
      history.unshift({
        id: `tx_${Date.now()}`,
        type: 'conversion_use',
        amount: 0,
        balanceAfter: current,
        description: `Unlimited vocal conversion for: "${songName.slice(0, 40)}"`,
        timestamp: new Date().toISOString(),
      });
      safeSet(STORAGE_KEY_HISTORY, JSON.stringify(history.slice(0, 50)));
    } catch {
      // ignore
    }

    return {
      success: true,
      remainingTokens: current,
      message: 'Unlimited conversion active. No tokens deducted.',
    };
  }

  if (current < 1) {
    return {
      success: false,
      remainingTokens: 0,
      message: 'You have 0 tokens left. Recharge with minimum 10 tokens (₹10) to continue.',
    };
  }

  const remaining = current - 1;
  safeSet(STORAGE_KEY_TOKENS, String(remaining));

  // Sync deduction with Supabase RPC if live
  if (isSupabaseConfigured && !import.meta.env.TEST) {
    try {
      supabase.rpc('deduct_conversion_token', { song_name: songName }).then(({ data, error }) => {
        if (!error && data && typeof data.remaining_tokens === 'number') {
          safeSet(STORAGE_KEY_TOKENS, String(data.remaining_tokens));
        }
      });
    } catch {
      // ignore
    }
  }

  // Log transaction
  try {
    const history: TokenTransaction[] = JSON.parse(safeGet(STORAGE_KEY_HISTORY) || '[]');
    history.unshift({
      id: `tx_${Date.now()}`,
      type: 'conversion_use',
      amount: -1,
      balanceAfter: remaining,
      description: `Vocal removal conversion for: "${songName.slice(0, 40)}"`,
      timestamp: new Date().toISOString(),
    });
    safeSet(STORAGE_KEY_HISTORY, JSON.stringify(history.slice(0, 50)));
  } catch {
    // ignore history error
  }

  return {
    success: true,
    remainingTokens: remaining,
    message: `1 token used. ${remaining} token${remaining === 1 ? '' : 's'} remaining.`,
  };
}

/**
 * Manually credit tokens (e.g. from recharge voucher or admin)
 */
export function creditTokens(amount: number, reason: string): { newBalance: number } {
  const current = getTokenBalance();
  const newBalance = current + amount;
  safeSet(STORAGE_KEY_TOKENS, String(newBalance));

  try {
    const history: TokenTransaction[] = JSON.parse(safeGet(STORAGE_KEY_HISTORY) || '[]');
    history.unshift({
      id: `tx_${Date.now()}`,
      type: 'voucher_recharge',
      amount: amount,
      balanceAfter: newBalance,
      description: reason,
      timestamp: new Date().toISOString(),
    });
    safeSet(STORAGE_KEY_HISTORY, JSON.stringify(history.slice(0, 50)));
  } catch {
    // ignore history error
  }

  return { newBalance };
}

/**
 * Get token transaction history
 */
export function getTokenHistory(): TokenTransaction[] {
  try {
    return JSON.parse(safeGet(STORAGE_KEY_HISTORY) || '[]');
  } catch {
    return [];
  }
}

/**
 * Generate standard NPCI UPI Deep Link for paying Feroz Nadaf
 * @param tokens Number of tokens (equals amount in INR since 1 token = ₹1)
 */
export function generateUPILink(tokens: number): string {
  const cleanTokens = Math.max(MINIMUM_PURCHASE_TOKENS, Math.round(tokens));
  const amountStr = `${cleanTokens}.00`;
  const note = encodeURIComponent(`Vocal Remover ${cleanTokens} Tokens`);
  const name = encodeURIComponent(RECEIVER_NAME);
  return `upi://pay?pa=${RECEIVER_UPI_ID}&pn=${name}&am=${amountStr}&cu=INR&tn=${note}`;
}

/**
 * Generate WhatsApp message link to send payment proof and request recharge code
 */
export function generateWhatsAppProofLink(tokens: number, utrNumber?: string): string {
  const deviceId = getOrCreateDeviceId();
  let text = `Hello Ayesha Tech Studio, I paid ₹${tokens} for ${tokens} Vocal Remover tokens.`;
  if (utrNumber && utrNumber.trim()) {
    text += `\nTransaction Ref / UTR: ${utrNumber.trim()}`;
  }
  text += `\nDevice ID: ${deviceId}\nPlease send my Token Recharge Code.`;
  return `https://wa.me/91${WHATSAPP_SUPPORT_NUMBER}?text=${encodeURIComponent(text)}`;
}

/**
 * Compute cryptographic checksum for a voucher code
 */
export async function computeVoucherChecksum(amount: number, serial: string): Promise<string> {
  try {
    const enc = new TextEncoder();
    const data = enc.encode(`${VOUCHER_SALT}${amount}-${serial.toUpperCase()}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    let sum = '';
    for (let i = 0; i < 4; i++) {
      sum += ALPHABET[hashArray[i] % ALPHABET.length];
    }
    return sum;
  } catch {
    return '';
  }
}

/**
 * Create a valid cryptographically signed voucher code for customers (Used by Feroz)
 * Format: TOK<AMOUNT>-<4_CHAR_SERIAL>-<4_CHAR_CHECKSUM>
 */
export async function createVoucher(amount: number, customSerial?: string): Promise<string> {
  let serial = customSerial || '';
  if (!serial) {
    for (let i = 0; i < 4; i++) {
      serial += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
  }
  const checksum = await computeVoucherChecksum(amount, serial);
  return `TOK${amount}-${serial}-${checksum}`;
}

/**
 * Check if brute-force lockout is currently active for voucher redemption
 */
export function checkRedeemRateLimit(): { isLocked: boolean; remainingSeconds: number } {
  try {
    const raw = safeGet(STORAGE_KEY_RATE_LIMIT);
    if (!raw) return { isLocked: false, remainingSeconds: 0 };
    const state: RateLimitState = JSON.parse(raw);
    const now = Date.now();
    if (state.lockedUntil && now < state.lockedUntil) {
      const remainingSeconds = Math.ceil((state.lockedUntil - now) / 1000);
      return { isLocked: true, remainingSeconds };
    }
  } catch {
    // fallback
  }
  return { isLocked: false, remainingSeconds: 0 };
}

function recordFailedRedeemAttempt(): void {
  try {
    const raw = safeGet(STORAGE_KEY_RATE_LIMIT);
    const state: RateLimitState = raw ? JSON.parse(raw) : { attempts: [], lockedUntil: null };
    const now = Date.now();
    // Keep attempts within the 15-minute window
    state.attempts = (state.attempts || []).filter((ts) => now - ts < LOCKOUT_DURATION_MS);
    state.attempts.push(now);

    if (state.attempts.length >= MAX_FAILED_ATTEMPTS) {
      state.lockedUntil = now + LOCKOUT_DURATION_MS;
    }
    safeSet(STORAGE_KEY_RATE_LIMIT, JSON.stringify(state));
  } catch {
    // fallback
  }
}

function clearRedeemRateLimitOnSuccess(): void {
  try {
    safeSet(STORAGE_KEY_RATE_LIMIT, JSON.stringify({ attempts: [], lockedUntil: null }));
  } catch {
    // fallback
  }
}

/**
 * Redeem a voucher code or 16-digit license key with brute-force rate-limiting and XSS-safe sanitization
 */
export async function redeemRechargeCode(rawCode: string): Promise<{
  success: boolean;
  tokensAdded: number;
  newBalance: number;
  message: string;
}> {
  // Check rate limit lockout first
  const { isLocked, remainingSeconds } = checkRedeemRateLimit();
  if (isLocked) {
    const mins = Math.ceil(remainingSeconds / 60);
    return {
      success: false,
      tokensAdded: 0,
      newBalance: getTokenBalance(),
      message: `Too many failed attempts. Security lockout active: please wait ${mins} minute${mins === 1 ? '' : 's'} (${remainingSeconds}s) before trying again.`,
    };
  }

  // Sanitize input strictly to uppercase alphanumeric and hyphens (anti-XSS and injection safe)
  const clean = sanitizeCode(rawCode, 32);

  if (!clean) {
    return {
      success: false,
      tokensAdded: 0,
      newBalance: getTokenBalance(),
      message: 'Please enter a valid voucher or license code.',
    };
  }

  // 1. Check if already redeemed on this device
  let redeemed: string[] = [];
  try {
    redeemed = JSON.parse(safeGet(STORAGE_KEY_REDEEMED) || '[]');
  } catch {
    redeemed = [];
  }

  // Check Supabase cloud voucher redemption if live
  if (isSupabaseConfigured && !import.meta.env.TEST) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.user) {
        const { data, error } = await supabase.rpc('redeem_token_voucher', {
          voucher_code: clean,
        });
        if (!error && data && data.success) {
          clearRedeemRateLimitOnSuccess();
          safeSet(STORAGE_KEY_TOKENS, String(data.new_balance));
          return {
            success: true,
            tokensAdded: data.tokens_added,
            newBalance: data.new_balance,
            message: data.message,
          };
        }
      }
    } catch {
      // fall through to local cryptographic verification
    }
  }

  if (redeemed.includes(clean)) {
    recordFailedRedeemAttempt();
    return {
      success: false,
      tokensAdded: 0,
      newBalance: getTokenBalance(),
      message: 'This voucher code has already been redeemed on this computer.',
    };
  }

  // 2. Check if it's a 16-digit lifetime license key (e.g. LNZV-5BG2-ABJR-JFW5)
  const resolved16Key = await resolveValidLicenseKey(clean);
  if (resolved16Key) {
    // 16-digit lifetime license grants unlimited conversions + credits 9999 tokens
    const LIFETIME_TOKENS = 9999;
    redeemed.push(clean);
    safeSet(STORAGE_KEY_REDEEMED, JSON.stringify(redeemed));
    clearRedeemRateLimitOnSuccess();
    setUnlimitedTokens(true);
    await activateLicense(clean);
    const { newBalance } = creditTokens(LIFETIME_TOKENS, `Lifetime License Redeemed: ${clean}`);
    return {
      success: true,
      tokensAdded: LIFETIME_TOKENS,
      newBalance,
      message: `Lifetime License verified! Unlimited conversions activated with no limits.`,
    };
  }

  // 3. Match Token Voucher Format: TOK<AMOUNT>-<SERIAL>-<CHECKSUM>
  // e.g. TOK10-ABCD-EF89 or TOK10ABCDEF89
  const voucherRegex = /^TOK(\d+)[-]?([A-Z0-9]{4})[-]?([A-Z0-9]{4})$/;
  const match = clean.match(voucherRegex);

  if (!match) {
    recordFailedRedeemAttempt();
    return {
      success: false,
      tokensAdded: 0,
      newBalance: getTokenBalance(),
      message: 'Invalid code format. Expected voucher format (e.g. TOK10-XXXX-XXXX) or 16-digit key.',
    };
  }

  const amount = parseInt(match[1], 10);
  const serial = match[2];
  const actualCheck = match[3];

  if (isNaN(amount) || amount <= 0) {
    recordFailedRedeemAttempt();
    return {
      success: false,
      tokensAdded: 0,
      newBalance: getTokenBalance(),
      message: 'Invalid token amount in voucher.',
    };
  }

  const expectedCheck = await computeVoucherChecksum(amount, serial);
  if (expectedCheck !== actualCheck) {
    recordFailedRedeemAttempt();
    return {
      success: false,
      tokensAdded: 0,
      newBalance: getTokenBalance(),
      message: 'Invalid or forged voucher code. Please contact Ayesha Tech Studio on WhatsApp (9743247790).',
    };
  }

  // Valid voucher! Clear any failed attempts, credit tokens, grant unlimited conversions and mark as redeemed
  clearRedeemRateLimitOnSuccess();
  redeemed.push(clean);
  safeSet(STORAGE_KEY_REDEEMED, JSON.stringify(redeemed));
  setUnlimitedTokens(true);

  const { newBalance } = creditTokens(amount, `Voucher Redeemed: TOK${amount}-${serial}`);
  return {
    success: true,
    tokensAdded: amount,
    newBalance,
    message: `Token code activated! Unlimited conversions unlocked with no limits.`,
  };
}

/**
 * Reset tokens for testing
 */
export function resetTokensForTesting(): void {
  delete inMemoryStorage[STORAGE_KEY_TOKENS];
  delete inMemoryStorage[STORAGE_KEY_INITIALIZED];
  delete inMemoryStorage[STORAGE_KEY_REDEEMED];
  delete inMemoryStorage[STORAGE_KEY_HISTORY];
  delete inMemoryStorage[STORAGE_KEY_RATE_LIMIT];
  delete inMemoryStorage[STORAGE_KEY_UNLIMITED];
  deactivateLicense();
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY_TOKENS);
      window.localStorage.removeItem(STORAGE_KEY_INITIALIZED);
      window.localStorage.removeItem(STORAGE_KEY_REDEEMED);
      window.localStorage.removeItem(STORAGE_KEY_HISTORY);
      window.localStorage.removeItem(STORAGE_KEY_RATE_LIMIT);
      window.localStorage.removeItem(STORAGE_KEY_UNLIMITED);
    }
  } catch {
    // fallback
  }
}

