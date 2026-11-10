import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pwaManager, type BeforeInstallPromptEvent } from '../pwa';

describe('PwaManager', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('provides initial network status', () => {
    const status = pwaManager.getNetworkStatus();
    expect(['online', 'offline', 'reconnecting']).toContain(status);
  });

  it('reports installation eligibility', () => {
    const canInstall = pwaManager.getCanInstall();
    expect(typeof canInstall).toBe('boolean');
  });

  it('supports subscriber callbacks when state changes', () => {
    const listener = vi.fn();
    const unsubscribe = pwaManager.subscribe(listener);
    expect(typeof unsubscribe).toBe('function');

    pwaManager.handleOnline();
    expect(listener).toHaveBeenCalled();

    unsubscribe();
  });

  it('handles offline event and notifies listeners', () => {
    const listener = vi.fn();
    const unsubscribe = pwaManager.subscribe(listener);

    pwaManager.handleOffline();
    expect(pwaManager.getNetworkStatus()).toBe('offline');
    expect(listener).toHaveBeenCalled();

    unsubscribe();
  });

  it('returns false for promptInstall when no deferred prompt exists', async () => {
    const result = await pwaManager.promptInstall();
    expect(result).toBe(false);
  });

  it('handles beforeinstallprompt event correctly', () => {
    const listener = vi.fn();
    const unsubscribe = pwaManager.subscribe(listener);

    const mockEvent = {
      preventDefault: vi.fn(),
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    } as unknown as BeforeInstallPromptEvent;

    pwaManager.handleBeforeInstallPrompt(mockEvent);

    expect(pwaManager.getCanInstall()).toBe(true);
    expect(listener).toHaveBeenCalled();
    expect(mockEvent.preventDefault).toHaveBeenCalled();

    unsubscribe();
  });
});
