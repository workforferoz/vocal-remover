import { describe, it, expect, beforeEach } from 'vitest';
import {
  hashPasswordWithSalt,
  authenticateAdmin,
  isAdminAuthenticated,
  adminLogout,
  resetAdminAuthForTesting,
} from '../adminAuth';

describe('Admin Authentication & Protection', () => {
  beforeEach(() => {
    resetAdminAuthForTesting();
  });

  it('1. correctly computes salted SHA-256 hash', async () => {
    const hash = await hashPasswordWithSalt('Feroz@Admin2026!');
    expect(hash).toBeDefined();
    expect(hash.length).toBe(64);
  });

  it('2. successfully authenticates with correct admin credentials', async () => {
    const res = await authenticateAdmin('Feroz@Admin2026!');
    expect(res.success).toBe(true);
    expect(isAdminAuthenticated()).toBe(true);
  });

  it('3. rejects invalid credentials', async () => {
    const res = await authenticateAdmin('WrongPassword123');
    expect(res.success).toBe(false);
    expect(res.message).toContain('Invalid');
    expect(isAdminAuthenticated()).toBe(false);
  });

  it('4. locks out after 5 consecutive failed attempts', async () => {
    for (let i = 0; i < 5; i++) {
      await authenticateAdmin(`fail_${i}`);
    }
    const lockedRes = await authenticateAdmin('Feroz@Admin2026!');
    expect(lockedRes.success).toBe(false);
    expect(lockedRes.message).toContain('locked');
  });

  it('5. logs out cleanly', async () => {
    await authenticateAdmin('Feroz@Admin2026!');
    expect(isAdminAuthenticated()).toBe(true);
    adminLogout();
    expect(isAdminAuthenticated()).toBe(false);
  });
});
