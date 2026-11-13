import { describe, it, expect, beforeEach } from 'vitest';
import {
  initTokens,
  getTokenBalance,
  canPerformConversion,
  consumeConversionToken,
  generateUPILink,
  generateWhatsAppProofLink,
  createVoucher,
  redeemRechargeCode,
  resetTokensForTesting,
  isUnlimitedTokens,
  setUnlimitedTokens,
  INITIAL_FREE_TOKENS,
  RECEIVER_UPI_ID,
  RECEIVER_NAME,
  WHATSAPP_SUPPORT_NUMBER,
  MINIMUM_PURCHASE_TOKENS,
} from '../tokenService';

describe('Token Service & UPI Billing', () => {
  beforeEach(() => {
    resetTokensForTesting();
  });

  it('1. grants exactly 5 free trial tokens to new users on first initialization', () => {
    const tokens = initTokens();
    expect(tokens).toBe(INITIAL_FREE_TOKENS);
    expect(tokens).toBe(5);
    expect(getTokenBalance()).toBe(5);
    expect(canPerformConversion()).toBe(true);
  });

  it('2. deducts 1 token per song conversion and updates balance', () => {
    initTokens(); // 5 tokens
    const res1 = consumeConversionToken('MySong.mp3');
    expect(res1.success).toBe(true);
    expect(res1.remainingTokens).toBe(4);
    expect(getTokenBalance()).toBe(4);

    // Consume remaining 4 tokens
    consumeConversionToken('Track2.wav');
    consumeConversionToken('Track3.wav');
    consumeConversionToken('Track4.wav');
    const res5 = consumeConversionToken('Track5.wav');
    expect(res5.success).toBe(true);
    expect(res5.remainingTokens).toBe(0);
    expect(getTokenBalance()).toBe(0);
    expect(canPerformConversion()).toBe(false);

    // 6th conversion should be blocked with 0 tokens
    const res6 = consumeConversionToken('Track6.wav');
    expect(res6.success).toBe(false);
    expect(res6.remainingTokens).toBe(0);
    expect(res6.message).toContain('0 tokens left');
  });

  it('3. generates correct NPCI deep link with receiver Ayesha Tech Studio', () => {
    const upiLink = generateUPILink(10);
    expect(upiLink).toContain(`pa=${RECEIVER_UPI_ID}`);
    expect(RECEIVER_UPI_ID).toBe('9663396058@mbk');
    expect(RECEIVER_NAME).toBe('Ayesha Tech Studio');
    expect(upiLink).toContain('am=10.00');
    expect(upiLink).toContain('cu=INR');
    expect(upiLink).toContain('Ayesha%20Tech%20Studio');

    // Enforces minimum 10 tokens
    const smallLink = generateUPILink(3);
    expect(smallLink).toContain(`am=${MINIMUM_PURCHASE_TOKENS}.00`);
  });

  it('4. generates WhatsApp proof link with receiver Ayesha Tech Studio without exposing raw UPI ID', () => {
    const waLink = generateWhatsAppProofLink(25, 'UTR987654321');
    expect(waLink).toContain('wa.me/919743247790');
    expect(waLink).toContain('UTR987654321');
    expect(waLink).toContain('Device%20ID');
    expect(waLink).toContain('Ayesha%20Tech%20Studio');
    // Verifies UPI ID is completely hidden from payer
    expect(waLink).not.toContain('9663396058');
  });

  it('5. creates and redeems genuine cryptographic token recharge vouchers', async () => {
    initTokens(); // 5 tokens
    const voucher10 = await createVoucher(10, 'A1B2');
    expect(voucher10).toMatch(/^TOK10-A1B2-[A-Z0-9]{4}$/);

    const result = await redeemRechargeCode(voucher10);
    expect(result.success).toBe(true);
    expect(result.tokensAdded).toBe(10);
    expect(result.newBalance).toBe(15); // 5 + 10
    expect(getTokenBalance()).toBe(15);

    // Cannot redeem the same voucher twice
    const duplicateAttempt = await redeemRechargeCode(voucher10);
    expect(duplicateAttempt.success).toBe(false);
    expect(duplicateAttempt.message).toContain('already been redeemed');
    expect(getTokenBalance()).toBe(15);
  });

  it('6. rejects forged, invalid or tampered voucher codes', async () => {
    initTokens();
    const forgedVoucher = 'TOK50-A1B2-ZZZZ'; // invalid checksum
    const res = await redeemRechargeCode(forgedVoucher);
    expect(res.success).toBe(false);
    expect(res.message).toContain('Invalid or forged');
    expect(getTokenBalance()).toBe(5);
  });

  it('7. accepts 16-digit lifetime license key to grant lifetime tokens', async () => {
    initTokens();
    // Valid 16-digit key from our cryptographic system
    const lifetimeKey = 'LNZV-5BG2-ABJR-JFW5';
    const res = await redeemRechargeCode(lifetimeKey);
    expect(res.success).toBe(true);
    expect(res.tokensAdded).toBe(9999);
    expect(getTokenBalance()).toBe(10004); // 5 + 9999
  });

  it('8. triggers brute-force lockout after 5 consecutive failed voucher attempts', async () => {
    initTokens();
    // 5 failed attempts
    for (let i = 0; i < 5; i++) {
      const res = await redeemRechargeCode(`TOK10-FAIL-000${i}`);
      expect(res.success).toBe(false);
    }

    // 6th attempt should be blocked by rate limiter
    const blockedRes = await redeemRechargeCode('TOK10-TEST-1234');
    expect(blockedRes.success).toBe(false);
    expect(blockedRes.message).toContain('Too many failed attempts');
    expect(blockedRes.message).toContain('Security lockout active');
  });

  it('9. unlocks unlimited conversions with no limit when token or license code is activated', async () => {
    initTokens();
    expect(isUnlimitedTokens()).toBe(false);

    // Redeem a valid token voucher
    const voucher10 = await createVoucher(10, 'UNL1');
    const res = await redeemRechargeCode(voucher10);
    expect(res.success).toBe(true);
    expect(isUnlimitedTokens()).toBe(true);

    // Can convert without limit
    expect(canPerformConversion()).toBe(true);

    // Can also explicitly toggle unlimited state
    setUnlimitedTokens(false);
    expect(isUnlimitedTokens()).toBe(false);
    setUnlimitedTokens(true);
    expect(isUnlimitedTokens()).toBe(true);

    // Multiple conversions do not decrement or get blocked
    for (let i = 0; i < 20; i++) {
      const conv = consumeConversionToken(`Song_${i}.mp3`);
      expect(conv.success).toBe(true);
      expect(conv.message).toContain('Unlimited');
    }
    expect(canPerformConversion()).toBe(true);
  });

  it('10. targets WhatsApp number 9743247790 for token purchases', () => {
    expect(WHATSAPP_SUPPORT_NUMBER).toBe('9743247790');
    const waLink = generateWhatsAppProofLink(10);
    expect(waLink).toContain('https://wa.me/919743247790');
  });
});
