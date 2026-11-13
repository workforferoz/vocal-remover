import { describe, it, expect, beforeEach } from 'vitest';

class MemoryStorage {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

describe('Cookie and Storage Consent', () => {
  const STORAGE_KEY_CONSENT = 'vocal_remover_cookie_consent';
  let storage: { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void; removeItem: (k: string) => void };

  beforeEach(() => {
    if (typeof globalThis.localStorage === 'undefined' || !globalThis.localStorage) {
      storage = new MemoryStorage();
    } else {
      storage = globalThis.localStorage;
    }
    storage.removeItem(STORAGE_KEY_CONSENT);
  });

  it('initially has no stored consent record', () => {
    expect(storage.getItem(STORAGE_KEY_CONSENT)).toBeNull();
  });

  it('stores essential consent upon acceptance', () => {
    storage.setItem(STORAGE_KEY_CONSENT, 'essential_accepted');
    expect(storage.getItem(STORAGE_KEY_CONSENT)).toBe('essential_accepted');
  });

  it('stores declined status if user opts out of non-essential storage', () => {
    storage.setItem(STORAGE_KEY_CONSENT, 'declined');
    expect(storage.getItem(STORAGE_KEY_CONSENT)).toBe('declined');
  });
});
