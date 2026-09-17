import type { AuthTokens, User } from '@tapntally/shared';
import { create } from 'zustand';
import { api } from '../api/client';
import { tokenStore } from '../api/token-store';

interface SessionState {
  status: 'booting' | 'signed_out' | 'signed_in';
  user: User | null;
  /** Restore from secure storage on app launch. */
  boot: () => Promise<void>;
  signInDev: (email: string) => Promise<void>;
  signInGoogle: (idToken: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
}

interface SignInResponse {
  user: User;
  tokens: AuthTokens;
}

export const useSession = create<SessionState>((set, get) => ({
  status: 'booting',
  user: null,

  boot: async () => {
    const tokens = await tokenStore.get();
    if (!tokens) return set({ status: 'signed_out', user: null });
    try {
      const user = await api<User>('/users/me');
      set({ status: 'signed_in', user });
    } catch {
      // Refresh failed or server unreachable with stale tokens → sign out cleanly.
      await tokenStore.clear();
      set({ status: 'signed_out', user: null });
    }
  },

  signInDev: async (email) => {
    const res = await api<SignInResponse>('/auth/dev', { method: 'POST', body: { email }, auth: false });
    await tokenStore.set(res.tokens);
    set({ status: 'signed_in', user: res.user });
  },

  signInGoogle: async (idToken) => {
    const res = await api<SignInResponse>('/auth/google', { method: 'POST', body: { idToken }, auth: false });
    await tokenStore.set(res.tokens);
    set({ status: 'signed_in', user: res.user });
  },

  refreshUser: async () => {
    if (get().status !== 'signed_in') return;
    const user = await api<User>('/users/me');
    set({ user });
  },

  signOut: async () => {
    const tokens = await tokenStore.get();
    if (tokens?.refreshToken) {
      try {
        await api('/auth/logout', { method: 'POST', body: { refreshToken: tokens.refreshToken } });
      } catch {
        /* best effort */
      }
    }
    await tokenStore.clear();
    set({ status: 'signed_out', user: null });
  },
}));
