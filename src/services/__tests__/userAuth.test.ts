import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerUser,
  loginUser,
  getCurrentUser,
  logoutUser,
  resetUsersForTesting,
  checkUserLoginRateLimit,
} from '../userAuth';

describe('User Authentication & Account Management', () => {
  beforeEach(() => {
    resetUsersForTesting();
  });

  it('1. initially has no authenticated user session', () => {
    expect(getCurrentUser()).toBeNull();
  });

  it('2. registers a new user account and creates active session', async () => {
    const res = await registerUser('singer@example.com', 'secret123', 'Singer One');
    expect(res.success).toBe(true);
    expect(res.user).toBeDefined();
    expect(res.user?.email).toBe('singer@example.com');
    expect(res.user?.name).toBe('Singer One');

    const current = getCurrentUser();
    expect(current).not.toBeNull();
    expect(current?.email).toBe('singer@example.com');
  });

  it('3. rejects duplicate registration with the same email', async () => {
    await registerUser('producer@studio.com', 'mypassword', 'Producer');
    const dupRes = await registerUser('producer@studio.com', 'otherpassword', 'Duplicate');
    expect(dupRes.success).toBe(false);
    expect(dupRes.message).toContain('already exists');
  });

  it('4. rejects invalid email format and short passwords', async () => {
    const invalidEmail = await registerUser('notanemail', 'password123');
    expect(invalidEmail.success).toBe(false);
    expect(invalidEmail.message).toContain('valid email');

    const shortPass = await registerUser('valid@email.com', '12345');
    expect(shortPass.success).toBe(false);
    expect(shortPass.message).toContain('at least 6 characters');
  });

  it('5. logs into an existing account with correct credentials', async () => {
    await registerUser('test@vocal.com', 'mypassword123', 'Test User');
    logoutUser();
    expect(getCurrentUser()).toBeNull();

    const loginRes = await loginUser('test@vocal.com', 'mypassword123');
    expect(loginRes.success).toBe(true);
    expect(loginRes.user?.email).toBe('test@vocal.com');
    expect(getCurrentUser()?.email).toBe('test@vocal.com');
  });

  it('6. rejects incorrect password and non-existent account', async () => {
    await registerUser('member@test.com', 'correctpass');
    logoutUser();

    const wrongPass = await loginUser('member@test.com', 'wrongpass');
    expect(wrongPass.success).toBe(false);
    expect(wrongPass.message).toContain('Incorrect password');

    const noAccount = await loginUser('unknown@test.com', 'anypass');
    expect(noAccount.success).toBe(false);
    expect(noAccount.message).toContain('No account found');
  });

  it('7. logs out active user session', async () => {
    await registerUser('user@active.com', 'password123');
    expect(getCurrentUser()).not.toBeNull();

    logoutUser();
    expect(getCurrentUser()).toBeNull();
  });

  it('8. locks account login after consecutive failed attempts', async () => {
    await registerUser('target@test.com', 'correctpass');
    logoutUser();

    for (let i = 0; i < 5; i++) {
      await loginUser('target@test.com', 'wrongpassword');
    }

    const rateLimit = checkUserLoginRateLimit();
    expect(rateLimit.isLocked).toBe(true);

    const lockedAttempt = await loginUser('target@test.com', 'correctpass');
    expect(lockedAttempt.success).toBe(false);
    expect(lockedAttempt.message).toContain('Too many failed login attempts');
  });
});

