import { describe, it, expect, beforeEach } from 'vitest';
import {
  formatLicenseKeyInput,
  verifyLicenseKey,
  activateLicense,
  isSoftwareActivated,
  deactivateLicense,
  getStoredLicense,
  resolveValidLicenseKey,
} from '../licenseService';

describe('License Service with Optical Typo Tolerance', () => {
  const validKey = 'LNZV-5BG2-ABJR-JFW5';
  const userTypoKeyWithS = 'LNZV-5BG2-ABJR-JFWS'; // S instead of 5
  const validKey2 = 'UG4T-8DQT-9W8S-2E6L';
  const invalidKey = 'AAAA-BBBB-CCCC-DDDD';

  beforeEach(() => {
    deactivateLicense();
  });

  it('formats input with hyphens every 4 characters', () => {
    expect(formatLicenseKeyInput('lnzv5bg2abjrjfw5')).toBe('LNZV-5BG2-ABJR-JFW5');
    expect(formatLicenseKeyInput('UG4T8DQT')).toBe('UG4T-8DQT');
    expect(formatLicenseKeyInput(userTypoKeyWithS)).toBe('LNZV-5BG2-ABJR-JFWS');
  });

  it('verifies genuine license keys accurately', async () => {
    expect(await verifyLicenseKey(validKey)).toBe(true);
    expect(await verifyLicenseKey(validKey2)).toBe(true);
  });

  it('auto-corrects optical typos (e.g. S vs 5) seamlessly', async () => {
    const resolved = await resolveValidLicenseKey(userTypoKeyWithS);
    expect(resolved).toBe('LNZV5BG2ABJRJFW5');
    expect(await verifyLicenseKey(userTypoKeyWithS)).toBe(true);

    // Should activate successfully even when user typed S instead of 5
    const result = await activateLicense(userTypoKeyWithS);
    expect(result.success).toBe(true);
    expect(await isSoftwareActivated()).toBe(true);
  });

  it('rejects forged or corrupted license keys', async () => {
    expect(await verifyLicenseKey(invalidKey)).toBe(false);
    expect(await verifyLicenseKey('SHORT-KEY')).toBe(false);
  });

  it('activates software and persists license', async () => {
    expect(await isSoftwareActivated()).toBe(false);
    const result = await activateLicense(validKey);
    expect(result.success).toBe(true);
    expect(await isSoftwareActivated()).toBe(true);

    const stored = getStoredLicense();
    expect(stored?.key).toBe(validKey);
  });

  it('fails activation on forged key', async () => {
    const result = await activateLicense(invalidKey);
    expect(result.success).toBe(false);
    expect(await isSoftwareActivated()).toBe(false);
  });

  it('supports deactivation', async () => {
    await activateLicense(validKey);
    expect(await isSoftwareActivated()).toBe(true);
    deactivateLicense();
    expect(await isSoftwareActivated()).toBe(false);
  });
});
