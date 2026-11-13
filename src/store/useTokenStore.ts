import { create } from 'zustand';
import {
  getTokenBalance,
  consumeConversionToken,
  redeemRechargeCode,
  canPerformConversion,
  initTokens,
  syncTokenBalanceFromSupabase,
  isUnlimitedTokens,
} from '../services/tokenService';

interface TokenState {
  balance: number;
  isUnlimited: boolean;
  isModalOpen: boolean;
  init: () => void;
  refreshBalance: () => void;
  openModal: () => void;
  closeModal: () => void;
  consumeToken: (songName: string) => { success: boolean; message: string };
  redeemCode: (code: string) => Promise<{ success: boolean; tokensAdded: number; message: string }>;
  canConvert: () => boolean;
}

export const useTokenStore = create<TokenState>((set) => ({
  balance: 5,
  isUnlimited: false,
  isModalOpen: false,

  init: () => {
    const current = initTokens();
    const unlimited = isUnlimitedTokens();
    set({ balance: current, isUnlimited: unlimited });
    syncTokenBalanceFromSupabase().then((cloudBalance) => {
      if (typeof cloudBalance === 'number') {
        set({ balance: cloudBalance });
      }
    });
  },

  refreshBalance: () => {
    set({
      balance: getTokenBalance(),
      isUnlimited: isUnlimitedTokens(),
    });
  },

  openModal: () => {
    set({ isModalOpen: true });
  },

  closeModal: () => {
    set({ isModalOpen: false });
  },

  consumeToken: (songName: string) => {
    const res = consumeConversionToken(songName);
    if (res.success) {
      set({
        balance: res.remainingTokens,
        isUnlimited: isUnlimitedTokens(),
      });
    }
    return { success: res.success, message: res.message };
  },

  redeemCode: async (code: string) => {
    const res = await redeemRechargeCode(code);
    if (res.success) {
      set({
        balance: res.newBalance,
        isUnlimited: isUnlimitedTokens(),
      });
    }
    return {
      success: res.success,
      tokensAdded: res.tokensAdded,
      message: res.message,
    };
  },

  canConvert: () => {
    return canPerformConversion();
  },
}));
